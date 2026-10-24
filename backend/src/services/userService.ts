// src/services/userService.ts
import { prisma } from "./db";

export class UserService {
  static async getOrCreateProfile(supabaseUserId: string, email?: string, fullName?: string) {
    let profile = await prisma.userProfile.findUnique({
      where: { supabaseUserId },
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          supabaseUserId,
          email: email || null,
          fullName: fullName || null,
        },
      });
    }

    return profile;
  }

  static async getProfileBySupabaseId(supabaseUserId: string) {
    return prisma.userProfile.findUnique({
      where: { supabaseUserId },
    });
  }
}
