// src/services/tinyFishService.ts
import { config } from "../config";
import { logger } from "../utils/logger";
import { UnitConversionService } from "./unitConversionService";
import {
  ResearchSearchRequest,
  ResearchedPartRecord,
  ExtractedSpec,
  ListedPrice,
  ResearchProgressEvent,
} from "../schemas/researchSchemas";
import { supabaseAdmin } from "./supabaseService";

export interface TinyFishSearchResultItem {
  position: number;
  site_name?: string;
  title: string;
  snippet: string;
  url: string;
}

export interface TinyFishSearchResponse {
  query: string;
  results: TinyFishSearchResultItem[];
  total_results: number;
  page?: number;
}

export interface TinyFishFetchPageResult {
  url: string;
  title: string;
  text: string;
  format: string;
}

export interface TinyFishFetchResponse {
  results: TinyFishFetchPageResult[];
  errors?: Array<{ url: string; error: string }>;
}

export class TinyFishService {
  /**
   * Safe HTTP fetch with bounded timeout, retries, and rate limit handling
   */
  private static async requestWithRetry<T>(
    url: string,
    options: RequestInit,
    retries = config.TINYFISH_MAX_RETRIES
  ): Promise<T> {
    const apiKey = config.TINYFISH_API_KEY;
    if (!apiKey) {
      throw Object.assign(
        new Error("Live supplier research is not configured: TINYFISH_API_KEY is missing on the server."),
        { status: 503, code: "TINYFISH_NOT_CONFIGURED" }
      );
    }

    const headers: Record<string, string> = {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    let attempt = 0;
    while (attempt <= retries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.TINYFISH_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          const retryAfter = Number(response.headers.get("retry-after")) || 1;
          logger.warn(`TinyFish rate limit encountered (429). Retrying after ${retryAfter}s...`);
          if (attempt <= retries) {
            await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
            continue;
          }
          throw Object.assign(new Error("TinyFish API rate limit exceeded."), {
            status: 429,
            code: "TINYFISH_RATE_LIMIT",
          });
        }

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          throw Object.assign(
            new Error(`TinyFish API responded with status ${response.status}: ${errText}`),
            { status: response.status, code: "TINYFISH_API_ERROR" }
          );
        }

        return (await response.json()) as T;
      } catch (err: any) {
        clearTimeout(timeoutId);

        if (err.name === "AbortError") {
          logger.warn(`TinyFish request timed out after ${config.TINYFISH_TIMEOUT_MS}ms (attempt ${attempt})`);
          if (attempt <= retries) continue;
          throw Object.assign(new Error("TinyFish request timed out."), {
            status: 504,
            code: "TINYFISH_TIMEOUT",
          });
        }

        if (attempt <= retries && err.code !== "TINYFISH_RATE_LIMIT") {
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          continue;
        }

        throw err;
      }
    }

    throw new Error("TinyFish request failed after maximum retries.");
  }

  /**
   * Search for supplier/datasheet pages using TinyFish Search API
   */
  static async searchPages(query: string, maxResults = 5): Promise<TinyFishSearchResultItem[]> {
    const endpoint = `${config.TINYFISH_SEARCH_ENDPOINT}?query=${encodeURIComponent(
      query
    )}&purpose=Locate+technical+datasheet+and+supplier+specifications`;

    const data = await this.requestWithRetry<TinyFishSearchResponse>(endpoint, {
      method: "GET",
    });

    if (!data || !Array.isArray(data.results)) {
      return [];
    }

    return data.results.slice(0, maxResults);
  }

  /**
   * Fetch rendered markdown content for discovered URLs using TinyFish Fetch API
   */
  static async fetchPages(
    urls: string[],
    onErrors?: (errors: Array<{ url: string; error: string }>) => void
  ): Promise<TinyFishFetchPageResult[]> {
    if (urls.length === 0) return [];

    const endpoint = config.TINYFISH_FETCH_ENDPOINT;
    const body = {
      urls: urls.slice(0, 10),
      purpose: "Extract technical specifications, manufacturer, and availability for parts catalogue",
      format: "markdown",
    };

    const data = await this.requestWithRetry<TinyFishFetchResponse>(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (onErrors && Array.isArray(data.errors) && data.errors.length > 0) onErrors(data.errors);
    return data.results || [];
  }

  /**
   * Orchestrates full research workflow:
   * 1. Query search -> 2. Page fetch -> 3. Content parsing & extraction -> 4. Normalization -> 5. Optional DB persistence
   */
  static async conductResearch(
    params: ResearchSearchRequest,
    onProgress?: (event: ResearchProgressEvent) => void
  ): Promise<ResearchedPartRecord[]> {
    const { query, domain, manufacturer, model, maxResults = 5, persistToDb = false } = params;
    const emit = (event: ResearchProgressEvent) => {
      try {
        onProgress?.(event);
      } catch {
        // A failing progress listener must never break research.
      }
    };

    let searchQuery = query;
    if (manufacturer && !searchQuery.toLowerCase().includes(manufacturer.toLowerCase())) {
      searchQuery = `${manufacturer} ${searchQuery}`;
    }
    if (model && !searchQuery.toLowerCase().includes(model.toLowerCase())) {
      searchQuery = `${searchQuery} ${model}`;
    }
    emit({ type: "started", query, searchQuery, maxResults });

    // 1. Discover relevant supplier & technical pages
    const searchResults = await this.searchPages(searchQuery, maxResults);
    emit({
      type: "search_done",
      count: searchResults.length,
      results: searchResults.map((r) => ({ url: r.url, title: r.title, siteName: r.site_name })),
    });
    if (searchResults.length === 0) {
      return [];
    }

    const urls = searchResults.map((r) => r.url).filter(Boolean);

    // 2. Fetch page contents
    let fetchErrors: Array<{ url: string; error: string }> = [];
    const fetchedPages = await this.fetchPages(urls, (errs) => {
      fetchErrors = errs;
    });
    emit({ type: "fetch_done", fetched: fetchedPages.length, failed: fetchErrors });
    const fetchErrorByUrl = new Map(fetchErrors.map((e) => [e.url, e.error]));

    // 3. Extract and normalize records from each search result
    const records: ResearchedPartRecord[] = [];
    const fetchedMap = new Map(fetchedPages.map((p) => [p.url, p]));

    for (const searchItem of searchResults) {
      const fetched = fetchedMap.get(searchItem.url);
      const evidenceLevel: "full_page" | "snippet_only" = fetched ? "full_page" : "snippet_only";
      const page = fetched || {
        url: searchItem.url,
        title: searchItem.title,
        text: searchItem.snippet,
        format: "markdown",
      };

      let extracted: ResearchedPartRecord | null = null;
      try {
        extracted = this.extractPartFromPageContent(page, searchItem, domain, manufacturer);
      } catch (err: any) {
        emit({
          type: "page_processed",
          url: searchItem.url,
          outcome: "skipped",
          reason: `Could not parse this page (${err.message}).`,
          evidenceLevel,
        });
        continue;
      }

      if (extracted) {
        extracted.evidenceLevel = evidenceLevel;
        records.push(extracted);
        emit({
          type: "page_processed",
          url: searchItem.url,
          outcome: "extracted",
          partId: extracted.id,
          specCount: extracted.specs.length,
          evidenceLevel,
        });
      } else {
        emit({
          type: "page_processed",
          url: searchItem.url,
          outcome: "skipped",
          reason: fetchErrorByUrl.get(searchItem.url) || "Not enough readable content on this page.",
          evidenceLevel,
        });
      }
    }

    // 4. Persistence to Supabase
    if (persistToDb && records.length > 0) {
      await this.persistResearchedRecords(records);
      emit({ type: "persisted", count: records.length });
    }

    return records;
  }

  /**
   * Extract source-backed technical specs from page content
   */
  static extractPartFromPageContent(
    page: TinyFishFetchPageResult,
    searchMeta: TinyFishSearchResultItem | undefined,
    domain: "industrial" | "electronics" | "automotive",
    defaultManufacturer?: string
  ): ResearchedPartRecord | null {
    const text = page.text || "";
    const snippet = searchMeta?.snippet || "";
    if ((!text || text.length < 50) && !snippet) return null;

    const title = page.title || searchMeta?.title || "Discovered Part";
    const siteName = searchMeta?.site_name || new URL(page.url).hostname;

    // Detect Part Number and Manufacturer
    const extractedMfr = this.detectManufacturer(text, title, defaultManufacturer);
    const extractedPartNumber = this.detectPartNumber(text, title, page.url);

    // Extract specifications (checks both page markdown text and snippet fallback)
    const extractedSpecs = this.parseTechnicalSpecs(text, snippet, page.url, domain);

    // Detect availability
    const availability = this.detectAvailability(text);

    // Detect typical applications
    const usedIn = this.detectApplications(text, snippet);

    // Detect a listed price (only from page text; never estimated)
    const price = this.detectPrice(text, page.url);

    // Detect clean description
    const description = this.detectDescription(text, title, snippet);

    // Group specs to detect conflicting claims across distinct sections
    const specsMap = new Map<string, string>();
    const conflictingList: Array<{ label: string; claims: Array<{ value: string; sourceUrl: string }> }> = [];

    for (const spec of extractedSpecs) {
      const key = spec.label.toLowerCase();
      if (!specsMap.has(key)) {
        specsMap.set(key, spec.value);
      } else {
        const existing = specsMap.get(key)!;
        if (existing.toLowerCase() !== spec.value.toLowerCase()) {
          conflictingList.push({
            label: spec.label,
            claims: [
              { value: existing, sourceUrl: page.url },
              { value: spec.value, sourceUrl: page.url },
            ],
          });
        }
      }
    }

    // Build unique deterministic ID based on URL host and part number
    const cleanId = `tf-${siteName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${extractedPartNumber
      .replace(/[^a-z0-9]/gi, "-")
      .toLowerCase()}`.slice(0, 36);

    return {
      id: cleanId,
      name: title.slice(0, 80),
      partNumber: extractedPartNumber,
      manufacturer: extractedMfr,
      domain,
      category: this.detectCategory(text + " " + title, domain),
      description,
      availability,
      usedIn,
      keywords: [extractedMfr.toLowerCase(), domain, ...title.toLowerCase().split(/\s+/).slice(0, 5)],
      isDemo: false,
      specs: extractedSpecs.map((s) => ({
        label: s.label,
        value: s.value,
        unit: s.unit,
      })),
      source: {
        name: siteName,
        url: page.url,
        retrievedAt: new Date().toISOString(),
      },
      sourceClaims: extractedSpecs.map((s) => ({
        label: s.label,
        claimedValue: s.value,
        unit: s.unit,
        evidence: s.evidence,
        sourceUrl: s.sourceUrl,
      })),
      price,
      conflictingSpecs: conflictingList.length > 0 ? conflictingList : undefined,
    };
  }

  /**
   * Finds a price printed on the page. Only lines that mention price/cost/each (or MSRP)
   * and contain a currency amount are considered, so unrelated numbers are not read as prices.
   * Returns undefined when nothing qualifies.
   */
  static detectPrice(text: string, url: string): ListedPrice | undefined {
    const amountPattern =
      /(US\$|USD|EUR|GBP|INR|JPY|CAD|AUD|CHF|Rs\.?|[$€£₹¥])\s?([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)(?![0-9]|,[0-9])/i;
    const contextPattern = /\b(price|cost|each|msrp|unit price|your price|list price)\b/i;
    const symbolCodes: Record<string, string> = { "€": "EUR", "£": "GBP", "₹": "INR", "rs": "INR", "rs.": "INR", "us$": "USD" };

    for (const rawLine of text.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.length > 300 || !contextPattern.test(line)) continue;
      const match = amountPattern.exec(line);
      if (!match) continue;
      const amount = Number(match[2].replace(/,/g, ""));
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const token = match[1];
      const upper = token.toUpperCase();
      const currencyKey =
        /^[A-Z]{3}$/.test(upper) ? upper : symbolCodes[token.toLowerCase()] || token;
      return {
        amount,
        currencyKey,
        raw: `${token}${match[2]}`,
        evidence: line.replace(/[*`_]/g, "").slice(0, 160),
        sourceUrl: url,
      };
    }
    return undefined;
  }

  /**
   * Parse technical specifications from page markdown text or snippet
   */
  private static parseTechnicalSpecs(
    text: string,
    snippet: string,
    url: string,
    domain: string
  ): ExtractedSpec[] {
    const specs: ExtractedSpec[] = [];
    const seen = new Set<string>();

    const specPatterns: Array<{ label: string; regex: RegExp }> = [
      { label: "Bore diameter", regex: /(?:bore(?:\s+diameter)?|inner\s+diameter|id)[\s:|]+([0-9.]+\s*(?:mm|in|inch|inches|["”])?)|([0-9.]+\s*(?:mm|in|inch|inches|["”]))\s*(?:bore)/i },
      { label: "Rod diameter", regex: /(?:rod(?:\s+diameter)?)[\s:|]+([0-9.]+\s*(?:mm|in|inch|inches|["”])?)|([0-9.]+\s*(?:mm|in|inch|inches|["”]))\s*(?:rod)/i },
      { label: "Outer diameter", regex: /(?:outside\s+diameter|outer\s+diameter|od)[\s:|]+([0-9.]+\s*(?:mm|in|inch|inches)?)/i },
      { label: "Width", regex: /(?:width|thickness)[\s:|]+([0-9.]+\s*(?:mm|in|inch|inches)?)/i },
      { label: "Operating pressure", regex: /(?:operating\s+pressure|max\s+pressure|working\s+pressure|pressure)[\s:|]+([0-9.]+\s*(?:bar|psi|mpa|kpa))/i },
      { label: "Operating temperature", regex: /(?:temperature\s+range|operating\s+temperature)[\s:|]+([^\n\r|;]+°?C)/i },
      { label: "Operating voltage", regex: /(?:operating\s+voltage|input\s+voltage|supply\s+voltage|voltage\s+rating)[\s:|]+([0-9.]+\s*(?:v|kv|mv))/i },
      { label: "Current rating", regex: /(?:current\s+rating|output\s+current|continuous\s+current)[\s:|]+([0-9.]+\s*(?:a|ma))/i },
      { label: "Speed rating", regex: /(?:speed\s+rating|max\s+speed|rated\s+speed)[\s:|]+([0-9.]+\s*(?:rpm))/i },
      { label: "Dynamic load rating", regex: /(?:basic\s+dynamic\s+load\s+rating|dynamic\s+load\s+rating|load)[\s:|]+([0-9.]+\s*(?:kn|n|lbf))/i },
      { label: "Static load rating", regex: /(?:basic\s+static\s+load\s+rating|static\s+load\s+rating)[\s:|]+([0-9.]+\s*(?:kn|n|lbf))/i },
      { label: "Package", regex: /(?:package|package\s+type)[\s:|]+([a-zA-Z0-9\-_]+)/i },
      { label: "Seal material", regex: /(?:seal\s+material|material)[\s:|]+([^\n\r|;]+)/i },
      { label: "Thread", regex: /(?:thread|thread\s+size)[\s:|]+([^\n\r|;]+)/i },
      { label: "Axle position", regex: /(?:axle\s+position|position)[\s:|]+([^\n\r|;]+)/i },
    ];

    // 1. First parse through page text lines (including markdown tables)
    const lines = text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.includes("agree to the following terms")) continue;

      for (const { label, regex } of specPatterns) {
        const match = regex.exec(trimmed);
        const matchedVal = match ? (match[1] || match[2]) : null;
        if (matchedVal) {
          const rawValue = matchedVal.trim().replace(/[*`_]/g, "");
          const parsed = UnitConversionService.parseQuantityString(rawValue);
          const unit = parsed?.unit || undefined;

          if (rawValue.length > 0 && rawValue.length < 50) {
            specs.push({
              label,
              value: rawValue,
              unit,
              evidence: trimmed.slice(0, 120),
              sourceUrl: url,
            });
            break;
          }
        }
      }
    }

    // 2. If page text yielded very few specs, fallback to parsing snippet (e.g. Google/Bing snippet often has spec lines)
    if (specs.length < 2 && snippet) {
      const parts = snippet.split(/[;,]/);
      for (const part of parts) {
        const trimmed = part.trim();
        for (const { label, regex } of specPatterns) {
          if (seen.has(label.toLowerCase())) continue;
          const match = regex.exec(trimmed);
          const matchedVal = match ? (match[1] || match[2]) : null;
          if (matchedVal) {
            const rawValue = matchedVal.trim().replace(/[*`_]/g, "");
            const parsed = UnitConversionService.parseQuantityString(rawValue);
            const unit = parsed?.unit || undefined;

            if (rawValue.length > 0 && rawValue.length < 50) {
              seen.add(label.toLowerCase());
              specs.push({
                label,
                value: rawValue,
                unit,
                evidence: `Discovered from supplier datasheet snippet: ${trimmed}`,
                sourceUrl: url,
              });
            }
          }
        }
      }
    }

    return specs;
  }

  private static detectManufacturer(text: string, title: string, fallback?: string): string {
    if (fallback && fallback.trim()) return fallback.trim();
    const match = /(?:manufacturer|brand|made by)[\s:]+([^\n\r]+)/i.exec(text);
    if (match && match[1]) {
      const val = match[1].trim();
      if (!val.toLowerCase().includes("disclaimer") && !val.toLowerCase().includes("privacy")) {
        return val.slice(0, 40);
      }
    }
    const titleParts = title.split(/[-–|]/);
    if (titleParts.length > 1) {
      const last = titleParts[titleParts.length - 1].trim();
      if (last.length > 2 && last.length < 40) return last;
    }
    return "Verified Supplier";
  }

  private static detectPartNumber(text: string, title: string, url: string): string {
    const pnMatch = /(?:part\s*(?:number|no|#)|mpn|p\/n)[\s:]+([a-zA-Z0-9\-_./]+)/i.exec(text);
    if (pnMatch && pnMatch[1] && pnMatch[1].length > 2) {
      return pnMatch[1].trim().slice(0, 30);
    }
    const tokenMatch = /\b[A-Z0-9]{3,}-[A-Z0-9]{2,}\b/.exec(title);
    if (tokenMatch) {
      return tokenMatch[0];
    }
    // Extract alphanumeric model from URL or title
    const urlModelMatch = /(?:productid-|item-|p-)([a-zA-Z0-9\-_]+)/i.exec(url);
    if (urlModelMatch && urlModelMatch[1]) {
      return urlModelMatch[1].toUpperCase();
    }

    // Deterministic slug based on title
    const firstWord = title.trim().split(/\s+/)[0];
    if (firstWord && /^[a-zA-Z0-9\-_]+$/.test(firstWord) && firstWord.length > 2) {
      return firstWord.toUpperCase();
    }

    // Deterministic hash based on URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      hash = (hash << 5) - hash + url.charCodeAt(i);
      hash |= 0;
    }
    return `PN-${Math.abs(hash) % 1000000}`;
  }

  private static detectAvailability(text: string): "in_stock" | "limited" | "out_of_stock" | "unknown" {
    const lower = text.toLowerCase();
    if (lower.includes("in stock") || lower.includes("available now") || lower.includes("ready to dispatch")) {
      return "in_stock";
    }
    if (lower.includes("limited stock") || lower.includes("few remaining")) return "limited";
    if (lower.includes("out of stock") || lower.includes("backorder")) return "out_of_stock";
    return "unknown";
  }

  private static detectApplications(text: string, snippet: string): string[] {
    const lines = text.split("\n");
    for (const line of lines) {
      if (
        line.toLowerCase().includes("trademark") ||
        line.toLowerCase().includes("disclaimer") ||
        line.toLowerCase().includes("without prior written") ||
        line.toLowerCase().includes("patents owned")
      ) {
        continue;
      }
      const match = /(?:applications|used in|compatible with)[\s:]+([^\n\r]+)/i.exec(line);
      if (match && match[1]) {
        return match[1]
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter((s) => s.length > 2 && s.length < 50)
          .slice(0, 4);
      }
    }
    return [];
  }

  private static detectDescription(text: string, title: string, snippet: string): string {
    // Look for a clean description sentence that is not a legal or cookie warning
    const paragraphs = text.split(/\n\s*\n/);
    for (const p of paragraphs) {
      const clean = p.replace(/\s+/g, " ").trim();
      const lower = clean.toLowerCase();
      if (
        clean.length > 40 &&
        !lower.includes("cookie") &&
        !lower.includes("terms and conditions") &&
        !lower.includes("by accessing and using") &&
        !lower.includes("disclaims all warranties") &&
        !lower.includes("privacy policy")
      ) {
        return clean.slice(0, 240);
      }
    }
    if (snippet && snippet.length > 20) {
      return snippet.slice(0, 240).trim();
    }
    return `${title} technical datasheet and specification record.`;
  }

  private static detectCategory(text: string, domain: string): string {
    const lower = text.toLowerCase();
    if (domain === "industrial") {
      if (lower.includes("seal") || lower.includes("gasket")) return "Seals & Gaskets";
      if (lower.includes("bearing")) return "Bearings";
      if (lower.includes("pump")) return "Pumps";
      if (lower.includes("drive") || lower.includes("vfd")) return "Motor Drives";
      return "Industrial Components";
    }
    if (domain === "electronics") {
      if (lower.includes("regulator") || lower.includes("power")) return "Power Management";
      if (lower.includes("mcu") || lower.includes("microcontroller")) return "Microcontrollers";
      if (lower.includes("capacitor")) return "Capacitors";
      if (lower.includes("connector") || lower.includes("usb")) return "Connectors";
      return "Semiconductors";
    }
    if (domain === "automotive") {
      if (lower.includes("brake")) return "Brakes";
      if (lower.includes("filter")) return "Filters";
      if (lower.includes("spark") || lower.includes("ignition")) return "Ignition";
      if (lower.includes("alternator")) return "Electrical";
      return "Auto Parts";
    }
    return "General Parts";
  }

  /**
   * Persist researched part and source claims into Supabase PostgreSQL
   */
  private static async persistResearchedRecords(records: ResearchedPartRecord[]): Promise<void> {
    for (const r of records) {
      try {
        const now = new Date().toISOString();
        const sourceRecordId = `src-${r.source.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
        await supabaseAdmin.from("SourceRecord").upsert({
          id: sourceRecordId,
          name: r.source.name,
          url: r.source.url,
          isVerified: true,
          retrievedAt: now,
          updatedAt: now,
        });

        await supabaseAdmin.from("Part").upsert({
          id: r.id,
          name: r.name,
          partNumber: r.partNumber,
          manufacturer: r.manufacturer,
          domain: r.domain,
          category: r.category,
          description: r.description,
          availability: r.availability,
          typicalApplications: r.usedIn,
          keywords: r.keywords,
          isDemo: false,
          updatedAt: now,
        });

        // Persist PartSpecification records so the specs exist in database queries
        for (const spec of r.specs) {
          const specId = `spec-${r.id}-${spec.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
          await supabaseAdmin.from("PartSpecification").upsert({
            id: specId,
            partId: r.id,
            label: spec.label,
            value: spec.value,
            unit: spec.unit || null,
            updatedAt: now,
          });
        }

        // Persist SpecificationClaim records for provenance evidence
        for (const claim of r.sourceClaims) {
          const claimId = `claim-${r.id}-${claim.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
          await supabaseAdmin.from("SpecificationClaim").upsert({
            id: claimId,
            partId: r.id,
            sourceRecordId: sourceRecordId,
            label: claim.label,
            claimedValue: claim.claimedValue,
            unit: claim.unit || null,
            evidence: claim.evidence,
          });
        }
      } catch (err: any) {
        logger.warn(`Could not persist researched part '${r.id}' to Supabase: ${err.message}`);
      }
    }
  }
}
