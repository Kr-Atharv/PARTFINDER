// src/services/unitConversionService.ts

export type PhysicalDimension =
  | "length"
  | "pressure"
  | "temperature"
  | "speed"
  | "voltage"
  | "current"
  | "force"
  | "power"
  | "flow";

export interface CanonicalQuantity {
  canonicalValue: number;
  canonicalUnit: string;
  dimension: PhysicalDimension;
  originalValue: number;
  originalUnit: string;
}

export interface UnitDefinition {
  dimension: PhysicalDimension;
  canonicalUnit: string;
  toCanonical: (val: number) => number;
  fromCanonical: (val: number) => number;
}

// Canonical base units:
// Length: mm
// Pressure: bar
// Temperature: K (Kelvin for absolute thermodynamic conversions)
// Speed: RPM
// Voltage: V
// Current: A
// Force: N

const UNIT_MAP: Record<string, UnitDefinition> = {
  // Length (Canonical: mm)
  mm: {
    dimension: "length",
    canonicalUnit: "mm",
    toCanonical: (v) => v,
    fromCanonical: (v) => v,
  },
  cm: {
    dimension: "length",
    canonicalUnit: "mm",
    toCanonical: (v) => v * 10,
    fromCanonical: (v) => v / 10,
  },
  m: {
    dimension: "length",
    canonicalUnit: "mm",
    toCanonical: (v) => v * 1000,
    fromCanonical: (v) => v / 1000,
  },
  in: {
    dimension: "length",
    canonicalUnit: "mm",
    toCanonical: (v) => v * 25.4,
    fromCanonical: (v) => v / 25.4,
  },
  inch: {
    dimension: "length",
    canonicalUnit: "mm",
    toCanonical: (v) => v * 25.4,
    fromCanonical: (v) => v / 25.4,
  },
  inches: {
    dimension: "length",
    canonicalUnit: "mm",
    toCanonical: (v) => v * 25.4,
    fromCanonical: (v) => v / 25.4,
  },

  // Pressure (Canonical: bar)
  bar: {
    dimension: "pressure",
    canonicalUnit: "bar",
    toCanonical: (v) => v,
    fromCanonical: (v) => v,
  },
  kpa: {
    dimension: "pressure",
    canonicalUnit: "bar",
    toCanonical: (v) => v * 0.01,
    fromCanonical: (v) => v / 0.01,
  },
  mpa: {
    dimension: "pressure",
    canonicalUnit: "bar",
    toCanonical: (v) => v * 10,
    fromCanonical: (v) => v / 10,
  },
  psi: {
    dimension: "pressure",
    canonicalUnit: "bar",
    toCanonical: (v) => v * 0.0689475729,
    fromCanonical: (v) => v / 0.0689475729,
  },

  // Temperature (Canonical: K - Kelvin)
  "°c": {
    dimension: "temperature",
    canonicalUnit: "K",
    toCanonical: (v) => v + 273.15,
    fromCanonical: (v) => v - 273.15,
  },
  c: {
    dimension: "temperature",
    canonicalUnit: "K",
    toCanonical: (v) => v + 273.15,
    fromCanonical: (v) => v - 273.15,
  },
  "°f": {
    dimension: "temperature",
    canonicalUnit: "K",
    toCanonical: (v) => ((v - 32) * 5) / 9 + 273.15,
    fromCanonical: (v) => ((v - 273.15) * 9) / 5 + 32,
  },
  f: {
    dimension: "temperature",
    canonicalUnit: "K",
    toCanonical: (v) => ((v - 32) * 5) / 9 + 273.15,
    fromCanonical: (v) => ((v - 273.15) * 9) / 5 + 32,
  },
  k: {
    dimension: "temperature",
    canonicalUnit: "K",
    toCanonical: (v) => v,
    fromCanonical: (v) => v,
  },

  // Rotational Speed (Canonical: RPM)
  rpm: {
    dimension: "speed",
    canonicalUnit: "RPM",
    toCanonical: (v) => v,
    fromCanonical: (v) => v,
  },

  // Voltage (Canonical: V)
  v: {
    dimension: "voltage",
    canonicalUnit: "V",
    toCanonical: (v) => v,
    fromCanonical: (v) => v,
  },
  mv: {
    dimension: "voltage",
    canonicalUnit: "V",
    toCanonical: (v) => v * 0.001,
    fromCanonical: (v) => v / 0.001,
  },
  kv: {
    dimension: "voltage",
    canonicalUnit: "V",
    toCanonical: (v) => v * 1000,
    fromCanonical: (v) => v / 1000,
  },

  // Current (Canonical: A)
  a: {
    dimension: "current",
    canonicalUnit: "A",
    toCanonical: (v) => v,
    fromCanonical: (v) => v,
  },
  ma: {
    dimension: "current",
    canonicalUnit: "A",
    toCanonical: (v) => v * 0.001,
    fromCanonical: (v) => v / 0.001,
  },

  // Force / Dynamic Load (Canonical: N)
  n: {
    dimension: "force",
    canonicalUnit: "N",
    toCanonical: (v) => v,
    fromCanonical: (v) => v,
  },
  kn: {
    dimension: "force",
    canonicalUnit: "N",
    toCanonical: (v) => v * 1000,
    fromCanonical: (v) => v / 1000,
  },
  lbf: {
    dimension: "force",
    canonicalUnit: "N",
    toCanonical: (v) => v * 4.4482216153,
    fromCanonical: (v) => v / 4.4482216153,
  },

  // Power (Canonical: W)
  w: {
    dimension: "power",
    canonicalUnit: "W",
    toCanonical: (v) => v,
    fromCanonical: (v) => v,
  },
  kw: {
    dimension: "power",
    canonicalUnit: "W",
    toCanonical: (v) => v * 1000,
    fromCanonical: (v) => v / 1000,
  },
  hp: {
    dimension: "power",
    canonicalUnit: "W",
    toCanonical: (v) => v * 745.699872,
    fromCanonical: (v) => v / 745.699872,
  },

  // Flow (Canonical: L/min)
  "l/min": {
    dimension: "flow",
    canonicalUnit: "L/min",
    toCanonical: (v) => v,
    fromCanonical: (v) => v,
  },
  gpm: {
    dimension: "flow",
    canonicalUnit: "L/min",
    toCanonical: (v) => v * 3.785411784,
    fromCanonical: (v) => v / 3.785411784,
  },
  "m3/h": {
    dimension: "flow",
    canonicalUnit: "L/min",
    toCanonical: (v) => (v * 1000) / 60,
    fromCanonical: (v) => (v * 60) / 1000,
  },
  "m³/h": {
    dimension: "flow",
    canonicalUnit: "L/min",
    toCanonical: (v) => (v * 1000) / 60,
    fromCanonical: (v) => (v * 60) / 1000,
  },
};

export class UnitConversionService {
  /**
   * Floating point relative and absolute tolerance check.
   */
  static nearlyEqual(
    a: number,
    b: number,
    relativeTolerance: number = 1e-4,
    absoluteTolerance: number = 1e-6
  ): boolean {
    const diff = Math.abs(a - b);
    if (diff <= absoluteTolerance) return true;
    return diff <= Math.max(Math.abs(a), Math.abs(b)) * relativeTolerance;
  }

  /**
   * Normalize a unit token to canonical dictionary key.
   */
  static normalizeUnitToken(unit: string): string {
    return unit.trim().toLowerCase().replace("℃", "°c").replace("℉", "°f");
  }

  /**
   * Check if a unit token is known.
   */
  static isKnownUnit(unit: string): boolean {
    const key = this.normalizeUnitToken(unit);
    return key in UNIT_MAP;
  }

  /**
   * Get physical dimension for a given unit token.
   */
  static getDimension(unit: string): PhysicalDimension | null {
    const key = this.normalizeUnitToken(unit);
    return UNIT_MAP[key]?.dimension || null;
  }

  /**
   * Convert a numeric value and unit to canonical representation.
   * Throws an error if the unit is unknown or value is non-finite.
   */
  static toCanonical(value: number, unit: string): CanonicalQuantity {
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid numeric quantity value: ${value}`);
    }

    const key = this.normalizeUnitToken(unit);
    const def = UNIT_MAP[key];

    if (!def) {
      throw new Error(`Unknown or unsupported unit: '${unit}'`);
    }

    const canonicalVal = def.toCanonical(value);

    return {
      canonicalValue: canonicalVal,
      canonicalUnit: def.canonicalUnit,
      dimension: def.dimension,
      originalValue: value,
      originalUnit: unit,
    };
  }

  /**
   * Parse a quantity string like "80 mm", "-30 to 100 °C", "4.5-28 V"
   */
  static parseQuantityString(raw: string): {
    min: number;
    max: number;
    isRange: boolean;
    unit: string;
  } | null {
    if (!raw || typeof raw !== "string") return null;

    const cleaned = raw.trim().replace(/(\d),(\d{3})(?!\d)/g, "$1$2");
    const numRegex = "[-+]?\\d+(?:\\.\\d+)?";
    const pattern = new RegExp(
      `^\\s*(${numRegex})\\s*(?:(?:to|[-–—])\\s*(${numRegex}))?\\s*([^\\s,;]*)`,
      "i"
    );

    const match = pattern.exec(cleaned);
    if (!match) return null;

    const first = Number(match[1]);
    const second = match[2] !== undefined ? Number(match[2]) : undefined;

    if (!Number.isFinite(first) || (second !== undefined && !Number.isFinite(second))) {
      return null;
    }

    const low = second === undefined ? first : Math.min(first, second);
    const high = second === undefined ? first : Math.max(first, second);
    const unit = (match[3] || "").trim();

    return {
      min: low,
      max: high,
      isRange: second !== undefined && second !== first,
      unit,
    };
  }
}
