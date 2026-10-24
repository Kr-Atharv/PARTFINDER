// src/controllers/authController.ts
import { Request, Response, NextFunction } from "express";
import { supabaseClient } from "../services/supabaseService";
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
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        return res.status(400).json({
          error: {
            message: error.message,
            code: "AUTH_SIGNUP_FAILED",
          },
        });
      }

      const user = data.user;
      if (!user) {
        return res.status(400).json({
          error: {
            message: "User registration failed",
            code: "AUTH_SIGNUP_FAILED",
          },
        });
      }

      // Link to Postgres UserProfile
      let profile = null;
      try {
        profile = await UserService.getOrCreateProfile(user.id, user.email, fullName);
      } catch (dbErr: any) {
        logger.warn(`Could not persist user profile to DB: ${dbErr.message}`);
      }

      // If Supabase returned a session immediately (email confirmation disabled)
      if (data.session) {
        res.cookie(config.SESSION_COOKIE_NAME, data.session.access_token, ACCESS_COOKIE_OPTIONS);
        res.cookie(`${config.SESSION_COOKIE_NAME}_refresh`, data.session.refresh_token, REFRESH_COOKIE_OPTIONS);
      }

      return res.status(201).json({
        data: {
          user: {
            id: user.id,
            email: user.email,
            profile,
          },
          sessionActive: !!data.session,
          message: data.session ? "Sign up successful" : "Confirmation email sent. Please check your inbox.",
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
            message: error?.message || "Invalid credentials",
            code: "AUTH_INVALID_CREDENTIALS",
          },
        });
      }

      const { session, user } = data;

      // Link/ensure profile exists in DB
      let profile = null;
      try {
        profile = await UserService.getOrCreateProfile(
          user.id,
          user.email,
          user.user_metadata?.full_name
        );
      } catch (dbErr: any) {
        logger.warn(`Could not persist profile to DB: ${dbErr.message}`);
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
        // Optional server-side signOut notification to Supabase
        await supabaseClient.auth.admin?.signOut?.(token).catch(() => {});
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
        logger.warn(`Could not fetch profile from DB: ${dbErr.message}`);
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
