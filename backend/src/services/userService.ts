// src/services/userService.ts
import { supabaseAdmin } from "./supabaseService";
import { logger } from "../utils/logger";
import crypto from "crypto";

export interface UserProfileRecord {
  id: string;
  supabaseUserId: string;
  email: string | null;
  fullName: string | null;
  createdAt: string;
  updatedAt: string;
}

export class UserService {
  static async getOrCreateProfile(
    supabaseUserId: string,
    email?: string,
    fullName?: string
  ): Promise<UserProfileRecord | null> {
    try {
      const { data: existing, error: findErr } = await supabaseAdmin
        .from("UserProfile")
        .select("*")
        .eq("supabaseUserId", supabaseUserId)
        .maybeSingle();

      if (findErr) {
        logger.warn(`Error querying UserProfile for ${supabaseUserId}: ${findErr.message}`);
      }

      if (existing) {
        return existing as UserProfileRecord;
      }

      const now = new Date().toISOString();
      const { data: created, error: createErr } = await supabaseAdmin
        .from("UserProfile")
        .insert({
          id: crypto.randomUUID(),
          supabaseUserId,
          email: email || null,
          fullName: fullName || null,
          updatedAt: now,
        })
        .select()
        .single();

      if (createErr) {
        logger.warn(`Error creating UserProfile for ${supabaseUserId}: ${createErr.message}`);
        return null;
      }

      return created as UserProfileRecord;
    } catch (err: any) {
      logger.warn(`UserService exception: ${err.message}`);
      return null;
    }
  }

  static async getProfileBySupabaseId(supabaseUserId: string): Promise<UserProfileRecord | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from("UserProfile")
        .select("*")
        .eq("supabaseUserId", supabaseUserId)
        .maybeSingle();

      if (error) {
        logger.warn(`Error fetching UserProfile for ${supabaseUserId}: ${error.message}`);
        return null;
      }

      return data as UserProfileRecord;
    } catch (err: any) {
      logger.warn(`UserService exception: ${err.message}`);
      return null;
    }
  }
}
