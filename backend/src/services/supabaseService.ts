// src/services/supabaseService.ts
import { createClient } from "@supabase/supabase-js";
import { config } from "../config";

/**
 * Public client for client-side Auth operations (sign in with password, refresh token, etc.)
 */
export const supabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Privileged Admin client for database queries, user management, and table operations
 */
export const supabaseAdmin = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SECRET_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
