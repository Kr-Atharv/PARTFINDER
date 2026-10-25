// src/schemas/visionSchemas.ts
import { z } from "zod";

export const visionOcrRequestSchema = z.object({
  /** Base64-encoded image string or data URL */
  image: z.string().optional(),
  /** Optional manual text transcription (useful if client-side OCR ran or technician typed rough notes) */
  manualText: z.string().optional(),
  /** Optional hint for preferred domain */
  preferredDomain: z.enum(["industrial", "electronics", "automotive"]).optional(),
});

export type VisionOcrRequest = z.infer<typeof visionOcrRequestSchema>;

export interface ExtractedSpec {
  label: string;
  value: string;
  unit?: string;
  confidence: number;
}

export interface VisionOcrResponse {
  detectedText: string;
  confidence: number;
  extracted: {
    partNumber?: string;
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    category?: string;
    specs: ExtractedSpec[];
  };
  suggestedSearchQuery: string;
  source: "external_ocr" | "nameplate_ai_engine";
}
