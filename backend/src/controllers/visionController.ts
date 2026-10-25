// src/controllers/visionController.ts
import { Request, Response, NextFunction } from "express";
import { visionOcrRequestSchema } from "../schemas/visionSchemas";
import { visionService } from "../services/visionService";

export class VisionController {
  public static async scan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = visionOcrRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            message: "Invalid vision request. Provide an image or manualText.",
            code: "VALIDATION_ERROR",
            details: parsed.error.issues,
          },
        });
        return;
      }

      const result = await visionService.processImage(parsed.data);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}
