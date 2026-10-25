// src/services/datasheetParserService.ts
import * as pdfParseModule from "pdf-parse";
const pdfParse: any = (pdfParseModule as any).default || pdfParseModule;
import { logger } from "../utils/logger";
import { DatasheetParseRequest, DatasheetParseResponse, ParsedDatasheetSpec } from "../schemas/datasheetSchemas";

const KNOWN_MANUFACTURERS = [
  "Parker",
  "Parker Hannifin",
  "Bosch Rexroth",
  "Rexroth",
  "SKF",
  "Festo",
  "Siemens",
  "Eaton",
  "Vickers",
  "Danfoss",
  "SMC",
  "Omron",
  "Schneider Electric",
  "Schneider",
  "ABB",
  "Timken",
  "NSK",
  "FAG",
  "NTN",
  "Yuken",
  "Hydac",
  "Moog",
  "Donaldson",
  "Fleetguard",
  "Texas Instruments",
  "STMicroelectronics",
  "Analog Devices",
  "Microchip",
];

export class DatasheetParserService {
  public async parseDatasheet(payload: DatasheetParseRequest): Promise<DatasheetParseResponse> {
    const cleanBase64 = payload.fileBase64.replace(/^data:application\/pdf;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");

    let extractedText = "";
    let pageCount = 1;
    let pagesData: Array<{ text: string; num: number }> = [];

    try {
      const PDFParserClass = (pdfParseModule as any).PDFParse || (typeof pdfParseModule === "function" ? pdfParseModule : null);
      if (PDFParserClass && PDFParserClass.prototype?.getText) {
        const parser = new PDFParserClass({ data: buffer });
        const res = await parser.getText();
        extractedText = res.text || "";
        pageCount = res.total || res.pages?.length || 1;
        if (Array.isArray(res.pages)) {
          pagesData = res.pages.map((p: any) => ({ text: p.text || "", num: p.num || 1 }));
        }
      } else if (typeof pdfParse === "function") {
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text || "";
        pageCount = pdfData.numpages || 1;
      }
    } catch (err: any) {
      logger.warn(`pdf-parse failed to decode buffer: ${err.message}. Running text stream recovery.`);
      extractedText = buffer.toString("utf-8");
    }

    if (!extractedText) {
      extractedText = buffer.toString("utf-8");
    }

    const parsed = this.extractTechnicalSpecsFromText(extractedText, pagesData);

    const queryParts = [parsed.detectedManufacturer, parsed.detectedModelCode].filter(Boolean);
    const suggestedSearchQuery = queryParts.length > 0 ? queryParts.join(" ") : payload.fileName?.replace(/\.pdf$/i, "") || "datasheet component";

    return {
      fileName: payload.fileName,
      pageCount,
      detectedTitle: parsed.detectedTitle,
      detectedManufacturer: parsed.detectedManufacturer,
      detectedModelCode: parsed.detectedModelCode,
      detectedCategory: parsed.detectedCategory,
      specs: parsed.specs,
      rawTextPreview: extractedText.slice(0, 1000).trim(),
      suggestedSearchQuery,
    };
  }

  public extractTechnicalSpecsFromText(text: string, pagesData: Array<{ text: string; num: number }> = []) {
    const specs: ParsedDatasheetSpec[] = [];

    // Helper to find page number for an evidence snippet
    const findPageForSnippet = (snippet?: string): number | undefined => {
      if (!snippet || pagesData.length === 0) return undefined;
      const cleanSnippet = snippet.trim().toLowerCase();
      for (const p of pagesData) {
        if (p.text.toLowerCase().includes(cleanSnippet) || (cleanSnippet.length > 8 && p.text.toLowerCase().includes(cleanSnippet.slice(0, 12)))) {
          return p.num;
        }
      }
      return 1;
    };

    // 1. Detect Manufacturer (longest matches first, then general label match)
    let detectedManufacturer: string | undefined;
    const sortedManufacturers = [...KNOWN_MANUFACTURERS].sort((a, b) => b.length - a.length);
    for (const mfr of sortedManufacturers) {
      if (new RegExp(`\\b${mfr}\\b`, "i").test(text)) {
        detectedManufacturer = mfr;
        break;
      }
    }
    if (!detectedManufacturer) {
      const mfrMatch = text.match(/(?:^|\n)\s*(?:Manufacturer|Brand|Mfr)\s*[:\t]?\s*([A-Za-z0-9&.,\- ]+?)(?:\s*\(fictional\)?|\r?\n|$)/im);
      if (mfrMatch && mfrMatch[1].trim().length > 2) {
        detectedManufacturer = mfrMatch[1].trim().replace(/\s*\(fictional\)/i, "");
      }
    }

    // 2. Detect Model / Ordering Code
    let detectedModelCode: string | undefined;
    const modelMatch = text.match(/(?:Model(?:\s*number)?|Series|Order\s*Code|Part\s*Number|Type)\s*[:#]?\s*([A-Z0-9][-A-Z0-9/_.]+)/i);
    if (modelMatch) {
      detectedModelCode = modelMatch[1].trim();
    } else {
      const seriesMatch = text.match(/\b([A-Z0-9]{3,8}[-/][A-Z0-9]{2,8})\b/);
      if (seriesMatch) detectedModelCode = seriesMatch[1].trim();
    }

    // 3. Document Title / Heading
    const firstLines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 5 && !l.toLowerCase().includes("page"));
    const detectedTitle = firstLines[0]?.slice(0, 80) || undefined;

    // Helper regex scanner
    const scanSpec = (label: string, regex: RegExp, unit?: string, defaultConfidence = 0.92) => {
      const match = text.match(regex);
      if (match) {
        const val = match[1]?.trim() || match[0].trim();
        const evidenceSnippet = match[0].trim();
        const pageNumber = findPageForSnippet(evidenceSnippet);
        specs.push({
          label,
          value: val,
          unit,
          confidence: defaultConfidence,
          evidenceSnippet,
          pageNumber,
        });
      }
    };

    // Pressure
    scanSpec("Operating Pressure", /(?:max(?:imum)?\s*operating\s*pressure|nominal\s*pressure|pressure\s*range)[\s:]*([0-9]+(?:\.[0-9]+)?\s*(?:bar|psi|mpa))/i, "bar", 0.95);
    if (!specs.some((s) => s.label === "Operating Pressure")) {
      scanSpec("Operating Pressure", /([0-9]+(?:\.[0-9]+)?\s*(?:bar|psi|mpa))\b/i, "bar", 0.85);
    }

    // Flow Rate
    scanSpec("Max Flow Rate", /(?:max(?:imum)?\s*(?:rated\s*)?flow(?:\s*rate)?|nominal\s*flow)[\s:]*([0-9]+(?:\.[0-9]+)?\s*(?:l\/min|gpm|m3\/h))/i, "l/min", 0.95);
    if (!specs.some((s) => s.label === "Max Flow Rate")) {
      scanSpec("Max Flow Rate", /([0-9]+(?:\.[0-9]+)?\s*(?:l\/min|gpm|m3\/h))\b/i, "l/min", 0.85);
    }

    // Voltage
    scanSpec("Supply Voltage", /(?:solenoid\s*(?:coil\s*)?)?(?:rated|nominal|supply|coil)\s*voltage[\s:]*([0-9]+(?:\.[0-9]+)?\s*(?:v\s*(?:ac|dc)?|kv))/i, "V", 0.95);
    if (!specs.some((s) => s.label === "Supply Voltage")) {
      scanSpec("Supply Voltage", /\b([0-9]+(?:\.[0-9]+)?\s*(?:v\s*dc|v\s*ac|vdc|vac|v))\b/i, "V", 0.85);
    }

    // Power Rating
    scanSpec("Power Rating", /(?:rated\s*power|power\s*consumption|output\s*power)[\s:]*([0-9]+(?:\.[0-9]+)?\s*(?:w|kw|hp|va))\b/i, "W", 0.92);

    // Current Rating
    scanSpec("Current Rating", /(?:rated\s*current|max\s*current|holding\s*current)[\s:]*([0-9]+(?:\.[0-9]+)?\s*(?:a|ma))\b/i, "A", 0.9);

    // Temperature Range
    scanSpec("Operating Temperature", /(?:operating\s*temperature|fluid\s*temperature|ambient\s*temperature)[\s:]*(-?[0-9]+(?:\.[0-9]+)?\s*(?:°\s*[cf])?\s*(?:to|-)\s*\+?[0-9]+(?:\.[0-9]+)?\s*(?:°|deg)?\s*[cf])/i, "°C", 0.95);

    // Seal Material
    scanSpec("Seal Material", /(?:seal\s*material|fluid\s*compatibility|elastomer)[\s:]*([A-Za-z0-9/,\s-]{3,30}(?:NBR|FKM|Viton|EPDM|Polyurethane))/i, undefined, 0.9);

    // Fluid Compatibility
    scanSpec("Fluid Compatibility", /(?:fluid\s*type|hydraulic\s*fluid)[\s:]*(HLP|HVL|mineral\s*oil|water-glycol|phosphate\s*ester)/i, undefined, 0.9);

    // Port Size / Thread Size
    scanSpec("Port Size", /(?:port\s*size|fluid\s*ports?|inlet\s*port|outlet\s*port)[\s:]*([0-9/]+["”]\s*(?:NPT|BSPP|SAE|G)|G\s*[0-9/]+|SAE\s*-[0-9]+)/i, undefined, 0.92);

    // Dimensions
    scanSpec("Dimensions", /(?:dimensions?|envelope)[\s:]*([0-9]+(?:\.[0-9]+)?\s*(?:x|×)\s*[0-9]+(?:\.[0-9]+)?(?:\s*(?:x|×)\s*[0-9]+(?:\.[0-9]+)?)?\s*mm)/i, "mm", 0.95);
    if (!specs.some((s) => s.label === "Dimensions")) {
      const lenMatch = text.match(/overall\s*length[\s:]*([0-9]+(?:\.[0-9]+)?)\s*mm/i);
      const widMatch = text.match(/overall\s*width[\s:]*([0-9]+(?:\.[0-9]+)?)\s*mm/i);
      const hgtMatch = text.match(/overall\s*height[\s:]*([0-9]+(?:\.[0-9]+)?)\s*mm/i);
      if (lenMatch && widMatch && hgtMatch) {
        const snippet = `${lenMatch[0]}, ${widMatch[0]}, ${hgtMatch[0]}`;
        specs.push({
          label: "Dimensions",
          value: `${lenMatch[1]} × ${widMatch[1]} × ${hgtMatch[1]} mm`,
          unit: "mm",
          confidence: 0.92,
          evidenceSnippet: snippet,
          pageNumber: findPageForSnippet(lenMatch[0]),
        });
      }
    }

    // Mounting Interface
    scanSpec("Mounting Interface", /(?:mounting\s*interface|subplate\s*interface|mounting\s*pattern)[\s:]*([A-Za-z0-9\s/_-]{3,30}?)(?:\s*\(illustrative|\r?\n|$)/i, undefined, 0.92);

    // Ingress Protection
    scanSpec("Enclosure Protection", /\b(IP\s*[56][56789]K?)\b/i, undefined, 0.95);

    // Weight / Mass
    scanSpec("Weight", /(?:weight|mass)[\s:]*([0-9]+(?:\.[0-9]+)?\s*(?:kg|g|lbs?))\b/i, "kg", 0.92);

    // Detect Category
    let detectedCategory = "Industrial Component";
    const lower = text.toLowerCase();
    if (lower.includes("directional valve") || lower.includes("solenoid valve") || lower.includes("control valve")) {
      detectedCategory = "Valves";
    } else if (lower.includes("ball bearing") || lower.includes("roller bearing") || lower.includes("spherical bearing")) {
      detectedCategory = "Bearings";
    } else if (lower.includes("cylinder") || lower.includes("seal kit") || lower.includes("piston seal")) {
      detectedCategory = "Seals & Cylinders";
    } else if (lower.includes("variable frequency") || lower.includes("servo motor") || lower.includes("stepper motor")) {
      detectedCategory = "Motors & Drives";
    } else if (lower.includes("voltage regulator") || lower.includes("integrated circuit") || lower.includes("mosfet")) {
      detectedCategory = "Electronics";
    }

    return {
      detectedTitle,
      detectedManufacturer,
      detectedModelCode,
      detectedCategory,
      specs,
    };
  }
}

export const datasheetParserService = new DatasheetParserService();
