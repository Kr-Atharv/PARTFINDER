// src/controllers/compatibilityController.ts
import { Request, Response, NextFunction } from "express";
import { CompatibilityCheckRequest } from "../schemas/compatibilitySchemas";
import { CompatibilityEngine } from "../services/compatibilityEngine";
import { PartsService } from "../services/partsService";

/**
 * The engine reads `claim.sourceRecord`. Catalogue records arrive with `source`, live research
 * records with a flat `sourceUrl`; map all of them onto `sourceRecord` without inventing data.
 * A claim from a live research record is not marked verified.
 */
export function normalizeCandidate(candidate: any) {
  if (!Array.isArray(candidate.sourceClaims)) return candidate;
  return {
    ...candidate,
    sourceClaims: candidate.sourceClaims.map((claim: any) => {
      const record = claim.sourceRecord ?? claim.source;
      const url = record?.url ?? claim.sourceUrl ?? candidate.source?.url ?? undefined;
      const name = record?.name ?? candidate.source?.name ?? undefined;
      return {
        ...claim,
        sourceRecord: url || name ? { name, url, isVerified: record?.isVerified ?? false, retrievedAt: record?.retrievedAt } : undefined,
      };
    }),
  };
}

export class CompatibilityController {
  static async check(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as CompatibilityCheckRequest;
      const { partIds, candidateParts, requirements } = body;

      const loadedCandidates: any[] = [];

      // 1. If part IDs were provided, load full records and specs from Prisma
      if (partIds && partIds.length > 0) {
        try {
          const partsFromDb = await PartsService.compareParts(partIds);
          // Catalogue records carry claims as `source`; the engine reads `sourceRecord`.
          loadedCandidates.push(...partsFromDb.map((p: any) => normalizeCandidate(p)));
        } catch (dbError) {
          // The database being unreachable must not block parts the caller sent in full.
          // If any requested id has no candidate record to fall back on, the failure stands.
          const sent = new Set((candidateParts ?? []).map((c) => c.id));
          if (!partIds.every((id) => sent.has(id))) throw dbError;
        }
      }

      // 2. Add any candidate parts provided directly in payload
      // Skip candidates that were already loaded by id so no part is assessed twice.
      if (candidateParts && candidateParts.length > 0) {
        const loadedIds = new Set(loadedCandidates.map((p: any) => p.id));
        for (const candidate of candidateParts) {
          if (candidate.id && loadedIds.has(candidate.id)) continue;
          loadedCandidates.push(normalizeCandidate(candidate));
        }
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
