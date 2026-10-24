// src/controllers/compatibilityController.ts
import { Request, Response, NextFunction } from "express";
import { CompatibilityCheckRequest } from "../schemas/compatibilitySchemas";
import { CompatibilityEngine } from "../services/compatibilityEngine";
import { PartsService } from "../services/partsService";

export class CompatibilityController {
  static async check(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as CompatibilityCheckRequest;
      const { partIds, candidateParts, requirements } = body;

      const loadedCandidates: any[] = [];

      // 1. If part IDs were provided, load full records and specs from Prisma
      if (partIds && partIds.length > 0) {
        const partsFromDb = await PartsService.compareParts(partIds);
        loadedCandidates.push(...partsFromDb);
      }

      // 2. Add any candidate parts provided directly in payload
      if (candidateParts && candidateParts.length > 0) {
        loadedCandidates.push(...candidateParts);
      }

      if (loadedCandidates.length === 0) {
        return res.status(400).json({
          error: {
            message: "No valid candidate parts provided or found for compatibility check.",
            code: "NO_CANDIDATE_PARTS",
          },
        });
      }

      // 3. Evaluate each candidate deterministically
      const assessments = loadedCandidates.map((candidate) =>
        CompatibilityEngine.assessPart(candidate, requirements)
      );

      return res.json({
        data: {
          totalAssessed: assessments.length,
          assessments,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
