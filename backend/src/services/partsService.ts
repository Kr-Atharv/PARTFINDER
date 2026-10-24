// src/services/partsService.ts
import { supabaseAdmin } from "./supabaseService";
import { SearchPartsQuery } from "../schemas/partsSchemas";
import { logger } from "../utils/logger";

const PART_SELECT_QUERY = `
  *,
  specs:PartSpecification(*),
  sourceClaims:SpecificationClaim(
    *,
    sourceRecord:SourceRecord(*)
  )
`;

/** Removes characters that would break a PostgREST `or(...)`/`ilike` filter string. */
export function cleanFilterTerm(value: string): string {
  return value
    .replace(/[%_,()*\\"'{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits a free-text query into at most 6 safe search tokens. */
export function tokenizeQuery(query: string): string[] {
  return cleanFilterTerm(query)
    .split(" ")
    .filter(Boolean)
    .slice(0, 6);
}

/** Upper bound on rows loaded when a specification filter has to be applied in memory. */
export const SPEC_FILTER_SCAN_LIMIT = 1000;

const FACETS_TTL_MS = 60_000;
let facetsCache: { at: number; value: any } | null = null;

export class PartsService {
  /**
   * Search parts with relational filters, keyword/text matching, sorting and pagination.
   *
   * Every query word must match at least one of name / manufacturer / part number /
   * description / category (words are ANDed, fields are ORed).
   *
   * Specification filters (`specLabel` / `specValue`) cannot be expressed on the embedded
   * relation without dropping the part's other specs, so when they are present up to
   * SPEC_FILTER_SCAN_LIMIT matching rows are loaded, filtered in memory and then paginated.
   * `truncated` is true when that scan limit was reached, so the UI can say so.
   */
  static async searchParts(params: SearchPartsQuery) {
    const {
      query,
      domain,
      manufacturer,
      category,
      model,
      availability,
      specLabel = "",
      specValue = "",
      page = 1,
      limit = 20,
      sort = "name-asc",
    } = params;

    const skip = (page - 1) * limit;
    const specFilterActive = Boolean(specLabel.trim() || specValue.trim());

    try {
      let queryBuilder = supabaseAdmin
        .from("Part")
        .select(PART_SELECT_QUERY, { count: "exact" });

      if (domain) {
        queryBuilder = queryBuilder.eq("domain", domain);
      }

      const mfr = cleanFilterTerm(manufacturer || "");
      if (mfr) {
        queryBuilder = queryBuilder.ilike("manufacturer", `%${mfr}%`);
      }

      const cat = cleanFilterTerm(category || "");
      if (cat) {
        queryBuilder = queryBuilder.ilike("category", `%${cat}%`);
      }

      if (availability) {
        queryBuilder = queryBuilder.eq("availability", availability);
      }

      for (const token of tokenizeQuery(query || "")) {
        queryBuilder = queryBuilder.or(
          `name.ilike.%${token}%,manufacturer.ilike.%${token}%,partNumber.ilike.%${token}%,description.ilike.%${token}%,category.ilike.%${token}%`
        );
      }

      const m = cleanFilterTerm(model || "");
      if (m) {
        queryBuilder = queryBuilder.or(`typicalApplications.cs.{${m}},description.ilike.%${m}%`);
      }

      // Sorting (tie-break on id keeps pages stable)
      switch (sort) {
        case "name-desc":
          queryBuilder = queryBuilder.order("name", { ascending: false });
          break;
        case "manufacturer-asc":
          queryBuilder = queryBuilder.order("manufacturer", { ascending: true });
          break;
        case "manufacturer-desc":
          queryBuilder = queryBuilder.order("manufacturer", { ascending: false });
          break;
        default:
          queryBuilder = queryBuilder.order("name", { ascending: true });
          break;
      }
      queryBuilder = queryBuilder.order("id", { ascending: true });

      // Pagination: in-memory when a spec filter is active, otherwise in the database.
      queryBuilder = specFilterActive
        ? queryBuilder.range(0, SPEC_FILTER_SCAN_LIMIT - 1)
        : queryBuilder.range(skip, skip + limit - 1);

      const { data, count, error } = await queryBuilder;

      if (error) {
        logger.error(`Error searching parts in Supabase: ${error.message}`);
        throw error;
      }

      let records = (data || []).map((r: any) => this.formatPartRecord(r));
      let total = count ?? 0;
      let truncated = false;

      if (specFilterActive) {
        const wantLabel = specLabel.trim().toLowerCase();
        const wantValue = specValue.trim().toLowerCase();
        truncated = (count ?? 0) > SPEC_FILTER_SCAN_LIMIT;
        records = records.filter((part: any) =>
          part.specs.some(
            (spec: any) =>
              (!wantLabel || String(spec.label).toLowerCase().includes(wantLabel)) &&
              (!wantValue || String(spec.value).toLowerCase().includes(wantValue))
          )
        );
        total = records.length;
        records = records.slice(skip, skip + limit);
      }

      return {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        truncated,
        results: records,
      };
    } catch (err: any) {
      logger.error(`PartsService.searchParts failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Autocomplete: real catalogue records whose name, part number or manufacturer match.
   */
  static async suggest(q: string, limit = 8) {
    const term = cleanFilterTerm(q);
    if (!term) return { parts: [], manufacturers: [], categories: [] };

    const { data, error } = await supabaseAdmin
      .from("Part")
      .select("id,name,partNumber,manufacturer,category,domain")
      .or(`name.ilike.%${term}%,partNumber.ilike.%${term}%,manufacturer.ilike.%${term}%,category.ilike.%${term}%`)
      .order("name", { ascending: true })
      .limit(40);

    if (error) {
      logger.error(`PartsService.suggest failed: ${error.message}`);
      throw error;
    }

    const rows = data || [];
    const lower = term.toLowerCase();
    const uniq = (values: string[]) =>
      Array.from(new Set(values.filter((v) => v && v.toLowerCase().includes(lower)))).slice(0, 4);

    return {
      parts: rows.slice(0, limit).map((r: any) => ({
        id: r.id,
        name: r.name,
        partNumber: r.partNumber,
        manufacturer: r.manufacturer,
        category: r.category,
        domain: r.domain,
      })),
      manufacturers: uniq(rows.map((r: any) => r.manufacturer)),
      categories: uniq(rows.map((r: any) => r.category)),
    };
  }

  /**
   * Distinct filter values with counts, computed from the real catalogue (cached 60 s).
   */
  static async facets() {
    if (facetsCache && Date.now() - facetsCache.at < FACETS_TTL_MS) return facetsCache.value;

    const [parts, specs] = await Promise.all([
      supabaseAdmin.from("Part").select("manufacturer,category,domain,availability").limit(5000),
      supabaseAdmin.from("PartSpecification").select("label").limit(20000),
    ]);

    if (parts.error) {
      logger.error(`PartsService.facets failed: ${parts.error.message}`);
      throw parts.error;
    }

    const tally = (values: Array<string | null | undefined>) => {
      const counts = new Map<string, number>();
      for (const v of values) {
        const key = (v ?? "").toString().trim();
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value, "en", { numeric: true, sensitivity: "base" }));
    };

    const rows = parts.data || [];
    const value = {
      totalParts: rows.length,
      manufacturers: tally(rows.map((r: any) => r.manufacturer)),
      categories: tally(rows.map((r: any) => r.category)),
      domains: tally(rows.map((r: any) => r.domain)),
      availability: tally(rows.map((r: any) => r.availability)),
      // A missing/blocked PartSpecification table must not break the other facets.
      specLabels: specs.error ? [] : tally((specs.data || []).map((r: any) => r.label)),
    };

    facetsCache = { at: Date.now(), value };
    return value;
  }

  /** Test hook. */
  static clearFacetsCache() {
    facetsCache = null;
  }

  /**
   * Most frequent searches recorded in SearchHistory across all users.
   * Returns `available: false` (not an error) when history cannot be read.
   */
  static async popularSearches(limit = 8) {
    const { data, error } = await supabaseAdmin.from("SearchHistory").select("query,domain").limit(2000);
    if (error) {
      logger.warn(`PartsService.popularSearches unavailable: ${error.message}`);
      return { available: false, searches: [] as Array<{ query: string; domain: string | null; count: number }> };
    }
    const counts = new Map<string, { query: string; domain: string | null; count: number }>();
    for (const row of data || []) {
      const q = String((row as any).query || "").trim();
      if (q.length < 2) continue;
      const key = q.toLowerCase();
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { query: q, domain: (row as any).domain ?? null, count: 1 });
    }
    const searches = Array.from(counts.values())
      .sort((a, b) => b.count - a.count || a.query.localeCompare(b.query))
      .slice(0, limit);
    return { available: true, searches };
  }

  /**
   * Find a single part by ID with its specifications, sources, and claims
   */
  static async getPartById(id: string) {
    try {
      const { data, error } = await supabaseAdmin
        .from("Part")
        .select(PART_SELECT_QUERY)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        logger.error(`Error fetching part ${id} from Supabase: ${error.message}`);
        throw error;
      }

      if (!data) return null;
      return this.formatPartRecord(data);
    } catch (err: any) {
      logger.error(`PartsService.getPartById failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get multiple parts by IDs for comparison
   */
  static async compareParts(ids: string[]) {
    if (ids.length === 0) return [];

    try {
      const { data, error } = await supabaseAdmin
        .from("Part")
        .select(PART_SELECT_QUERY)
        .in("id", ids);

      if (error) {
        logger.error(`Error fetching parts for comparison: ${error.message}`);
        throw error;
      }

      const records = data || [];
      const idMap = new Map(records.map((r: any) => [r.id, this.formatPartRecord(r)]));
      return ids.map((id) => idMap.get(id)).filter(Boolean);
    } catch (err: any) {
      logger.error(`PartsService.compareParts failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Formats a Supabase Part record into the frontend Part interface
   * preserving source information and specification claims
   */
  public static formatPartRecord(part: any) {
    let sourceName = part.isDemo ? "Demo catalogue (placeholder)" : "No source recorded";
    let sourceUrl: string | undefined = undefined;
    let sourceRetrievedAt: string | undefined = undefined;

    if (part.sourceClaims && part.sourceClaims.length > 0) {
      const primaryClaim = part.sourceClaims[0];
      if (primaryClaim.sourceRecord) {
        sourceName = primaryClaim.sourceRecord.name;
        sourceUrl = primaryClaim.sourceRecord.url || undefined;
        sourceRetrievedAt = primaryClaim.sourceRecord.retrievedAt
          ? String(primaryClaim.sourceRecord.retrievedAt)
          : undefined;
      }
    } else if (part.isDemo) {
      // Only invented demo records get the reserved example.com placeholder URL.
      sourceUrl = `https://example.com/demo-catalogue/${part.id}`;
    }

    return {
      id: part.id,
      name: part.name,
      partNumber: part.partNumber,
      manufacturer: part.manufacturer,
      domain: part.domain,
      category: part.category,
      description: part.description,
      availability: part.availability,
      usedIn: part.typicalApplications || [],
      keywords: part.keywords || [],
      isDemo: part.isDemo,
      specs: (part.specs || []).map((s: any) => ({
        label: s.label,
        value: s.value,
        unit: s.unit || undefined,
      })),
      source: {
        name: sourceName,
        url: sourceUrl,
        retrievedAt: sourceRetrievedAt,
      },
      sourceClaims: (part.sourceClaims || []).map((claim: any) => ({
        id: claim.id,
        label: claim.label,
        claimedValue: claim.claimedValue,
        unit: claim.unit,
        evidence: claim.evidence,
        source: {
          id: claim.sourceRecord?.id,
          name: claim.sourceRecord?.name,
          url: claim.sourceRecord?.url,
          isVerified: claim.sourceRecord?.isVerified,
          retrievedAt: claim.sourceRecord?.retrievedAt ? String(claim.sourceRecord.retrievedAt) : undefined,
        },
      })),
    };
  }
}
