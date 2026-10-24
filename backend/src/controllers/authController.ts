// src/controllers/authController.ts
import { Request, Response, NextFunction } from "express";
import { supabaseClient, supabaseAdmin } from "../services/supabaseService";
import { UserService } from "../services/userService";
import { config } from "../config";
import { logger } from "../utils/logger";

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: (config.NODE_ENV === "production" ? "strict" : "lax") as "strict" | "lax",
  maxAge: config.SESSION_COOKIE_MAX_AGE * 1000,
  path: "/",
};

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: (config.NODE_ENV === "production" ? "strict" : "lax") as "strict" | "lax",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: "/",
};

export class AuthController {
  static async signUp(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, fullName } = req.body;

      // Create pre-confirmed user via admin API to avoid email rate limits and confirmation delays
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      });

      let user = createData?.user;

      if (createError) {
        // If user already exists, attempt to sign in directly
        if (createError.message.toLowerCase().includes("already registered") || createError.status === 422) {
          const signInAttempt = await supabaseClient.auth.signInWithPassword({ email, password });
          if (signInAttempt.error) {
            return res.status(400).json({
              error: {
                message: "An account with this email already exists. Please sign in.",
                code: "USER_ALREADY_EXISTS",
              },
            });
          }
          user = signInAttempt.data.user;
        } else {
          return res.status(400).json({
            error: {
              message: createError.message || "Failed to create account.",
              code: "AUTH_SIGNUP_FAILED",
            },
          });
        }
      }

      if (!user) {
        return res.status(400).json({
          error: {
            message: "User registration failed.",
            code: "AUTH_SIGNUP_FAILED",
          },
        });
      }

      // Link to UserProfile in Supabase
      let profile = null;
      try {
        profile = await UserService.getOrCreateProfile(user.id, user.email, fullName);
      } catch (dbErr: any) {
        logger.warn(`Could not persist user profile: ${dbErr.message}`);
      }

      // Sign in with password to establish session tokens
      const { data: sessionData } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      const session = sessionData?.session;

      if (session) {
        res.cookie(config.SESSION_COOKIE_NAME, session.access_token, ACCESS_COOKIE_OPTIONS);
        res.cookie(`${config.SESSION_COOKIE_NAME}_refresh`, session.refresh_token, REFRESH_COOKIE_OPTIONS);
      }

      return res.status(201).json({
        data: {
          user: {
            id: user.id,
            email: user.email,
            profile,
          },
          sessionActive: !!session,
          message: "Account created and signed in successfully.",
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async signIn(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.session) {
        return res.status(401).json({
          error: {
            message: error?.message || "Invalid email or password.",
            code: "AUTH_INVALID_CREDENTIALS",
          },
        });
      }

      const { session, user } = data;

      // Link/ensure profile exists in UserProfile
      let profile = null;
      try {
        profile = await UserService.getOrCreateProfile(
          user.id,
          user.email,
          user.user_metadata?.full_name
        );
      } catch (dbErr: any) {
        logger.warn(`Could not persist profile: ${dbErr.message}`);
      }

      // Set HttpOnly cookies
      res.cookie(config.SESSION_COOKIE_NAME, session.access_token, ACCESS_COOKIE_OPTIONS);
      res.cookie(`${config.SESSION_COOKIE_NAME}_refresh`, session.refresh_token, REFRESH_COOKIE_OPTIONS);

      return res.json({
        data: {
          user: {
            id: user.id,
            email: user.email,
            profile,
          },
          expiresAt: session.expires_at,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken =
        req.cookies[`${config.SESSION_COOKIE_NAME}_refresh`] || req.body.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          error: {
            message: "Missing refresh token",
            code: "AUTH_MISSING_TOKEN",
          },
        });
      }

      const { data, error } = await supabaseClient.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session) {
        res.clearCookie(config.SESSION_COOKIE_NAME, ACCESS_COOKIE_OPTIONS);
        res.clearCookie(`${config.SESSION_COOKIE_NAME}_refresh`, REFRESH_COOKIE_OPTIONS);
        return res.status(401).json({
          error: {
            message: error?.message || "Invalid or expired refresh token",
            code: "AUTH_REFRESH_FAILED",
          },
        });
      }

      const { session, user } = data;
      res.cookie(config.SESSION_COOKIE_NAME, session.access_token, ACCESS_COOKIE_OPTIONS);
      res.cookie(`${config.SESSION_COOKIE_NAME}_refresh`, session.refresh_token, REFRESH_COOKIE_OPTIONS);

      return res.json({
        data: {
          user: {
            id: user?.id,
            email: user?.email,
          },
          expiresAt: session.expires_at,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async signOut(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies[config.SESSION_COOKIE_NAME];
      if (token) {
        await supabaseAdmin.auth.admin?.signOut?.(token).catch(() => {});
      }

      res.clearCookie(config.SESSION_COOKIE_NAME, {
        ...ACCESS_COOKIE_OPTIONS,
        maxAge: 0,
      });
      res.clearCookie(`${config.SESSION_COOKIE_NAME}_refresh`, {
        ...REFRESH_COOKIE_OPTIONS,
        maxAge: 0,
      });

      return res.json({
        data: {
          message: "Signed out successfully",
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({
          error: {
            message: "Unauthorized",
            code: "AUTH_UNAUTHORIZED",
          },
        });
      }

      let profile = null;
      try {
        profile = await UserService.getProfileBySupabaseId(user.sub);
      } catch (dbErr: any) {
        logger.warn(`Could not fetch profile: ${dbErr.message}`);
      }

      return res.json({
        data: {
          user: {
            id: user.sub,
            email: user.email,
            profile,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
