// src/controllers/crossReferenceController.ts
import { Request, Response, NextFunction } from "express";
import { crossReferenceLookupSchema } from "../schemas/crossReferenceSchemas";
import { crossReferenceService } from "../services/crossReferenceService";

export class CrossReferenceController {
  public static async lookup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = crossReferenceLookupSchema.safeParse(req.method === "POST" ? req.body : req.query);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            message: "Invalid cross-reference request parameters.",
            code: "VALIDATION_ERROR",
            details: parsed.error.issues,
          },
        });
        return;
      }

      const result = await crossReferenceService.findEquivalents(parsed.data);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async getByPartId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const partId = req.params.partId;
      const result = await crossReferenceService.findEquivalents({ partId });
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}
