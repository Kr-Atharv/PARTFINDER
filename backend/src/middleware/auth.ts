// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { config } from "../config";
import { logger } from "../utils/logger";

export interface SupabaseUser {
  sub: string;
  email?: string;
  exp?: number;
  iat?: number;
  [key: string]: any;
}

let JWKS: any = null;
function getJWKS() {
  if (!JWKS) {
    const jwksUrl = `${config.SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
    JWKS = createRemoteJWKSet(new URL(jwksUrl));
  }
  return JWKS;
}

/**
 * Verify Supabase JWT either via static secret (if SUPABASE_JWT_SECRET is set)
 * or via JWKS remote verification.
 */
export async function verifySupabaseToken(token: string): Promise<SupabaseUser> {
  try {
    if (config.SUPABASE_JWT_SECRET) {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(config.SUPABASE_JWT_SECRET));
      return payload as SupabaseUser;
    }
    const { payload } = await jwtVerify(token, getJWKS());
    return payload as SupabaseUser;
  } catch (err) {
    logger.warn(`JWT verification failed: ${(err as Error).message}`);
    throw Object.assign(new Error("Invalid or expired token"), { status: 401, code: "AUTH_INVALID_TOKEN" });
  }
}

/**
 * Express middleware that extracts the JWT from HttpOnly cookie or Authorization header
 * and verifies it. On success, attaches `req.user`.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.[config.SESSION_COOKIE_NAME];
  if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      error: {
        message: "Missing auth token",
        code: "AUTH_MISSING_TOKEN",
      },
    });
  }

  try {
    const user = await verifySupabaseToken(token);
    (req as any).user = user;
    next();
  } catch (err: any) {
    const status = err.status || 401;
    const message = err.message || "Authentication error";
    const code = err.code || "AUTH_ERROR";
    res.status(status).json({
      error: {
        message,
        code,
      },
    });
  }
}
