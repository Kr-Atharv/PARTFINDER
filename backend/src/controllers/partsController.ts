// src/controllers/partsController.ts
import { Request, Response, NextFunction } from "express";
import { PartsService } from "../services/partsService";
import { supabaseAdmin } from "../services/supabaseService";
import crypto from "crypto";

export class PartsController {
  static async search(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as any;
      const data = await PartsService.searchParts(query);

      // Record search history if query provided
      if (query.query && query.query.trim()) {
        try {
          const user = (req as any).user;
          let userProfileId: string | null = null;
          if (user?.sub) {
            const { data: profile } = await supabaseAdmin
              .from("UserProfile")
              .select("id")
              .eq("supabaseUserId", user.sub)
              .maybeSingle();
            userProfileId = profile?.id || null;
          }

          await supabaseAdmin.from("SearchHistory").insert({
            id: crypto.randomUUID(),
            query: query.query.trim(),
            domain: query.domain || null,
            manufacturer: query.manufacturer || null,
            category: query.category || null,
            resultsCount: data.total,
            userProfileId,
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

  static async suggest(req: Request, res: Response, next: NextFunction) {
    try {
      const { q, limit } = req.query as unknown as { q: string; limit: number };
      const data = await PartsService.suggest(q, limit);
      return res.json({ data });
    } catch (err) {
      next(err);
    }
  }

  static async facets(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await PartsService.facets();
      return res.json({ data });
    } catch (err) {
      next(err);
    }
  }

  static async popular(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await PartsService.popularSearches();
      return res.json({ data });
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
