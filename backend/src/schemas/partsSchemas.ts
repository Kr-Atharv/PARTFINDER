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
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: sortKeyEnum.optional().default("name-asc"),
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
