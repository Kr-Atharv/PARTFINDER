// src/schemas/compatibilitySchemas.ts
import { z } from "zod";
import { domainEnum } from "./partsSchemas";

export const ruleKindEnum = z.enum([
  "number-equals",
  "number-min",
  "number-max",
  "number-within",
  "text-equals",
  "text-contains",
  "list-contains",
  "fitment-check",
]);

export const requirementItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  expectedValue: z.string().min(1),
  expectedUnit: z.string().optional(),
  rule: ruleKindEnum,
  mandatory: z.boolean().optional().default(true),
  specLabels: z.array(z.string()).optional().default([]),
});

export const candidatePartInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  partNumber: z.string().optional(),
  manufacturer: z.string().optional(),
  domain: domainEnum.optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  availability: z.string().optional(),
  usedIn: z.array(z.string()).optional(),
  specs: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        unit: z.string().optional(),
      })
    )
    .optional(),
  source: z
    .object({
      name: z.string().optional(),
      url: z.string().optional(),
    })
    .optional(),
});

export const compatibilityCheckRequestSchema = z.object({
  partIds: z.array(z.string().min(1)).optional().default([]),
  candidateParts: z.array(candidatePartInputSchema).optional().default([]),
  domain: domainEnum,
  requirements: z.array(requirementItemSchema).min(1, "At least one requirement must be provided"),
});

export type CompatibilityCheckRequest = z.infer<typeof compatibilityCheckRequestSchema>;
export type RequirementItem = z.infer<typeof requirementItemSchema>;
export type CandidatePartInput = z.infer<typeof candidatePartInputSchema>;
