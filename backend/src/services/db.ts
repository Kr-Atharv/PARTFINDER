// src/services/db.ts
import { supabaseAdmin } from "./supabaseService";

/**
 * Direct Supabase Database client (replaces Prisma Client)
 */
export const db = supabaseAdmin;
export { supabaseAdmin };
