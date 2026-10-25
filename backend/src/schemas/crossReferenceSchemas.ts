// src/schemas/crossReferenceSchemas.ts
import { z } from "zod";

export const crossReferenceLookupSchema = z.object({
  partId: z.string().optional(),
  partNumber: z.string().optional(),
  manufacturer: z.string().optional(),
  domain: z.enum(["industrial", "electronics", "automotive"]).optional(),
});

export type CrossReferenceLookup = z.infer<typeof crossReferenceLookupSchema>;

export type InterchangeType = "direct_drop_in" | "functional_alternative" | "requires_adaptation";

export interface FFFScore {
  fit: "exact" | "compatible" | "adapter_required";
  form: "exact" | "similar" | "different";
  function: "identical" | "exceeds" | "limited";
  overallScore: number; // 0 to 100
}

export interface EquivalentPartMatch {
  id: string;
  partNumber: string;
  name: string;
  manufacturer: string;
  category: string;
  domain: "industrial" | "electronics" | "automotive";
  interchangeType: InterchangeType;
  fffScore: FFFScore;
  standardInterface?: string; // e.g. "ISO 4401-03 (NFPA D03)", "ISO 15 6200 Series", "TO-220"
  keyDifferences: string[];
  safetyNotes?: string;
  specs: Array<{ label: string; value: string }>;
  availability: "in_stock" | "limited" | "out_of_stock";
  sourceName?: string;
  sourceUrl?: string;
}

export interface CrossReferenceResponse {
  sourcePart: {
    partNumber: string;
    manufacturer?: string;
    category?: string;
    standardSeries?: string;
  };
  equivalentsCount: number;
  equivalents: EquivalentPartMatch[];
  interchangeStandardNotes?: string;
}
