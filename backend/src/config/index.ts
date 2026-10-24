// src/config/index.ts
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().optional().transform((val) => (val ? Number(val) : 4000)),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/partfinder"),
  SUPABASE_URL: z.string().default("https://example.supabase.co"),
  SUPABASE_ANON_KEY: z.string().default("dummy-anon-key"),
  SUPABASE_JWT_SECRET: z.string().optional(),
  SESSION_COOKIE_NAME: z.string().default("session_token"),
  SESSION_COOKIE_MAX_AGE: z.string().optional().transform((v) => (v ? Number(v) : 86400)),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

export const config = envSchema.parse(process.env);
