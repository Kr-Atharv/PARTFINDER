// src/config/index.ts
import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

// Support running from either root or backend directory
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().optional().transform((val) => (val ? Number(val) : 4000)),
  SUPABASE_URL: z.string().default("https://cbgekudoltlhcjmprhjl.supabase.co"),
  SUPABASE_PUBLISHABLE_KEY: z.string().default("sb_publishable_BeLzRhL3ZRcxA2tU1-ew3A_tN_c3E70"),
  SUPABASE_SECRET_KEY: z.string().default("sb_secret_SMu0J5LihqUatKS5S66EKg_pRwvSN2L"),
  SUPABASE_JWKS_URL: z.string().default("https://cbgekudoltlhcjmprhjl.supabase.co/auth/v1/.well-known/jwks.json"),
  SESSION_COOKIE_NAME: z.string().default("session_token"),
  SESSION_COOKIE_MAX_AGE: z.string().optional().transform((v) => (v ? Number(v) : 86400)),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  TINYFISH_API_KEY: z.string().optional(),
  TINYFISH_SEARCH_ENDPOINT: z.string().default("https://api.search.tinyfish.ai"),
  TINYFISH_FETCH_ENDPOINT: z.string().default("https://api.fetch.tinyfish.ai"),
  TINYFISH_TIMEOUT_MS: z.string().optional().transform((v) => (v ? Number(v) : 10000)),
  TINYFISH_MAX_RETRIES: z.string().optional().transform((v) => (v ? Number(v) : 2)),
});

const parsed = envSchema.parse({
  ...process.env,
  SUPABASE_PUBLISHABLE_KEY:
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_BeLzRhL3ZRcxA2tU1-ew3A_tN_c3E70",
});

export const config = parsed;
