import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

/**
 * Recording fake of the Supabase query builder. Every chained call is stored in `calls`,
 * and awaiting the builder resolves with whatever `result` is currently set.
 */
const fake = vi.hoisted(() => {
  const state: {
    tables: Record<string, { data: any[] | null; error: { message: string } | null; count?: number | null }>;
    calls: Array<{ table: string; method: string; args: any[] }>;
  } = { tables: {}, calls: [] };

  function builder(table: string) {
    const proxy: any = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            const res = state.tables[table] ?? { data: [], error: null };
            const payload = { data: res.data, error: res.error, count: res.count ?? res.data?.length ?? 0 };
            return (resolve: any) => resolve(payload);
          }
          return (...args: any[]) => {
            state.calls.push({ table, method: prop, args });
            return proxy;
          };
        },
      }
    );
    return proxy;
  }

  return { state, from: (table: string) => builder(table) };
});

vi.mock("../src/services/supabaseService", () => ({
  supabaseAdmin: { from: fake.from },
  supabaseClient: { from: fake.from },
}));

import app from "../src/app";
import { PartsService, cleanFilterTerm, tokenizeQuery } from "../src/services/partsService";
import { TinyFishService } from "../src/services/tinyFishService";

const part = (id: string, specs: Array<[string, string]>, extra: Record<string, any> = {}) => ({
  id,
  name: `Part ${id}`,
  partNumber: `PN-${id}`,
  manufacturer: "Acme",
  domain: "industrial",
  category: "Bearings",
  description: "desc",
  availability: "in_stock",
  typicalApplications: [],
  keywords: [],
  isDemo: false,
  specs: specs.map(([label, value]) => ({ label, value, unit: null })),
  sourceClaims: [
    { id: `c-${id}`, label: specs[0]?.[0], claimedValue: specs[0]?.[1], sourceRecord: { id: "s1", name: "Acme Datasheets", url: "https://acme.test/ds", isVerified: true } },
  ],
  ...extra,
});

beforeEach(() => {
  fake.state.tables = {};
  fake.state.calls = [];
  PartsService.clearFacetsCache();
});

describe("query sanitising", () => {
  it("strips characters that would break a PostgREST or() filter", () => {
    expect(cleanFilterTerm("seal, (80mm) %kit_")).toBe("seal 80mm kit");
    expect(cleanFilterTerm("a'b\"c{d}")).toBe("a b c d");
  });

  it("splits into at most 6 tokens and keeps part-number punctuation", () => {
    expect(tokenizeQuery("SOT-223 3.3V regulator")).toEqual(["SOT-223", "3.3V", "regulator"]);
    expect(tokenizeQuery("a b c d e f g h")).toHaveLength(6);
    expect(tokenizeQuery("   ,,  ")).toEqual([]);
  });
});

describe("PartsService.searchParts", () => {
  it("ANDs one or() clause per query word and sorts with a stable id tie-break", async () => {
    fake.state.tables.Part = { data: [part("1", [["Bore diameter", "80 mm"]])], error: null, count: 1 };
    await PartsService.searchParts({
      query: "hydraulic seal, kit",
      manufacturer: "",
      category: "",
      model: "",
      specLabel: "",
      specValue: "",
      page: 1,
      limit: 20,
      sort: "name-asc",
    } as any);

    const ors = fake.state.calls.filter((c) => c.method === "or");
    expect(ors).toHaveLength(3); // hydraulic, seal, kit — comma removed, not passed through
    expect(ors[0].args[0]).toContain("name.ilike.%hydraulic%");
    expect(ors[1].args[0]).toContain("partNumber.ilike.%seal%");
    expect(ors.every((c) => !c.args[0].includes("seal,"))).toBe(true);
    const orders = fake.state.calls.filter((c) => c.method === "order").map((c) => c.args[0]);
    expect(orders).toEqual(["name", "id"]);
    const range = fake.state.calls.find((c) => c.method === "range")!;
    expect(range.args).toEqual([0, 19]);
  });

  it("applies category, availability and manufacturer filters in the database", async () => {
    fake.state.tables.Part = { data: [], error: null, count: 0 };
    await PartsService.searchParts({
      query: "",
      manufacturer: "Acme",
      category: "Bearings",
      availability: "limited",
      domain: "industrial",
      model: "",
      specLabel: "",
      specValue: "",
      page: 2,
      limit: 10,
      sort: "manufacturer-desc",
    } as any);
    const by = (m: string) => fake.state.calls.filter((c) => c.method === m);
    expect(by("eq").map((c) => c.args)).toEqual([
      ["domain", "industrial"],
      ["availability", "limited"],
    ]);
    expect(by("ilike").map((c) => c.args[0])).toEqual(["manufacturer", "category"]);
    expect(by("range")[0].args).toEqual([10, 19]);
    expect(by("order")[0].args).toEqual(["manufacturer", { ascending: false }]);
  });

  it("filters by specification in memory, then paginates and reports the true total", async () => {
    fake.state.tables.Part = {
      data: [
        part("1", [["Bore diameter", "80 mm"]]),
        part("2", [["Bore diameter", "60 mm"]]),
        part("3", [["Bore diameter", "80 mm"], ["Rod diameter", "56 mm"]]),
        part("4", [["Width", "80 mm"]]),
      ],
      error: null,
      count: 4,
    };
    const base = { query: "", manufacturer: "", category: "", model: "", sort: "name-asc" } as any;

    const page1 = await PartsService.searchParts({ ...base, specLabel: "bore", specValue: "80", page: 1, limit: 1 });
    expect(page1.total).toBe(2);
    expect(page1.totalPages).toBe(2);
    expect(page1.results.map((r: any) => r.id)).toEqual(["1"]);

    const page2 = await PartsService.searchParts({ ...base, specLabel: "bore", specValue: "80", page: 2, limit: 1 });
    expect(page2.results.map((r: any) => r.id)).toEqual(["3"]);

    // spec filter loads the scan window instead of a DB page
    const ranges = fake.state.calls.filter((c) => c.method === "range");
    expect(ranges[0].args).toEqual([0, 999]);
    expect(page1.truncated).toBe(false);
  });

  it("surfaces database errors instead of returning fake results", async () => {
    fake.state.tables.Part = { data: null, error: { message: "relation missing" } };
    await expect(
      PartsService.searchParts({ query: "x", manufacturer: "", category: "", model: "", specLabel: "", specValue: "" } as any)
    ).rejects.toBeTruthy();
  });
});

describe("PartsService.formatPartRecord", () => {
  it("does not invent an example.com source for a non-demo part with no claims", () => {
    const formatted = PartsService.formatPartRecord(part("9", [["Width", "5 mm"]], { sourceClaims: [], isDemo: false }));
    expect(formatted.source.url).toBeUndefined();
    expect(formatted.source.name).toBe("No source recorded");
  });

  it("keeps the placeholder only for demo records and carries retrievedAt from the source record", () => {
    const demo = PartsService.formatPartRecord(part("d1", [["Width", "5 mm"]], { sourceClaims: [], isDemo: true }));
    expect(demo.source.url).toBe("https://example.com/demo-catalogue/d1");
    const real = PartsService.formatPartRecord(
      part("r1", [["Width", "5 mm"]], {
        sourceClaims: [{ id: "c", label: "Width", claimedValue: "5 mm", sourceRecord: { id: "s", name: "S", url: "https://s.test", retrievedAt: "2026-10-01T00:00:00Z" } }],
      })
    );
    expect(real.source.retrievedAt).toBe("2026-10-01T00:00:00Z");
  });
});

describe("GET /api/parts/suggest", () => {
  it("returns real matching records plus unique manufacturers and categories", async () => {
    fake.state.tables.Part = {
      data: [
        { id: "1", name: "Seal Kit", partNumber: "SK-1", manufacturer: "Northfield", category: "Seals", domain: "industrial" },
        { id: "2", name: "Seal Ring", partNumber: "SR-2", manufacturer: "Northfield", category: "Seals", domain: "industrial" },
      ],
      error: null,
    };
    const res = await request(app).get("/api/parts/suggest?q=seal");
    expect(res.status).toBe(200);
    expect(res.body.data.parts).toHaveLength(2);
    expect(res.body.data.parts[0]).toMatchObject({ id: "1", partNumber: "SK-1" });
    expect(res.body.data.categories).toEqual(["Seals"]);
    // manufacturer "Northfield" does not contain "seal", so it must not be suggested
    expect(res.body.data.manufacturers).toEqual([]);
  });

  it("requires q", async () => {
    const res = await request(app).get("/api/parts/suggest");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/parts/facets", () => {
  it("tallies distinct values from the catalogue and tolerates a missing spec table", async () => {
    fake.state.tables.Part = {
      data: [
        { manufacturer: "Acme", category: "Bearings", domain: "industrial", availability: "in_stock" },
        { manufacturer: "Acme", category: "Seals", domain: "industrial", availability: "limited" },
        { manufacturer: "Beta", category: "Seals", domain: "automotive", availability: "in_stock" },
      ],
      error: null,
    };
    fake.state.tables.PartSpecification = { data: null, error: { message: "denied" } };
    const res = await request(app).get("/api/parts/facets");
    expect(res.status).toBe(200);
    expect(res.body.data.totalParts).toBe(3);
    expect(res.body.data.manufacturers).toEqual([
      { value: "Acme", count: 2 },
      { value: "Beta", count: 1 },
    ]);
    expect(res.body.data.categories.find((c: any) => c.value === "Seals").count).toBe(2);
    expect(res.body.data.specLabels).toEqual([]);
  });

  it("is served by the fixed route, not captured by /:id", async () => {
    fake.state.tables.Part = { data: [], error: null };
    const res = await request(app).get("/api/parts/facets");
    expect(res.body.error?.code).not.toBe("PART_NOT_FOUND");
  });
});

describe("GET /api/parts/popular", () => {
  it("counts repeated searches case-insensitively and ranks them", async () => {
    fake.state.tables.SearchHistory = {
      data: [
        { query: "Brake pad", domain: "automotive" },
        { query: "brake pad", domain: "automotive" },
        { query: "bearing", domain: "industrial" },
        { query: "x", domain: null },
      ],
      error: null,
    };
    const res = await request(app).get("/api/parts/popular");
    expect(res.body.data.available).toBe(true);
    expect(res.body.data.searches).toEqual([
      { query: "Brake pad", domain: "automotive", count: 2 },
      { query: "bearing", domain: "industrial", count: 1 },
    ]);
  });

  it("reports available:false (not a fake list) when history cannot be read", async () => {
    fake.state.tables.SearchHistory = { data: null, error: { message: "no such table" } };
    const res = await request(app).get("/api/parts/popular");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ available: false, searches: [] });
  });
});

describe("TinyFishService.detectPrice", () => {
  const url = "https://shop.test/p/1";

  it("reads a price only from a line that talks about price, keeping the evidence line", () => {
    const price = TinyFishService.detectPrice("# Seal kit\nShips from Ohio\nPrice: $1,249.50 each", url)!;
    expect(price.amount).toBe(1249.5);
    expect(price.raw).toBe("$1,249.50");
    expect(price.evidence).toBe("Price: $1,249.50 each");
    expect(price.sourceUrl).toBe(url);
  });

  it("does not read unrelated money amounts as the part's price", () => {
    expect(TinyFishService.detectPrice("Free shipping over $50\nWarranty: $0 repair fee", url)).toBeUndefined();
  });

  it("maps unambiguous symbols and codes to a currency key, leaves bare $ as $", () => {
    expect(TinyFishService.detectPrice("Price € 12,50", url)).toBeUndefined(); // comma decimal is not guessed
    expect(TinyFishService.detectPrice("Price €12.50", url)!.currencyKey).toBe("EUR");
    expect(TinyFishService.detectPrice("Unit price: USD 9.99", url)!.currencyKey).toBe("USD");
    expect(TinyFishService.detectPrice("Price: ₹1,200", url)!.currencyKey).toBe("INR");
    expect(TinyFishService.detectPrice("Price: $9.99", url)!.currencyKey).toBe("$");
  });

  it("returns undefined when the page lists no price", () => {
    expect(TinyFishService.detectPrice("Bore diameter: 80 mm", url)).toBeUndefined();
  });
});

describe("research progress + streaming", () => {
  const meta = { position: 1, title: "Seal Kit NH-SK80", snippet: "Bore diameter: 80 mm", url: "https://a.test/1", site_name: "A" };
  const page = {
    url: "https://a.test/1",
    title: "Seal Kit NH-SK80",
    format: "markdown",
    text: "Manufacturer: Northfield\nPart Number: NH-SK80\nBore diameter: 80 mm\nOperating pressure: 250 bar\nPrice: $42.00\nIn stock",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("conductResearch emits the real pipeline stages and marks full-page evidence", async () => {
    vi.spyOn(TinyFishService, "searchPages").mockResolvedValueOnce([meta]);
    vi.spyOn(TinyFishService, "fetchPages").mockResolvedValueOnce([page]);
    const events: any[] = [];
    const records = await TinyFishService.conductResearch(
      { query: "seal kit", domain: "industrial", maxResults: 3, persistToDb: false },
      (e) => events.push(e)
    );
    expect(events.map((e) => e.type)).toEqual(["started", "search_done", "fetch_done", "page_processed"]);
    expect(events[3]).toMatchObject({ outcome: "extracted", evidenceLevel: "full_page" });
    expect(records[0].evidenceLevel).toBe("full_page");
    expect(records[0].price?.amount).toBe(42);
  });

  it("marks a record snippet_only when the page itself could not be fetched, and reports the fetch error", async () => {
    vi.spyOn(TinyFishService, "searchPages").mockResolvedValueOnce([meta]);
    vi.spyOn(TinyFishService, "fetchPages").mockImplementationOnce(async (_urls, onErrors) => {
      onErrors?.([{ url: "https://a.test/1", error: "blocked by robots" }]);
      return [];
    });
    const events: any[] = [];
    const records = await TinyFishService.conductResearch(
      { query: "seal kit", domain: "industrial", maxResults: 3, persistToDb: false },
      (e) => events.push(e)
    );
    expect(events.find((e) => e.type === "fetch_done")).toMatchObject({
      fetched: 0,
      failed: [{ url: "https://a.test/1", error: "blocked by robots" }],
    });
    expect(records[0].evidenceLevel).toBe("snippet_only");
  });

  it("a throwing progress listener never breaks research", async () => {
    vi.spyOn(TinyFishService, "searchPages").mockResolvedValueOnce([]);
    const out = await TinyFishService.conductResearch(
      { query: "x y", domain: "industrial", maxResults: 1, persistToDb: false },
      () => {
        throw new Error("listener bug");
      }
    );
    expect(out).toEqual([]);
  });

  it("POST /api/research/stream streams NDJSON events ending in a complete event", async () => {
    vi.spyOn(TinyFishService, "searchPages").mockResolvedValueOnce([meta]);
    vi.spyOn(TinyFishService, "fetchPages").mockResolvedValueOnce([page]);
    const res = await request(app)
      .post("/api/research/stream")
      .send({ query: "seal kit", domain: "industrial", maxResults: 2 })
      .buffer(true)
      .parse((r, cb) => {
        let data = "";
        r.on("data", (c) => (data += c));
        r.on("end", () => cb(null, data));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/x-ndjson");
    const lines = String(res.body).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.map((l) => l.type)).toEqual(["started", "search_done", "fetch_done", "page_processed", "complete"]);
    expect(lines.at(-1).data.results[0]).toMatchObject({ partNumber: "NH-SK80", isDemo: false });
  });

  it("streams a structured error event (with code) when research fails", async () => {
    vi.spyOn(TinyFishService, "conductResearch").mockRejectedValueOnce(
      Object.assign(new Error("Live supplier research is not configured."), { status: 503, code: "TINYFISH_NOT_CONFIGURED" })
    );
    const res = await request(app)
      .post("/api/research/stream")
      .send({ query: "seal kit", domain: "industrial" })
      .buffer(true)
      .parse((r, cb) => {
        let data = "";
        r.on("data", (c) => (data += c));
        r.on("end", () => cb(null, data));
      });
    const last = JSON.parse(String(res.body).trim().split("\n").at(-1)!);
    expect(last).toMatchObject({ type: "error", error: { code: "TINYFISH_NOT_CONFIGURED", status: 503 } });
  });

  it("validates the stream request body like the non-streaming route", async () => {
    const res = await request(app).post("/api/research/stream").send({ domain: "industrial" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("reports TINYFISH_NOT_CONFIGURED (503) when the API key is absent", async () => {
    const { config } = await import("../src/config");
    const previous = config.TINYFISH_API_KEY;
    (config as any).TINYFISH_API_KEY = undefined;
    try {
      await expect(TinyFishService.searchPages("anything", 1)).rejects.toMatchObject({
        status: 503,
        code: "TINYFISH_NOT_CONFIGURED",
      });
    } finally {
      (config as any).TINYFISH_API_KEY = previous;
    }
  });
});

describe("POST /api/compatibility/check with candidate parts", () => {
  const requirements = [
    { id: "ind.bore", label: "Bore diameter", expectedValue: "80", expectedUnit: "mm", rule: "number-equals", mandatory: true, specLabels: ["Bore diameter"] },
  ];
  const candidate = {
    id: "tf-1",
    name: "Seal kit",
    partNumber: "SK-1",
    manufacturer: "Acme",
    domain: "industrial",
    specs: [{ label: "Bore diameter", value: "80 mm", unit: "mm" }],
    source: { name: "Acme", url: "https://acme.test/sk1" },
  };

  it("assesses a researched candidate and returns PASS-able result with its source as evidence", async () => {
    const res = await request(app)
      .post("/api/compatibility/check")
      .send({ candidateParts: [candidate], domain: "industrial", requirements });
    expect(res.status).toBe(200);
    const a = res.body.data.assessments[0];
    expect(a.status).toBe("POTENTIAL_MATCH");
    expect(a.requirements[0].result).toBe("pass");
    expect(a.requirements[0].supportingSource.sourceUrl).toBe("https://acme.test/sk1");
  });

  it("flags conflicting claims on a researched candidate as UNVERIFIED instead of passing it", async () => {
    const res = await request(app)
      .post("/api/compatibility/check")
      .send({
        candidateParts: [
          {
            ...candidate,
            sourceClaims: [
              { label: "Bore diameter", claimedValue: "80 mm", sourceUrl: "https://acme.test/sk1" },
              { label: "Bore diameter", claimedValue: "85 mm", sourceUrl: "https://acme.test/sk1" },
            ],
          },
        ],
        domain: "industrial",
        requirements,
      });
    const a = res.body.data.assessments[0];
    expect(a.status).toBe("UNVERIFIED");
    expect(a.requirements[0].conflictingClaims).toHaveLength(2);
  });

  it("reports MISMATCH when the sourced value fails a mandatory requirement", async () => {
    const res = await request(app)
      .post("/api/compatibility/check")
      .send({
        candidateParts: [{ ...candidate, specs: [{ label: "Bore diameter", value: "63 mm", unit: "mm" }] }],
        domain: "industrial",
        requirements,
      });
    expect(res.body.data.assessments[0].status).toBe("MISMATCH");
  });

  it("does not assess the same part twice when it is sent by id and as a candidate", async () => {
    vi.spyOn(PartsService, "compareParts").mockResolvedValueOnce([{ ...candidate, id: "db-1" }] as any);
    const res = await request(app)
      .post("/api/compatibility/check")
      .send({ partIds: ["db-1"], candidateParts: [{ ...candidate, id: "db-1" }], domain: "industrial", requirements });
    expect(res.body.data.totalAssessed).toBe(1);
  });

  it("still assesses candidates sent in full when the database lookup by id fails", async () => {
    vi.spyOn(PartsService, "compareParts").mockRejectedValueOnce(new Error("db down"));
    const res = await request(app)
      .post("/api/compatibility/check")
      .send({ partIds: ["tf-1"], candidateParts: [candidate], domain: "industrial", requirements });
    expect(res.status).toBe(200);
    expect(res.body.data.assessments[0].status).toBe("POTENTIAL_MATCH");
  });

  it("returns an error (not a guess) when the database lookup fails and no candidate covers the id", async () => {
    vi.spyOn(PartsService, "compareParts").mockRejectedValueOnce(new Error("db down"));
    const res = await request(app)
      .post("/api/compatibility/check")
      .send({ partIds: ["db-9"], candidateParts: [candidate], domain: "industrial", requirements });
    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  it("keeps per-claim evidence and conflicts for catalogue records loaded by id", async () => {
    const claim = (value: string) => ({
      label: "Bore diameter",
      claimedValue: value,
      evidence: `Bore diameter: ${value}`,
      source: { name: "Acme Datasheets", url: "https://acme.test/ds", isVerified: false },
    });
    vi.spyOn(PartsService, "compareParts").mockResolvedValueOnce([
      { ...candidate, id: "db-2", sourceClaims: [claim("80 mm")] },
    ] as any);
    const ok = await request(app)
      .post("/api/compatibility/check")
      .send({ partIds: ["db-2"], domain: "industrial", requirements });
    expect(ok.body.data.assessments[0].requirements[0].supportingSource.claimEvidence).toBe("Bore diameter: 80 mm");

    vi.spyOn(PartsService, "compareParts").mockResolvedValueOnce([
      { ...candidate, id: "db-3", sourceClaims: [claim("80 mm"), claim("85 mm")] },
    ] as any);
    const conflict = await request(app)
      .post("/api/compatibility/check")
      .send({ partIds: ["db-3"], domain: "industrial", requirements });
    const a = conflict.body.data.assessments[0];
    expect(a.status).toBe("UNVERIFIED");
    expect(a.requirements[0].conflictingClaims[0].sourceName).toBe("Acme Datasheets");
  });
});
