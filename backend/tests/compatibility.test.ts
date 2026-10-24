import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { UnitConversionService } from "../src/services/unitConversionService";
import { CompatibilityEngine } from "../src/services/compatibilityEngine";

describe("UnitConversionService", () => {
  it("Length: converts mm, cm, m, and inches to canonical mm", () => {
    const q1 = UnitConversionService.toCanonical(2, "cm");
    const q2 = UnitConversionService.toCanonical(20, "mm");
    expect(q1.canonicalValue).toBe(20);
    expect(q2.canonicalValue).toBe(20);
    expect(UnitConversionService.nearlyEqual(q1.canonicalValue, q2.canonicalValue)).toBe(true);

    const q3 = UnitConversionService.toCanonical(1, "m");
    expect(q3.canonicalValue).toBe(1000);

    const q4 = UnitConversionService.toCanonical(1, "in");
    expect(q4.canonicalValue).toBe(25.4);
  });

  it("Pressure: converts bar, kPa, MPa, and psi to canonical bar", () => {
    const qBar = UnitConversionService.toCanonical(10, "bar");
    const qMpa = UnitConversionService.toCanonical(1, "MPa");
    expect(UnitConversionService.nearlyEqual(qBar.canonicalValue, qMpa.canonicalValue)).toBe(true);

    const qPsi = UnitConversionService.toCanonical(145.038, "psi");
    expect(UnitConversionService.nearlyEqual(qBar.canonicalValue, qPsi.canonicalValue, 1e-3)).toBe(true);
  });

  it("Temperature: handles absolute temperature conversion to Kelvin", () => {
    const c0 = UnitConversionService.toCanonical(0, "°C");
    expect(c0.canonicalValue).toBeCloseTo(273.15, 2);

    const f32 = UnitConversionService.toCanonical(32, "°F");
    expect(f32.canonicalValue).toBeCloseTo(273.15, 2);
    expect(UnitConversionService.nearlyEqual(c0.canonicalValue, f32.canonicalValue)).toBe(true);
  });

  it("Voltage & Current: converts V, mV, A, and mA", () => {
    const v1 = UnitConversionService.toCanonical(3.3, "V");
    const v2 = UnitConversionService.toCanonical(3300, "mV");
    expect(UnitConversionService.nearlyEqual(v1.canonicalValue, v2.canonicalValue)).toBe(true);

    const i1 = UnitConversionService.toCanonical(1.5, "A");
    const i2 = UnitConversionService.toCanonical(1500, "mA");
    expect(UnitConversionService.nearlyEqual(i1.canonicalValue, i2.canonicalValue)).toBe(true);
  });

  it("Rejects unknown units and dimension mismatches", () => {
    expect(() => UnitConversionService.toCanonical(10, "unknown_unit")).toThrow();
    expect(UnitConversionService.getDimension("mm")).toBe("length");
    expect(UnitConversionService.getDimension("bar")).toBe("pressure");
    expect(UnitConversionService.getDimension("mm")).not.toBe(UnitConversionService.getDimension("bar"));
  });
});

describe("Deterministic CompatibilityEngine Unit & Rule Evaluation", () => {
  const candidatePart = {
    id: "part-test-01",
    name: "Heavy Duty Hydraulic Cylinder",
    domain: "industrial",
    specs: [
      { label: "Bore diameter", value: "80 mm" },
      { label: "Max pressure", value: "250 bar" },
      { label: "Temperature range", value: "-30 to 100 °C" },
      { label: "Max speed", value: "3000 rpm" },
      { label: "Seal material", value: "Polyurethane / NBR" },
    ],
    source: {
      name: "Verified Hydraulic Specs",
      url: "https://example.com/datasheet/part-01",
    },
    typicalApplications: ["Hydraulic press cylinders"],
  };

  it("Evaluates exact equality with unit conversion (8 cm == 80 mm) -> pass", () => {
    const assessment = CompatibilityEngine.assessPart(candidatePart, [
      {
        id: "r1",
        label: "Bore diameter",
        expectedValue: "8",
        expectedUnit: "cm",
        rule: "number-equals",
        mandatory: true,
        specLabels: ["Bore diameter"],
      },
    ]);

    expect(assessment.status).toBe("POTENTIAL_MATCH");
    expect(assessment.requirements[0].result).toBe("pass");
    expect(assessment.requirements[0].canonicalUnit).toBe("mm");
  });

  it("Evaluates numeric minimum rating (number-min) -> pass and fail", () => {
    // 200 bar <= 250 bar -> pass
    const passAssessment = CompatibilityEngine.assessPart(candidatePart, [
      {
        id: "r-press-pass",
        label: "Operating pressure",
        expectedValue: "200",
        expectedUnit: "bar",
        rule: "number-min",
        mandatory: true,
        specLabels: ["Max pressure"],
      },
    ]);
    expect(passAssessment.status).toBe("POTENTIAL_MATCH");
    expect(passAssessment.requirements[0].result).toBe("pass");

    // 300 bar > 250 bar -> fail -> MISMATCH
    const failAssessment = CompatibilityEngine.assessPart(candidatePart, [
      {
        id: "r-press-fail",
        label: "Operating pressure",
        expectedValue: "300",
        expectedUnit: "bar",
        rule: "number-min",
        mandatory: true,
        specLabels: ["Max pressure"],
      },
    ]);
    expect(failAssessment.status).toBe("MISMATCH");
    expect(failAssessment.requirements[0].result).toBe("fail");
  });

  it("Evaluates operating range (number-within) -> pass for 50 °C, fail for 150 °C", () => {
    const passAssessment = CompatibilityEngine.assessPart(candidatePart, [
      {
        id: "r-temp-pass",
        label: "Operating temperature",
        expectedValue: "50",
        expectedUnit: "°C",
        rule: "number-within",
        mandatory: true,
        specLabels: ["Temperature range"],
      },
    ]);
    expect(passAssessment.requirements[0].result).toBe("pass");

    const failAssessment = CompatibilityEngine.assessPart(candidatePart, [
      {
        id: "r-temp-fail",
        label: "Operating temperature",
        expectedValue: "150",
        expectedUnit: "°C",
        rule: "number-within",
        mandatory: true,
        specLabels: ["Temperature range"],
      },
    ]);
    expect(failAssessment.status).toBe("MISMATCH");
    expect(failAssessment.requirements[0].result).toBe("fail");
  });

  it("Missing specification returns UNVERIFIED and never passes", () => {
    const assessment = CompatibilityEngine.assessPart(candidatePart, [
      {
        id: "r-missing",
        label: "Dynamic load rating",
        expectedValue: "40",
        expectedUnit: "kN",
        rule: "number-min",
        mandatory: true,
        specLabels: ["Dynamic load rating"],
      },
    ]);

    expect(assessment.status).toBe("UNVERIFIED");
    expect(assessment.requirements[0].result).toBe("unverified");
    expect(assessment.requirements[0].explanation).toContain("not listed");
  });

  it("Dimension mismatch between length and pressure returns UNVERIFIED", () => {
    const assessment = CompatibilityEngine.assessPart(candidatePart, [
      {
        id: "r-dim-mismatch",
        label: "Bore diameter",
        expectedValue: "100",
        expectedUnit: "bar", // mismatched unit for length
        rule: "number-equals",
        mandatory: true,
        specLabels: ["Bore diameter"],
      },
    ]);

    expect(assessment.status).toBe("UNVERIFIED");
    expect(assessment.requirements[0].result).toBe("unverified");
    expect(assessment.requirements[0].explanation).toContain("Dimension mismatch");
  });

  it("Detects conflicting claims across multiple sources -> UNVERIFIED", () => {
    const partWithConflicts = {
      ...candidatePart,
      sourceClaims: [
        {
          label: "Bore diameter",
          claimedValue: "80 mm",
          sourceRecord: { name: "Supplier A" },
        },
        {
          label: "Bore diameter",
          claimedValue: "85 mm",
          sourceRecord: { name: "Supplier B" },
        },
      ],
    };

    const assessment = CompatibilityEngine.assessPart(partWithConflicts, [
      {
        id: "r-conflict",
        label: "Bore diameter",
        expectedValue: "80",
        expectedUnit: "mm",
        rule: "number-equals",
        mandatory: true,
        specLabels: ["Bore diameter"],
      },
    ]);

    expect(assessment.status).toBe("UNVERIFIED");
    expect(assessment.requirements[0].result).toBe("unverified");
    expect(assessment.requirements[0].explanation).toContain("Conflicting specification claims");
  });
});

describe("POST /api/compatibility/check API", () => {
  it("Returns 200 and compatibility breakdown for candidate parts", async () => {
    const res = await request(app)
      .post("/api/compatibility/check")
      .send({
        domain: "industrial",
        candidateParts: [
          {
            id: "part-01",
            name: "Seal Kit",
            domain: "industrial",
            specs: [{ label: "Bore diameter", value: "80 mm" }],
            source: { name: "Demo", url: "https://example.com/demo" },
          },
        ],
        requirements: [
          {
            id: "req-1",
            label: "Bore diameter",
            expectedValue: "80",
            expectedUnit: "mm",
            rule: "number-equals",
            mandatory: true,
            specLabels: ["Bore diameter"],
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("totalAssessed", 1);
    expect(res.body.data.assessments[0]).toHaveProperty("status", "POTENTIAL_MATCH");
    expect(res.body.data.assessments[0].requirements[0]).toHaveProperty("result", "pass");
  });

  it("Rejects invalid payload with missing requirements -> 400 VALIDATION_ERROR", async () => {
    const res = await request(app)
      .post("/api/compatibility/check")
      .send({
        domain: "industrial",
        candidateParts: [],
        requirements: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty("code", "VALIDATION_ERROR");
  });
});
