// src/controllers/partsController.ts
import { Request, Response, NextFunction } from "express";
import { PartsService } from "../services/partsService";
import { prisma } from "../services/db";

export class PartsController {
  static async search(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as any;
      const data = await PartsService.searchParts(query);

      // Record search history if query provided
      if (query.query && query.query.trim()) {
        try {
          const user = (req as any).user;
          let userProfileId: string | undefined = undefined;
          if (user?.sub) {
            const profile = await prisma.userProfile.findUnique({
              where: { supabaseUserId: user.sub },
            });
            userProfileId = profile?.id;
          }

          await prisma.searchHistory.create({
            data: {
              query: query.query.trim(),
              domain: query.domain || null,
              manufacturer: query.manufacturer || null,
              category: query.category || null,
              resultsCount: data.total,
              userProfileId: userProfileId || null,
            },
          });
        } catch {
          // Non-blocking history write
        }
      }

      return res.json({
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const part = await PartsService.getPartById(id);

      if (!part) {
        return res.status(404).json({
          error: {
            message: `Part with ID '${id}' not found`,
            code: "PART_NOT_FOUND",
          },
        });
      }

      return res.json({
        data: part,
      });
    } catch (err) {
      next(err);
    }
  }

  static async compare(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids } = req.query as { ids: string[] };
      const parts = await PartsService.compareParts(ids);

      return res.json({
        data: parts,
      });
    } catch (err) {
      next(err);
    }
  }
}
