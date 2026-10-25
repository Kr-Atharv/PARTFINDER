// src/controllers/datasheetController.ts
import { Request, Response, NextFunction } from "express";
import { datasheetParseRequestSchema } from "../schemas/datasheetSchemas";
import { datasheetParserService } from "../services/datasheetParserService";

export class DatasheetController {
  public static async parse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = datasheetParseRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            message: "Invalid datasheet payload. Valid base64 PDF is required.",
            code: "VALIDATION_ERROR",
            details: parsed.error.issues,
          },
        });
        return;
      }

      const result = await datasheetParserService.parseDatasheet(parsed.data);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}
