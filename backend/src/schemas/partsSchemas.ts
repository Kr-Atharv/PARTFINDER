// src/schemas/partsSchemas.ts
import { z } from "zod";

export const domainEnum = z.enum(["industrial", "electronics", "automotive"]);
export const availabilityEnum = z.enum(["in_stock", "limited", "out_of_stock", "unknown"]);
export const sortKeyEnum = z.enum(["name-asc", "name-desc", "manufacturer-asc", "manufacturer-desc"]);

export const searchPartsQuerySchema = z.object({
  query: z.string().optional().default(""),
  domain: domainEnum.optional(),
  manufacturer: z.string().optional().default(""),
  category: z.string().optional().default(""),
  model: z.string().optional().default(""),
  availability: availabilityEnum.optional(),
  /** Spec filter: part must list a specification whose label contains this text. */
  specLabel: z.string().max(80).optional().default(""),
  /** Spec filter: the matching specification's value must contain this text. */
  specValue: z.string().max(80).optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: sortKeyEnum.optional().default("name-asc"),
});

export const suggestQuerySchema = z.object({
  q: z.string().trim().min(1, "q is required").max(100),
  limit: z.coerce.number().int().min(1).max(20).optional().default(8),
});

export const comparePartsQuerySchema = z.object({
  ids: z
    .string()
    .min(1, "At least one ID is required")
    .transform((val) =>
      val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
});

export const partIdParamSchema = z.object({
  id: z.string().min(1, "Part ID is required"),
});

export type SearchPartsQuery = z.infer<typeof searchPartsQuerySchema>;

export type SuggestQuery = z.infer<typeof suggestQuerySchema>;
