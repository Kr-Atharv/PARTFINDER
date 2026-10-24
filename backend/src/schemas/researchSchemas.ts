// src/schemas/researchSchemas.ts
import { z } from "zod";
import { domainEnum } from "./partsSchemas";

export const researchSearchRequestSchema = z.object({
  query: z.string().min(1, "Query is required"),
  domain: domainEnum,
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  maxResults: z.coerce.number().int().min(1).max(10).optional().default(5),
  persistToDb: z.boolean().optional().default(false),
});

export type ResearchSearchRequest = z.infer<typeof researchSearchRequestSchema>;

export interface ExtractedSpec {
  label: string;
  value: string;
  unit?: string;
  evidence: string;
  sourceUrl: string;
}

export interface ListedPrice {
  amount: number;
  /** ISO code when explicit (USD, EUR...) or implied by an unambiguous symbol; otherwise the bare symbol (e.g. "$"). */
  currencyKey: string;
  /** The amount text as printed on the page. */
  raw: string;
  /** The page line the price was read from. */
  evidence: string;
  sourceUrl: string;
}

export type ResearchProgressEvent =
  | { type: "started"; query: string; searchQuery: string; maxResults: number }
  | {
      type: "search_done";
      count: number;
      results: Array<{ url: string; title: string; siteName?: string }>;
    }
  | { type: "fetch_done"; fetched: number; failed: Array<{ url: string; error: string }> }
  | {
      type: "page_processed";
      url: string;
      outcome: "extracted" | "skipped";
      reason?: string;
      partId?: string;
      specCount?: number;
      evidenceLevel?: "full_page" | "snippet_only";
    }
  | { type: "persisted"; count: number };

export interface ResearchedPartRecord {
  id: string;
  name: string;
  partNumber: string;
  manufacturer: string;
  domain: string;
  category: string;
  description: string;
  availability: "in_stock" | "limited" | "out_of_stock" | "unknown";
  usedIn: string[];
  keywords: string[];
  isDemo: false;
  specs: Array<{
    label: string;
    value: string;
    unit?: string;
  }>;
  source: {
    name: string;
    url: string;
    retrievedAt: string;
  };
  sourceClaims: Array<{
    label: string;
    claimedValue: string;
    unit?: string;
    evidence: string;
    sourceUrl: string;
  }>;
  /**
   * Price exactly as listed on the source page. Only set when a line mentioning
   * price/cost/each contained a currency amount. Never estimated.
   */
  price?: ListedPrice;
  /** `full_page` when parsed from fetched page text; `snippet_only` when the page could not be fetched. */
  evidenceLevel?: "full_page" | "snippet_only";
  conflictingSpecs?: Array<{
    label: string;
    claims: Array<{ value: string; sourceUrl: string }>;
  }>;
}
