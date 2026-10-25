// tests/advancedFeatures.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { visionService } from "../src/services/visionService";
import { crossReferenceService } from "../src/services/crossReferenceService";
import { datasheetParserService } from "../src/services/datasheetParserService";

describe("1. Vision & Nameplate Camera OCR Service", () => {
  it("extracts manufacturer, part number, and specs from raw nameplate text", () => {
    const rawTag = `
      PARKER HANNIFIN CORP
      P/N: D1VW001CNJW
      MODEL: D1VW SIZE 06
      MAX OPERATING: 350 bar
      FLOW: 60 L/min
      COIL: 24 VDC 30 W
      PROTECTION: IP65
      S/N: 2026-X884102
    `;

    const result = visionService.extractNameplateDetails(rawTag);
    expect(result.manufacturer).toBe("Parker Hannifin");
    expect(result.partNumber).toBe("D1VW001CNJW");
    expect(result.serialNumber).toBe("2026-X884102");

    const press = result.specs.find((s) => s.label === "Max Pressure");
    expect(press?.value).toContain("350 BAR");

    const volt = result.specs.find((s) => s.label === "Voltage");
    expect(volt?.value).toContain("24 VDC");

    const ip = result.specs.find((s) => s.label === "Protection Rating");
    expect(ip?.value).toBe("IP65");
  });

  it("POST /api/vision/ocr returns 200 with extracted nameplate data and suggested search query", async () => {
    const res = await request(app)
      .post("/api/vision/ocr")
      .send({
        manualText: "SKF 6205-2RS1 C3 Bore: 25 mm 14000 RPM",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.extracted.manufacturer).toBe("SKF");
    expect(res.body.data.extracted.partNumber).toBe("6205-2RS1");
    expect(res.body.data.suggestedSearchQuery).toContain("SKF");
  });

  it("callExternalOcr parses OCR.Space response payload correctly", async () => {
    const originalFetch = global.fetch;
    const mockOcrSpaceResponse = {
      ParsedResults: [
        {
          ParsedText: "PARKER HANNIFIN\r\nD1VW001CNJW\r\n350 bar 24 VDC\r\n",
          FileParseExitCode: 1,
        },
      ],
      OCRExitCode: 1,
      IsErroredOnProcessing: false,
    };

    global.fetch = async () =>
      new Response(JSON.stringify(mockOcrSpaceResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    try {
      const result = await visionService.callExternalOcr(
        "data:image/jpeg;base64,mockImageBase64",
        "https://api.ocr.space/parse/image",
        "helloworld"
      );
      expect(result.text).toContain("PARKER HANNIFIN");
      expect(result.text).toContain("D1VW001CNJW");
      expect(result.confidence).toBeGreaterThan(0.9);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe("2. Cross-Reference & Obsolete Part Interchange Engine", () => {
  it("generates 100% direct drop-in equivalents for standard bearings (SKF <-> NSK <-> FAG <-> Timken)", async () => {
    const result = await crossReferenceService.findEquivalents({
      partNumber: "6205-2RS C3",
      manufacturer: "SKF",
    });

    expect(result.sourcePart.partNumber).toBe("6205-2RS C3");
    expect(result.equivalents.length).toBeGreaterThan(0);

    const nsk = result.equivalents.find((e) => e.manufacturer === "NSK");
    expect(nsk).toBeDefined();
    expect(nsk?.interchangeType).toBe("direct_drop_in");
    expect(nsk?.fffScore.overallScore).toBeGreaterThanOrEqual(95);
    expect(nsk?.partNumber).toBe("6205DDU C3");
  });

  it("generates subplate interchange alternatives for hydraulic valves (Parker <-> Rexroth <-> Vickers)", async () => {
    const result = await crossReferenceService.findEquivalents({
      partNumber: "D1VW001CNJW",
      manufacturer: "Parker Hannifin",
    });

    expect(result.sourcePart.standardSeries).toContain("ISO 4401-03");
    const rexroth = result.equivalents.find((e) => e.manufacturer === "Bosch Rexroth");
    expect(rexroth).toBeDefined();
    expect(rexroth?.fffScore.fit).toBe("exact");
    expect(rexroth?.standardInterface).toContain("ISO 4401-03");
  });

  it("POST /api/cross-reference/match returns 200 with interchange alternatives", async () => {
    const res = await request(app)
      .post("/api/cross-reference/match")
      .send({ partNumber: "LM7805" });

    expect(res.status).toBe(200);
    expect(res.body.data.equivalents.length).toBeGreaterThan(0);
    expect(res.body.data.equivalents[0].standardInterface).toContain("TO-220");
  });
});

describe("3. PDF Datasheet & Technical Drawing Parser", () => {
  it("extracts structured specs from technical datasheet text streams", () => {
    const mockDatasheetText = `
      BOSCH REXROTH DIRECTIONAL SPOOL VALVE
      Type 4WE6 Directional Valve
      Data Sheet RE 23178
      Maximum operating pressure: 350 bar
      Maximum flow rate: 80 L/min
      Coil voltage: 24 VDC
      Fluid temperature range: -30 to 80 °C
      Port size: Subplate ISO 4401-03-02
      Fluid type: Mineral oil HLP
      Weight: 1.95 kg
    `;

    const parsed = datasheetParserService.extractTechnicalSpecsFromText(mockDatasheetText);
    expect(parsed.detectedManufacturer).toBe("Bosch Rexroth");
    expect(parsed.detectedCategory).toBe("Valves");

    const press = parsed.specs.find((s) => s.label === "Operating Pressure");
    expect(press?.value).toContain("350 bar");

    const flow = parsed.specs.find((s) => s.label === "Max Flow Rate");
    expect(flow?.value).toContain("80 L/min");

    const volt = parsed.specs.find((s) => s.label === "Supply Voltage");
    expect(volt?.value).toContain("24 VDC");
  });

  it("POST /api/datasheets/parse validates payload and rejects non-base64 requests", async () => {
    const res = await request(app)
      .post("/api/datasheets/parse")
      .send({ fileBase64: "" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/datasheets/parse decodes text buffer and returns parsed technical specifications", async () => {
    const sampleText = "PARKER HYDRAULIC VALVE D1VW Max Operating Pressure: 350 bar Nominal Flow: 60 L/min 24 VDC";
    const base64 = Buffer.from(sampleText, "utf-8").toString("base64");

    const res = await request(app)
      .post("/api/datasheets/parse")
      .send({
        fileBase64: base64,
        fileName: "parker-d1vw-datasheet.pdf",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.detectedManufacturer).toBe("Parker");
    expect(res.body.data.specs.length).toBeGreaterThan(0);
  });

  it("extracts exact benchmark specifications from industrial demo datasheet", async () => {
    const fs = await import("fs");
    const path = "C:/Users/sgaoj/Downloads/industrial_valve_demo_datasheet.pdf";
    if (fs.existsSync(path)) {
      const buf = fs.readFileSync(path);
      const res = await request(app)
        .post("/api/datasheets/parse")
        .send({
          fileBase64: buf.toString("base64"),
          fileName: "industrial_valve_demo_datasheet.pdf",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.detectedModelCode).toBe("HDC-24-350");
      expect(res.body.data.detectedManufacturer).toContain("Example Industrial Systems");
      expect(res.body.data.detectedCategory).toBe("Valves");
      expect(res.body.data.pageCount).toBe(3);

      const specs = res.body.data.specs;
      const pressure = specs.find((s: any) => s.label === "Operating Pressure");
      expect(pressure?.value).toContain("350 bar");

      const voltage = specs.find((s: any) => s.label === "Supply Voltage");
      expect(voltage?.value).toContain("24 V DC");

      const flow = specs.find((s: any) => s.label === "Max Flow Rate");
      expect(flow?.value).toContain("80 L/min");

      const temp = specs.find((s: any) => s.label === "Operating Temperature");
      expect(temp?.value).toContain("-20 °C to +80 °C");

      const dims = specs.find((s: any) => s.label === "Dimensions");
      expect(dims?.value).toContain("145 × 62 × 98 mm");

      const weight = specs.find((s: any) => s.label === "Weight");
      expect(weight?.value).toContain("2.4 kg");
    }
  });
});
