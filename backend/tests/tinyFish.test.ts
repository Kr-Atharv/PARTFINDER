import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/app";
import { TinyFishService } from "../src/services/tinyFishService";
import { config } from "../src/config";

describe("TinyFish Research Service & Parser", () => {
  const sampleFetchedPage = {
    url: "https://industrial-seals-direct.com/cylinder-kit-sk80",
    title: "Heavy Duty Cylinder Seal Kit NH-SK80 | Industrial Seals Direct",
    format: "markdown",
    text: `
# Heavy Duty Cylinder Seal Kit NH-SK80
Manufacturer: Northfield Hydraulics
Part Number: NH-SK80-REV2
In Stock and ready to dispatch.

## Technical Specifications
- Bore diameter: 80 mm
- Operating pressure: 250 bar
- Temperature range: -30 to 100 °C
- Seal material: Polyurethane / NBR
- Dynamic load rating: 45 kN

Applications: Hydraulic press cylinders, Material handling lifts
    `,
  };

  it("extractPartFromPageContent extracts specifications, manufacturer and preserves source URL", () => {
    const record = TinyFishService.extractPartFromPageContent(
      sampleFetchedPage,
      {
        position: 1,
        title: sampleFetchedPage.title,
        url: sampleFetchedPage.url,
        snippet: "Heavy duty cylinder kit",
        site_name: "Industrial Seals Direct",
      },
      "industrial",
      "Northfield Hydraulics"
    );

    expect(record).not.toBeNull();
    expect(record?.manufacturer).toBe("Northfield Hydraulics");
    expect(record?.partNumber).toBe("NH-SK80-REV2");
    expect(record?.availability).toBe("in_stock");
    expect(record?.isDemo).toBe(false);
    expect(record?.source.url).toBe("https://industrial-seals-direct.com/cylinder-kit-sk80");
    expect(record?.source.name).toBe("Industrial Seals Direct");

    // Check extracted specs
    const boreSpec = record?.specs.find((s) => s.label.toLowerCase().includes("bore diameter"));
    expect(boreSpec).toBeDefined();
    expect(boreSpec?.value).toBe("80 mm");
    expect(boreSpec?.unit).toBe("mm");

    const pressureSpec = record?.specs.find((s) => s.label.toLowerCase().includes("pressure"));
    expect(pressureSpec).toBeDefined();
    expect(pressureSpec?.value).toBe("250 bar");
    expect(pressureSpec?.unit).toBe("bar");
  });

  it("Detects conflicting specifications across multiple sections of page", () => {
    const conflictingPage = {
      url: "https://conflicting-vendor.com/product-1",
      title: "Cylinder Seal",
      format: "markdown",
      text: `
Bore diameter: 80 mm
Some description text here...
Bore diameter: 85 mm
      `,
    };

    const record = TinyFishService.extractPartFromPageContent(
      conflictingPage,
      undefined,
      "industrial"
    );

    expect(record?.conflictingSpecs).toBeDefined();
    expect(record?.conflictingSpecs?.length).toBeGreaterThan(0);
    expect(record?.conflictingSpecs?.[0].label).toContain("Bore");
  });

  it("filters disallowed domains and verifies authentic manufacturer and distributor tiers", () => {
    expect(TinyFishService.isDisallowedDomain("https://www.youtube.com/watch?v=123")).toBe(true);
    expect(TinyFishService.isDisallowedDomain("https://reddit.com/r/engineering")).toBe(true);
    expect(TinyFishService.isDisallowedDomain("https://www.skf.com/products/6205")).toBe(false);
    expect(TinyFishService.isDisallowedDomain("https://www.mouser.com/ProductDetail/123")).toBe(false);

    expect(TinyFishService.getVerificationTier("https://www.skf.com/us/products/6205")).toBe("official_manufacturer");
    expect(TinyFishService.getVerificationTier("https://www.festo.com/pneumatic-valves")).toBe("official_manufacturer");
    expect(TinyFishService.getVerificationTier("https://www.digikey.com/product-detail/123")).toBe("authorized_distributor");
    expect(TinyFishService.getVerificationTier("https://www.mcmaster.com/bearings")).toBe("authorized_distributor");
    expect(TinyFishService.getVerificationTier("https://general-industrial-supply.com/item")).toBe("verified_supplier");
  });

  it("extracts comprehensive category-aware technical specifications including dimensions, pressure, flow, and electrical", () => {
    const valvePage = {
      url: "https://www.parker.com/valves/d1vw",
      title: "Directional Control Valve D1VW | Parker Hannifin",
      format: "markdown",
      text: `
# Parker D1VW Directional Control Valve
Manufacturer: Parker Hannifin
Part Number: D1VW001CNJW
Operating pressure: 350 bar
Flow rate: 80 l/min
Port size: 1/4" NPT
Operating voltage: 24 V
Current rating: 1.5 A
Power rating: 36 W
Operating temperature: -20 to 70 °C
Weight: 2.1 kg
Material: Cast Iron
Thread: G 1/4
Speed rating: 1800 rpm
Tolerance: ±0.05 mm
Ships from: Cleveland Warehouse, USA
Compatible with: Haas CNC milling machines
      `,
    };

    const record = TinyFishService.extractPartFromPageContent(
      valvePage,
      {
        position: 1,
        title: valvePage.title,
        url: valvePage.url,
        snippet: "Directional control valve",
        site_name: "Parker Hannifin",
      },
      "industrial"
    );

    expect(record).not.toBeNull();
    expect(record?.verificationTier).toBe("official_manufacturer");
    expect(record?.source.name).toBe("Parker Hannifin");
    expect(record?.location).toContain("Cleveland Warehouse");

    const labels = (record?.specs || []).map((s) => s.label.toLowerCase());
    expect(labels.some((l) => l.includes("pressure"))).toBe(true);
    expect(labels.some((l) => l.includes("flow rate"))).toBe(true);
    expect(labels.some((l) => l.includes("voltage"))).toBe(true);
    expect(labels.some((l) => l.includes("power"))).toBe(true);
    expect(labels.some((l) => l.includes("weight"))).toBe(true);
    expect(labels.some((l) => l.includes("material"))).toBe(true);
    expect(labels.some((l) => l.includes("port size"))).toBe(true);
  });
});

describe("POST /api/research/search Mocked Integration Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("Returns 200 with researched parts when TinyFish search and fetch succeed", async () => {
    vi.spyOn(TinyFishService, "searchPages").mockResolvedValueOnce([
      {
        position: 1,
        title: "Heavy Duty Cylinder Seal Kit",
        snippet: "Northfield kit",
        url: "https://example-supplier.com/item-1",
        site_name: "Supplier Example",
      },
    ]);

    vi.spyOn(TinyFishService, "fetchPages").mockResolvedValueOnce([
      {
        url: "https://example-supplier.com/item-1",
        title: "Heavy Duty Cylinder Seal Kit",
        format: "markdown",
        text: `
Manufacturer: Northfield
Part Number: DEMO-SK-99
Bore diameter: 80 mm
Operating pressure: 210 bar
In stock
        `,
      },
    ]);

    const res = await request(app).post("/api/research/search").send({
      query: "cylinder seal kit",
      domain: "industrial",
      maxResults: 2,
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("totalResearched", 1);
    expect(res.body.data.results[0]).toMatchObject({
      domain: "industrial",
      manufacturer: "Northfield",
      partNumber: "DEMO-SK-99",
      isDemo: false,
    });
    expect(res.body.data.results[0].source.url).toBe("https://example-supplier.com/item-1");
  });

  it("Handles empty search results gracefully", async () => {
    vi.spyOn(TinyFishService, "searchPages").mockResolvedValueOnce([]);

    const res = await request(app).post("/api/research/search").send({
      query: "nonexistent obscure component 99999",
      domain: "industrial",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.totalResearched).toBe(0);
    expect(res.body.data.results).toEqual([]);
  });

  it("Handles TinyFish timeout safely with 504 status", async () => {
    vi.spyOn(TinyFishService, "conductResearch").mockRejectedValueOnce(
      Object.assign(new Error("TinyFish request timed out."), {
        status: 504,
        code: "TINYFISH_TIMEOUT",
      })
    );

    const res = await request(app).post("/api/research/search").send({
      query: "timeout test",
      domain: "electronics",
    });

    expect(res.status).toBe(504);
    expect(res.body.error).toHaveProperty("code", "TINYFISH_TIMEOUT");
  });

  it("Handles TinyFish rate limit (429) safely", async () => {
    vi.spyOn(TinyFishService, "conductResearch").mockRejectedValueOnce(
      Object.assign(new Error("TinyFish API rate limit exceeded."), {
        status: 429,
        code: "TINYFISH_RATE_LIMIT",
      })
    );

    const res = await request(app).post("/api/research/search").send({
      query: "rate limit test",
      domain: "automotive",
    });

    expect(res.status).toBe(429);
    expect(res.body.error).toHaveProperty("code", "TINYFISH_RATE_LIMIT");
  });

  it("Rejects request missing required query parameter with 400 VALIDATION_ERROR", async () => {
    const res = await request(app).post("/api/research/search").send({
      domain: "industrial",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty("code", "VALIDATION_ERROR");
  });

  it("Rejects request with invalid domain", async () => {
    const res = await request(app).post("/api/research/search").send({
      query: "hydraulic pump",
      domain: "aerospace", // not in allowed domains
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty("code", "VALIDATION_ERROR");
  });
});

describe("Optional Real TinyFish API Test", () => {
  const hasRealKey = Boolean(config.TINYFISH_API_KEY && config.TINYFISH_API_KEY.startsWith("tf_"));

  it.runIf(hasRealKey)("Live Call to TinyFish Search API", async () => {
    const results = await TinyFishService.searchPages("hydraulic cylinder seal kit", 2);
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      expect(results[0]).toHaveProperty("url");
      expect(results[0].url.startsWith("http")).toBe(true);
    }
  });
});
