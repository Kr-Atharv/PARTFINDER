// src/schemas/datasheetSchemas.ts
import { z } from "zod";

export const datasheetParseRequestSchema = z.object({
  /** Base64-encoded PDF data string */
  fileBase64: z.string().min(10, "Valid base64 PDF data is required"),
  fileName: z.string().optional(),
});

export type DatasheetParseRequest = z.infer<typeof datasheetParseRequestSchema>;

export interface ParsedDatasheetSpec {
  label: string;
  value: string;
  unit?: string;
  confidence: number; // 0.0 to 1.0
  evidenceSnippet?: string;
  pageNumber?: number;
}

export interface DatasheetParseResponse {
  fileName?: string;
  pageCount: number;
  detectedTitle?: string;
  detectedManufacturer?: string;
  detectedModelCode?: string;
  detectedCategory?: string;
  specs: ParsedDatasheetSpec[];
  rawTextPreview: string;
  suggestedSearchQuery: string;
}
