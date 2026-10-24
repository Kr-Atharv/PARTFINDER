// src/services/compatibilityEngine.ts
import { UnitConversionService } from "./unitConversionService";
import { RequirementItem } from "../schemas/compatibilitySchemas";

export type TopLevelStatus = "POTENTIAL_MATCH" | "MISMATCH" | "UNVERIFIED";
export type FieldStatus = "pass" | "fail" | "unverified";

export interface EvidenceReference {
  sourceName?: string;
  sourceUrl?: string;
  retrievedAt?: string;
  isVerified?: boolean;
  claimEvidence?: string;
}

export interface RequirementAssessmentResult {
  id: string;
  name: string;
  rule: string;
  mandatory: boolean;
  expectedValue: string;
  expectedUnit?: string;
  actualOriginalValue?: string;
  actualOriginalUnit?: string;
  normalizedExpectedValue?: number;
  normalizedActualValue?: number;
  canonicalUnit?: string;
  result: FieldStatus;
  explanation: string;
  supportingSource?: EvidenceReference;
  conflictingClaims?: Array<{
    value: string;
    sourceName?: string;
    evidence?: string;
  }>;
}

export interface PartCompatibilityResult {
  partId: string;
  partName: string;
  partNumber: string;
  manufacturer: string;
  domain: string;
  status: TopLevelStatus;
  summary: {
    passed: number;
    failed: number;
    unverified: number;
    total: number;
  };
  safetyNotice: string;
  requirements: RequirementAssessmentResult[];
}

export class CompatibilityEngine {
  private static readonly SAFETY_NOTICE =
    "Deterministic rule-based assessment. Missing values are never counted as a match. Never guarantees physical interchangeability or operational safety.";

  /**
   * Assess a single part against an array of requirements
   */
  static assessPart(part: any, requirements: RequirementItem[]): PartCompatibilityResult {
    const results: RequirementAssessmentResult[] = [];
    let passedCount = 0;
    let failedCount = 0;
    let unverifiedCount = 0;

    for (const req of requirements) {
      const assessment = this.evaluateRequirement(part, req);
      results.push(assessment);

      if (assessment.result === "pass") passedCount++;
      else if (assessment.result === "fail") failedCount++;
      else unverifiedCount++;
    }

    // Determine top-level status
    // MISMATCH: any mandatory requirement fails
    // UNVERIFIED: no failure, but at least one unverified (missing, ambiguous, conflicting, no source)
    // POTENTIAL_MATCH: all pass with adequate provenance
    let status: TopLevelStatus = "POTENTIAL_MATCH";

    const hasMandatoryFail = results.some((r) => r.mandatory && r.result === "fail");
    const hasUnverified = results.some((r) => r.result === "unverified");

    if (hasMandatoryFail) {
      status = "MISMATCH";
    } else if (hasUnverified) {
      status = "UNVERIFIED";
    } else {
      status = "POTENTIAL_MATCH";
    }

    return {
      partId: part.id || "unspecified",
      partName: part.name || "Unknown Part",
      partNumber: part.partNumber || "Unknown",
      manufacturer: part.manufacturer || "Unknown",
      domain: part.domain || "industrial",
      status,
      summary: {
        passed: passedCount,
        failed: failedCount,
        unverified: unverifiedCount,
        total: requirements.length,
      },
      safetyNotice: this.SAFETY_NOTICE,
      requirements: results,
    };
  }

  /**
   * Evaluate a single requirement against the candidate part
   */
  private static evaluateRequirement(part: any, req: RequirementItem): RequirementAssessmentResult {
    // 1. Locate matching spec in part
    const matchingSpec = this.findMatchingSpec(part, req);

    // Check for conflicting claims if available
    const conflictingClaims = this.findConflictingClaims(part, req);
    if (conflictingClaims.length > 1) {
      return {
        id: req.id,
        name: req.label,
        rule: req.rule,
        mandatory: req.mandatory,
        expectedValue: req.expectedValue,
        expectedUnit: req.expectedUnit,
        result: "unverified",
        explanation: `Conflicting specification claims found across multiple sources (${conflictingClaims.length} distinct claims).`,
        conflictingClaims,
      };
    }

    // Handle vehicle class / fitment check
    if (req.rule === "list-contains") {
      const list: string[] = part.usedIn || part.typicalApplications || [];
      const expectedNormalized = req.expectedValue.trim().toLowerCase();
      const match = list.some((item) => item.toLowerCase() === expectedNormalized);

      return {
        id: req.id,
        name: req.label,
        rule: req.rule,
        mandatory: req.mandatory,
        expectedValue: req.expectedValue,
        actualOriginalValue: list.join(", ") || undefined,
        result: match ? "pass" : "unverified",
        explanation: match
          ? `Part typical applications list includes '${req.expectedValue}'.`
          : `Part typical applications list does not list '${req.expectedValue}'. A typical applications list is not exhaustive, so this does not prove incompatibility.`,
        supportingSource: this.extractSourceInfo(part),
      };
    }

    if (req.rule === "fitment-check") {
      // Look for documented fitment in specs or usedIn
      const fitmentSpec = matchingSpec?.value || "";
      const expectedVehicle = req.expectedValue.trim().toLowerCase();
      const hasFitment = fitmentSpec.toLowerCase().includes(expectedVehicle);

      if (!fitmentSpec) {
        return {
          id: req.id,
          name: req.label,
          rule: req.rule,
          mandatory: req.mandatory,
          expectedValue: req.expectedValue,
          result: "unverified",
          explanation: "No documented fitment reference found in part specifications.",
        };
      }

      return {
        id: req.id,
        name: req.label,
        rule: req.rule,
        mandatory: req.mandatory,
        expectedValue: req.expectedValue,
        actualOriginalValue: fitmentSpec,
        result: hasFitment ? "pass" : "fail",
        explanation: hasFitment
          ? `Documented vehicle fitment matches '${req.expectedValue}'.`
          : `Documented fitment '${fitmentSpec}' does not match target '${req.expectedValue}'.`,
        supportingSource: this.extractSourceInfo(part),
      };
    }

    // If specification is missing from part record
    if (!matchingSpec || !matchingSpec.value) {
      return {
        id: req.id,
        name: req.label,
        rule: req.rule,
        mandatory: req.mandatory,
        expectedValue: req.expectedValue,
        expectedUnit: req.expectedUnit,
        result: "unverified",
        explanation: `Specification '${req.label}' is not listed in the part record. Missing information cannot count as a pass.`,
      };
    }

    const actualRaw = String(matchingSpec.value).trim();
    const sourceInfo = this.extractSourceInfo(part, matchingSpec);

    // Require adequate source provenance (source URL or verified record) for a pass
    const hasAdequateProvenance = Boolean(sourceInfo?.sourceUrl || sourceInfo?.isVerified);

    // 2. Numeric / Physical Quantity evaluation
    if (
      req.rule === "number-equals" ||
      req.rule === "number-min" ||
      req.rule === "number-max" ||
      req.rule === "number-within"
    ) {
      return this.evaluateNumericRequirement(req, actualRaw, sourceInfo, hasAdequateProvenance);
    }

    // 3. String / Text evaluation
    if (req.rule === "text-equals") {
      const cleanExpected = this.cleanText(req.expectedValue);
      const cleanActual = this.cleanText(actualRaw);
      const isMatch = cleanExpected === cleanActual;

      if (!isMatch) {
        return {
          id: req.id,
          name: req.label,
          rule: req.rule,
          mandatory: req.mandatory,
          expectedValue: req.expectedValue,
          actualOriginalValue: actualRaw,
          result: "fail",
          explanation: `Value '${actualRaw}' does not match required '${req.expectedValue}'.`,
          supportingSource: sourceInfo,
        };
      }

      if (!hasAdequateProvenance) {
        return {
          id: req.id,
          name: req.label,
          rule: req.rule,
          mandatory: req.mandatory,
          expectedValue: req.expectedValue,
          actualOriginalValue: actualRaw,
          result: "unverified",
          explanation: `Value matches '${actualRaw}', but lacks adequate source provenance/URL.`,
          supportingSource: sourceInfo,
        };
      }

      return {
        id: req.id,
        name: req.label,
        rule: req.rule,
        mandatory: req.mandatory,
        expectedValue: req.expectedValue,
        actualOriginalValue: actualRaw,
        result: "pass",
        explanation: `Case-normalized text matches '${actualRaw}'.`,
        supportingSource: sourceInfo,
      };
    }

    if (req.rule === "text-contains") {
      const terms = req.expectedValue
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const actualLower = actualRaw.toLowerCase();
      const missingTerms = terms.filter((term) => !actualLower.includes(term));

      if (missingTerms.length > 0) {
        return {
          id: req.id,
          name: req.label,
          rule: req.rule,
          mandatory: req.mandatory,
          expectedValue: req.expectedValue,
          actualOriginalValue: actualRaw,
          result: "fail",
          explanation: `Specification '${actualRaw}' is missing required terms: ${missingTerms.join(", ")}.`,
          supportingSource: sourceInfo,
        };
      }

      if (!hasAdequateProvenance) {
        return {
          id: req.id,
          name: req.label,
          rule: req.rule,
          mandatory: req.mandatory,
          expectedValue: req.expectedValue,
          actualOriginalValue: actualRaw,
          result: "unverified",
          explanation: `Contains required terms, but lacks adequate source provenance.`,
          supportingSource: sourceInfo,
        };
      }

      return {
        id: req.id,
        name: req.label,
        rule: req.rule,
        mandatory: req.mandatory,
        expectedValue: req.expectedValue,
        actualOriginalValue: actualRaw,
        result: "pass",
        explanation: `Contains all required terms in '${actualRaw}'.`,
        supportingSource: sourceInfo,
      };
    }

    return {
      id: req.id,
      name: req.label,
      rule: req.rule,
      mandatory: req.mandatory,
      expectedValue: req.expectedValue,
      actualOriginalValue: actualRaw,
      result: "unverified",
      explanation: `Unsupported rule kind: ${req.rule}`,
    };
  }

  /**
   * Helper to evaluate numeric quantities with unit normalization
   */
  private static evaluateNumericRequirement(
    req: RequirementItem,
    actualRaw: string,
    sourceInfo?: EvidenceReference,
    hasAdequateProvenance: boolean = true
  ): RequirementAssessmentResult {
    const parsedExpected = UnitConversionService.parseQuantityString(req.expectedValue);
    const expectedNum = parsedExpected?.min ?? Number(req.expectedValue);
    const expectedUnit = (parsedExpected?.unit || req.expectedUnit || "").trim();

    if (!Number.isFinite(expectedNum)) {
      return {
        id: req.id,
        name: req.label,
        rule: req.rule,
        mandatory: req.mandatory,
        expectedValue: req.expectedValue,
        expectedUnit: req.expectedUnit,
        actualOriginalValue: actualRaw,
        result: "unverified",
        explanation: `Target value '${req.expectedValue}' could not be parsed as a valid number.`,
      };
    }

    const parsedActual = UnitConversionService.parseQuantityString(actualRaw);
    if (!parsedActual) {
      return {
        id: req.id,
        name: req.label,
        rule: req.rule,
        mandatory: req.mandatory,
        expectedValue: req.expectedValue,
        expectedUnit: req.expectedUnit,
        actualOriginalValue: actualRaw,
        result: "unverified",
        explanation: `Part specification value '${actualRaw}' is unreadable or not numeric.`,
      };
    }

    const actualUnit = parsedActual.unit || "";

    // Require explicit units if expected unit was specified
    if (expectedUnit && !actualUnit) {
      return {
        id: req.id,
        name: req.label,
        rule: req.rule,
        mandatory: req.mandatory,
        expectedValue: req.expectedValue,
        expectedUnit: req.expectedUnit,
        actualOriginalValue: actualRaw,
        result: "unverified",
        explanation: `Part value '${actualRaw}' is missing unit. Cannot assume or guess physical dimension.`,
      };
    }

    if (!expectedUnit && actualUnit) {
      return {
        id: req.id,
        name: req.label,
        rule: req.rule,
        mandatory: req.mandatory,
        expectedValue: req.expectedValue,
        expectedUnit: req.expectedUnit,
        actualOriginalValue: actualRaw,
        result: "unverified",
        explanation: `Requirement did not define a unit while part specified '${actualUnit}'.`,
      };
    }

    let normExpected: number;
    let normActualMin: number;
    let normActualMax: number;
    let canonicalUnit = expectedUnit;

    // Unit conversion
    if (expectedUnit && actualUnit) {
      if (!UnitConversionService.isKnownUnit(expectedUnit)) {
        return {
          id: req.id,
          name: req.label,
          rule: req.rule,
          mandatory: req.mandatory,
          expectedValue: req.expectedValue,
          expectedUnit: req.expectedUnit,
          actualOriginalValue: actualRaw,
          actualOriginalUnit: actualUnit,
          result: "unverified",
          explanation: `Unknown expected unit '${expectedUnit}'.`,
        };
      }

      if (!UnitConversionService.isKnownUnit(actualUnit)) {
        return {
          id: req.id,
          name: req.label,
          rule: req.rule,
          mandatory: req.mandatory,
          expectedValue: req.expectedValue,
          expectedUnit: req.expectedUnit,
          actualOriginalValue: actualRaw,
          actualOriginalUnit: actualUnit,
          result: "unverified",
          explanation: `Unknown part unit '${actualUnit}'.`,
        };
      }

      const expDim = UnitConversionService.getDimension(expectedUnit);
      const actDim = UnitConversionService.getDimension(actualUnit);

      if (expDim !== actDim) {
        return {
          id: req.id,
          name: req.label,
          rule: req.rule,
          mandatory: req.mandatory,
          expectedValue: req.expectedValue,
          expectedUnit: req.expectedUnit,
          actualOriginalValue: actualRaw,
          actualOriginalUnit: actualUnit,
          result: "unverified",
          explanation: `Dimension mismatch: expected '${expectedUnit}' (${expDim}), but part gave '${actualUnit}' (${actDim}). Unrelated dimensions cannot be converted.`,
        };
      }

      const canExp = UnitConversionService.toCanonical(expectedNum, expectedUnit);
      const canActMin = UnitConversionService.toCanonical(parsedActual.min, actualUnit);
      const canActMax = UnitConversionService.toCanonical(parsedActual.max, actualUnit);

      normExpected = canExp.canonicalValue;
      normActualMin = canActMin.canonicalValue;
      normActualMax = canActMax.canonicalValue;
      canonicalUnit = canExp.canonicalUnit;
    } else {
      // Unitless numbers
      normExpected = expectedNum;
      normActualMin = parsedActual.min;
      normActualMax = parsedActual.max;
    }

    // Comparison rules
    if (req.rule === "number-equals") {
      if (parsedActual.isRange) {
        return {
          id: req.id,
          name: req.label,
          rule: req.rule,
          mandatory: req.mandatory,
          expectedValue: req.expectedValue,
          expectedUnit,
          actualOriginalValue: actualRaw,
          actualOriginalUnit: actualUnit,
          normalizedExpectedValue: normExpected,
          normalizedActualValue: normActualMin,
          canonicalUnit,
          result: "unverified",
          explanation: `Required exact equality, but part provides a range '${actualRaw}'.`,
          supportingSource: sourceInfo,
        };
      }

      const isEqual = UnitConversionService.nearlyEqual(normActualMin, normExpected);
      if (!isEqual) {
        return {
          id: req.id,
          name: req.label,
          rule: req.rule,
          mandatory: req.mandatory,
          expectedValue: req.expectedValue,
          expectedUnit,
          actualOriginalValue: actualRaw,
          actualOriginalUnit: actualUnit,
          normalizedExpectedValue: normExpected,
          normalizedActualValue: normActualMin,
          canonicalUnit,
          result: "fail",
          explanation: `Expected ${expectedNum} ${expectedUnit}, but part is ${parsedActual.min} ${actualUnit} (differs in canonical units: ${normActualMin.toFixed(2)} vs ${normExpected.toFixed(2)} ${canonicalUnit}).`,
          supportingSource: sourceInfo,
        };
      }

      if (!hasAdequateProvenance) {
        return {
          id: req.id,
          name: req.label,
          rule: req.rule,
          mandatory: req.mandatory,
          expectedValue: req.expectedValue,
          expectedUnit,
          actualOriginalValue: actualRaw,
          actualOriginalUnit: actualUnit,
          normalizedExpectedValue: normExpected,
          normalizedActualValue: normActualMin,
          canonicalUnit,
          result: "unverified",
          explanation: `Values are equivalent within tolerance, but lack adequate source provenance.`,
          supportingSource: sourceInfo,
        };
      }

      return {
        id: req.id,
        name: req.label,
        rule: req.rule,
        mandatory: req.mandatory,
        expectedValue: req.expectedValue,
        expectedUnit,
        actualOriginalValue: actualRaw,
        actualOriginalUnit: actualUnit,
        normalizedExpectedValue: normExpected,
        normalizedActualValue: normActualMin,
        canonicalUnit,
        result: "pass",
        explanation: `Values match within floating-point tolerance (${normActualMin.toFixed(2)} ${canonicalUnit}).`,
        supportingSource: sourceInfo,
      };
    }

    if (req.rule === "number-min") {
      // Part's maximum stated rating must be at least normExpected
      const partRating = parsedActual.isRange ? normActualMax : normActualMin;
      const passes = partRating >= normExpected || UnitConversionService.nearlyEqual(partRating, normExpected);

      if (!passes) {
        return {
          id: req.id,
          name: req.label,
          rule: req.rule,
          mandatory: req.mandatory,
          expectedValue: req.expectedValue,
          expectedUnit,
          actualOriginalValue: actualRaw,
          actualOriginalUnit: actualUnit,
          normalizedExpectedValue: normExpected,
          normalizedActualValue: partRating,
          canonicalUnit,
          result: "fail",
          explanation: `Requires at least ${expectedNum} ${expectedUnit}, but part rating is only ${parsedActual.max} ${actualUnit}.`,
          supportingSource: sourceInfo,
        };
      }

      if (!hasAdequateProvenance) {
        return {
          id: req.id,
          name: req.label,
          rule: req.rule,
          mandatory: req.mandatory,
          expectedValue: req.expectedValue,
          expectedUnit,
          actualOriginalValue: actualRaw,
          actualOriginalUnit: actualUnit,
          normalizedExpectedValue: normExpected,
          normalizedActualValue: partRating,
          canonicalUnit,
          result: "unverified",
          explanation: `Threshold satisfied, but lacks adequate source provenance.`,
          supportingSource: sourceInfo,
        };
      }

      return {
        id: req.id,
        name: req.label,
        rule: req.rule,
        mandatory: req.mandatory,
        expectedValue: req.expectedValue,
        expectedUnit,
        actualOriginalValue: actualRaw,
        actualOriginalUnit: actualUnit,
        normalizedExpectedValue: normExpected,
        normalizedActualValue: partRating,
        canonicalUnit,
        result: "pass",
        explanation: `Threshold satisfied: rating of ${parsedActual.max} ${actualUnit} meets minimum requirement.`,
        supportingSource: sourceInfo,
      };
    }

    if (req.rule === "number-max") {
      const partRating = parsedActual.isRange ? normActualMin : normActualMax;
      const passes = partRating <= normExpected || UnitConversionService.nearlyEqual(partRating, normExpected);

      if (!passes) {
        return {
          id: req.id,
          name: req.label,
          rule: req.rule,
          mandatory: req.mandatory,
          expectedValue: req.expectedValue,
          expectedUnit,
          actualOriginalValue: actualRaw,
          actualOriginalUnit: actualUnit,
          normalizedExpectedValue: normExpected,
          normalizedActualValue: partRating,
          canonicalUnit,
          result: "fail",
          explanation: `Requires at most ${expectedNum} ${expectedUnit}, but part is ${parsedActual.min} ${actualUnit}.`,
          supportingSource: sourceInfo,
        };
      }

      return {
        id: req.id,
        name: req.label,
        rule: req.rule,
        mandatory: req.mandatory,
        expectedValue: req.expectedValue,
        expectedUnit,
        actualOriginalValue: actualRaw,
        actualOriginalUnit: actualUnit,
        normalizedExpectedValue: normExpected,
        normalizedActualValue: partRating,
        canonicalUnit,
        result: hasAdequateProvenance ? "pass" : "unverified",
        explanation: hasAdequateProvenance
          ? `Maximum threshold satisfied.`
          : `Threshold satisfied, but lacks adequate source provenance.`,
        supportingSource: sourceInfo,
      };
    }

    if (req.rule === "number-within") {
      // Target operating value must sit inside the part's stated range [normActualMin, normActualMax]
      const aboveMin = normExpected >= normActualMin || UnitConversionService.nearlyEqual(normExpected, normActualMin);
      const belowMax = normExpected <= normActualMax || UnitConversionService.nearlyEqual(normExpected, normActualMax);
      const isInside = aboveMin && belowMax;

      if (!isInside) {
        return {
          id: req.id,
          name: req.label,
          rule: req.rule,
          mandatory: req.mandatory,
          expectedValue: req.expectedValue,
          expectedUnit,
          actualOriginalValue: actualRaw,
          actualOriginalUnit: actualUnit,
          normalizedExpectedValue: normExpected,
          normalizedActualValue: normActualMin,
          canonicalUnit,
          result: "fail",
          explanation: `Operating value of ${expectedNum} ${expectedUnit} is outside part's stated range ${actualRaw}.`,
          supportingSource: sourceInfo,
        };
      }

      if (!hasAdequateProvenance) {
        return {
          id: req.id,
          name: req.label,
          rule: req.rule,
          mandatory: req.mandatory,
          expectedValue: req.expectedValue,
          expectedUnit,
          actualOriginalValue: actualRaw,
          actualOriginalUnit: actualUnit,
          normalizedExpectedValue: normExpected,
          normalizedActualValue: normActualMin,
          canonicalUnit,
          result: "unverified",
          explanation: `Operating value sits within part range, but lacks adequate source provenance.`,
          supportingSource: sourceInfo,
        };
      }

      return {
        id: req.id,
        name: req.label,
        rule: req.rule,
        mandatory: req.mandatory,
        expectedValue: req.expectedValue,
        expectedUnit,
        actualOriginalValue: actualRaw,
        actualOriginalUnit: actualUnit,
        normalizedExpectedValue: normExpected,
        normalizedActualValue: normActualMin,
        canonicalUnit,
        result: "pass",
        explanation: `Operating value ${expectedNum} ${expectedUnit} falls within part's operating range ${actualRaw}.`,
        supportingSource: sourceInfo,
      };
    }

    return {
      id: req.id,
      name: req.label,
      rule: req.rule,
      mandatory: req.mandatory,
      expectedValue: req.expectedValue,
      result: "unverified",
      explanation: `Unknown evaluation path for numeric rule '${req.rule}'.`,
    };
  }

  /**
   * Helper to find matching spec in candidate part
   */
  private static findMatchingSpec(part: any, req: RequirementItem) {
    const specs: Array<{ label: string; value: string }> = part.specs || [];
    const allowedLabels = (req.specLabels && req.specLabels.length > 0 ? req.specLabels : [req.label]).map((l) =>
      l.trim().toLowerCase()
    );

    return specs.find((s) => allowedLabels.includes(s.label.trim().toLowerCase()));
  }

  /**
   * Extract any conflicting claims for this requirement
   */
  private static findConflictingClaims(part: any, req: RequirementItem) {
    const claims: any[] = part.sourceClaims || [];
    if (claims.length === 0) return [];

    const allowedLabels = (req.specLabels && req.specLabels.length > 0 ? req.specLabels : [req.label]).map((l) =>
      l.trim().toLowerCase()
    );

    const relevant = claims.filter((c) => allowedLabels.includes((c.label || "").trim().toLowerCase()));
    // Group distinct values
    const distinctValues = new Map<string, any>();
    for (const claim of relevant) {
      const val = (claim.claimedValue || "").trim().toLowerCase();
      if (val && !distinctValues.has(val)) {
        distinctValues.set(val, {
          value: claim.claimedValue,
          sourceName: claim.sourceRecord?.name,
          evidence: claim.evidence,
        });
      }
    }

    return Array.from(distinctValues.values());
  }

  /**
   * Helper to extract source and provenance details
   */
  private static extractSourceInfo(part: any, spec?: any): EvidenceReference | undefined {
    if (part.sourceClaims && part.sourceClaims.length > 0) {
      const claim = spec
        ? part.sourceClaims.find((c: any) => c.label.toLowerCase() === spec.label.toLowerCase())
        : part.sourceClaims[0];

      if (claim && claim.sourceRecord) {
        return {
          sourceName: claim.sourceRecord.name,
          sourceUrl: claim.sourceRecord.url || undefined,
          retrievedAt: claim.sourceRecord.retrievedAt?.toString(),
          isVerified: claim.sourceRecord.isVerified,
          claimEvidence: claim.evidence || undefined,
        };
      }
    }

    if (part.source) {
      return {
        sourceName: part.source.name,
        sourceUrl: part.source.url,
      };
    }

    return undefined;
  }

  private static cleanText(text: string): string {
    return text.toLowerCase().replace(/×/g, "x").replace(/[\s\-_]+/g, "");
  }
}
