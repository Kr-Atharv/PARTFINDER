import { fieldsForDomain } from '@/data/requirementFields'
import { isKnownUnit, nearlyEqual, parseQuantity, toBase } from '@/lib/quantity'
import { safeExternalUrl } from '@/lib/safeUrl'
import type { DomainId, Part, PartSpec } from '@/types'
import type {
  AssessmentReport,
  CompatibilityStatus,
  EvidenceInfo,
  FieldAssessment,
  FieldErrors,
  PartAssessment,
  RequirementFieldDef,
  RequirementInput,
  RuleKind,
  StatusCounts,
  UnverifiedReason,
} from '@/types/compatibility'

/**
 * Deterministic, rule-based compatibility engine.
 *
 * It only compares what the user typed against what is written in the part
 * record. It never infers, estimates or fills in missing values, and it never
 * claims a part is safe to install.
 *
 * Part status:
 *  1. Any entered requirement fails            -> mismatch
 *  2. else any requirement cannot be verified  -> unverified
 *  3. else (all entered requirements pass, each with a source URL)
 *                                              -> potential_match
 * A passing value with no source URL is downgraded to unverified because the
 * evidence is insufficient. A failing value stays a mismatch (the cautious
 * direction), with the weaker evidence stated.
 */

export const MAX_TEXT_LENGTH = 60
export const MAX_TARGET_LENGTH = 80

export const constraintLabels: Record<RuleKind, string> = {
  'number-equals': 'Equal to',
  'number-min': 'At least',
  'number-max': 'At most',
  'number-within': 'Inside part range',
  'text-equals': 'Identical to',
  'text-contains': 'Includes',
  'list-contains': 'Listed for',
}

export const reasonLabels: Record<UnverifiedReason, string> = {
  missing: 'Not in record',
  contradictory: 'Conflicting values',
  unit: 'Unit not comparable',
  unreadable: 'Value unreadable',
  range: 'Range, not a single value',
  not_listed: 'Not listed',
  no_evidence: 'No source URL',
}

const labelKey = (label: string) => label.trim().toLowerCase().replace(/\s+/g, ' ')
const textKey = (value: string) => value.toLowerCase().replace(/×/g, 'x').replace(/[\s\-_]+/g, '')
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/* ------------------------------------------------------------------ */
/* Input handling                                                      */
/* ------------------------------------------------------------------ */

export const emptyRequirements: RequirementInput = { target: '', values: {} }

/** Fields for the given domains whose value has been entered. */
export function configuredFields(
  input: RequirementInput,
  domains: DomainId[],
): Array<{ def: RequirementFieldDef; raw: string }> {
  const result: Array<{ def: RequirementFieldDef; raw: string }> = []
  for (const domain of domains) {
    for (const def of fieldsForDomain(domain)) {
      const raw = (input.values[def.id] ?? '').trim()
      if (raw) result.push({ def, raw })
    }
  }
  return result
}

export function validateRequirements(input: RequirementInput, domains: DomainId[]): FieldErrors {
  const errors: FieldErrors = {}
  if (input.target.trim().length > MAX_TARGET_LENGTH) {
    errors.target = `Keep the target name under ${MAX_TARGET_LENGTH} characters.`
  }
  for (const { def, raw } of configuredFields(input, domains)) {
    if (def.input === 'number') {
      if (!/^[-+]?\d+(\.\d+)?$/.test(raw)) {
        errors[def.id] = 'Enter a number, using a dot for decimals.'
      } else if (!Number.isFinite(Number(raw)) || Math.abs(Number(raw)) > 1e9) {
        errors[def.id] = 'Enter a smaller number.'
      } else if (def.unit !== '°C' && Number(raw) < 0) {
        errors[def.id] = 'Enter zero or a positive number.'
      }
    } else if (def.input === 'select') {
      if (!def.options?.includes(raw)) errors[def.id] = 'Choose one of the listed options.'
    } else if (raw.length > MAX_TEXT_LENGTH) {
      errors[def.id] = `Keep this under ${MAX_TEXT_LENGTH} characters.`
    }
  }
  return errors
}

/* ------------------------------------------------------------------ */
/* Evidence                                                            */
/* ------------------------------------------------------------------ */

function buildEvidence(part: Part, specLabel?: string, valueFound?: string): EvidenceInfo {
  if (valueFound === undefined) return { availability: 'none', isDemo: part.isDemo }
  const sourceName = part.source.name?.trim() || undefined
  const sourceUrl = safeExternalUrl(part.source.url)
  const availability = sourceUrl ? 'source_with_url' : sourceName ? 'source_name_only' : 'none'
  return { availability, specLabel, valueFound, sourceName, sourceUrl, isDemo: part.isDemo }
}

/* ------------------------------------------------------------------ */
/* Single field                                                        */
/* ------------------------------------------------------------------ */

interface Outcome {
  status: CompatibilityStatus
  reason?: UnverifiedReason
  explanation: string
  specLabel?: string
  valueFound?: string
}

const unverified = (
  reason: UnverifiedReason,
  explanation: string,
  specLabel?: string,
  valueFound?: string,
): Outcome => ({ status: 'unverified', reason, explanation, specLabel, valueFound })

function findSpecs(part: Part, def: RequirementFieldDef): PartSpec[] {
  const wanted = def.specLabels.map(labelKey)
  return part.specs.filter((spec) => wanted.includes(labelKey(spec.label)))
}

function evaluateNumber(def: RequirementFieldDef, raw: string, specs: PartSpec[]): Outcome {
  const unit = def.unit ?? ''
  const required = Number(raw)
  const requiredBase = toBase(required, unit, unit)
  const first = specs[0]
  if (requiredBase === null) {
    return unverified('unit', `The unit “${unit}” cannot be compared.`, first.label, first.value)
  }

  const readings: Array<{ spec: PartSpec; min: number; max: number; isRange: boolean }> = []
  for (const spec of specs) {
    const quantity = parseQuantity(spec.value)
    if (!quantity) {
      return unverified('unreadable', `“${spec.label}” is recorded as “${spec.value}”, which cannot be read as a number.`, spec.label, spec.value)
    }
    if (!quantity.unit) {
      return unverified('unit', `“${spec.label}” (${spec.value}) has no unit, so it cannot be compared with ${raw} ${unit}.`, spec.label, spec.value)
    }
    const lo = toBase(quantity.min, quantity.unit, unit)
    const hi = toBase(quantity.max, quantity.unit, unit)
    if (lo === null || hi === null) {
      const why = isKnownUnit(quantity.unit) ? 'a different kind of unit' : 'an unrecognised unit'
      return unverified('unit', `“${spec.label}” (${spec.value}) uses ${why}; it cannot be compared with ${raw} ${unit}.`, spec.label, spec.value)
    }
    readings.push({ spec, min: lo, max: hi, isRange: quantity.isRange })
  }

  const head = readings[0]
  const conflicting = readings.find((r) => !nearlyEqual(r.min, head.min) || !nearlyEqual(r.max, head.max))
  if (conflicting) {
    return unverified(
      'contradictory',
      `The record lists conflicting values: “${head.spec.label}” ${head.spec.value} and “${conflicting.spec.label}” ${conflicting.spec.value}.`,
      head.spec.label,
      `${head.spec.value} / ${conflicting.spec.value}`,
    )
  }

  const { spec } = head
  const quoted = `“${spec.label}” is ${spec.value}`
  const base = { specLabel: spec.label, valueFound: spec.value }

  if (def.kind === 'number-within') {
    const inside = head.min <= requiredBase && requiredBase <= head.max
    return inside
      ? { status: 'potential_match', explanation: `${quoted}; ${raw} ${unit} is inside that range.`, ...base }
      : { status: 'mismatch', explanation: `${quoted}; ${raw} ${unit} is outside that range.`, ...base }
  }

  if (head.isRange) {
    return unverified('range', `${quoted}, a range. A single value is needed to check “${def.label}”.`, spec.label, spec.value)
  }

  const value = head.min
  const checks: Partial<Record<RuleKind, { pass: boolean; pos: string; neg: string }>> = {
    'number-equals': { pass: nearlyEqual(value, requiredBase), pos: `equals the required ${raw} ${unit}`, neg: `does not equal the required ${raw} ${unit}` },
    'number-min': { pass: value >= requiredBase, pos: `meets the required minimum of ${raw} ${unit}`, neg: `is below the required minimum of ${raw} ${unit}` },
    'number-max': { pass: value <= requiredBase, pos: `is within the allowed maximum of ${raw} ${unit}`, neg: `exceeds the allowed maximum of ${raw} ${unit}` },
  }
  const check = checks[def.kind]
  if (!check) return unverified('unreadable', 'No rule is defined for this requirement.', spec.label, spec.value)
  return check.pass
    ? { status: 'potential_match', explanation: `${quoted}; it ${check.pos}.`, ...base }
    : { status: 'mismatch', explanation: `${quoted}; it ${check.neg}.`, ...base }
}

function evaluateTextEquals(raw: string, specs: PartSpec[]): Outcome {
  const head = specs[0]
  const conflicting = specs.find((spec) => textKey(spec.value) !== textKey(head.value))
  if (conflicting) {
    return unverified(
      'contradictory',
      `The record lists conflicting values: “${head.label}” ${head.value} and “${conflicting.label}” ${conflicting.value}.`,
      head.label,
      `${head.value} / ${conflicting.value}`,
    )
  }
  const base = { specLabel: head.label, valueFound: head.value }
  return textKey(head.value) === textKey(raw)
    ? { status: 'potential_match', explanation: `“${head.label}” is ${head.value}; it is identical to the required ${raw}.`, ...base }
    : { status: 'mismatch', explanation: `“${head.label}” is ${head.value}; it is not identical to the required ${raw}.`, ...base }
}

function evaluateTextContains(raw: string, specs: PartSpec[]): Outcome {
  const joined = specs.map((spec) => spec.value).join(' / ')
  const haystack = joined.toLowerCase().replace(/\s+/g, ' ')
  const terms = raw.split(',').map((term) => term.trim().toLowerCase()).filter(Boolean)
  const absent = terms.filter(
    (term) => !new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}($|[^a-z0-9])`).test(haystack),
  )
  const base = { specLabel: specs[0].label, valueFound: joined }
  return absent.length === 0
    ? { status: 'potential_match', explanation: `“${specs[0].label}” is ${joined}; it includes ${terms.join(', ')}.`, ...base }
    : { status: 'mismatch', explanation: `“${specs[0].label}” is ${joined}; it does not include ${absent.join(', ')}.`, ...base }
}

function evaluateList(part: Part, raw: string): Outcome {
  const specLabel = 'Typical applications'
  if (part.usedIn.length === 0) {
    return unverified('missing', 'The record lists no typical applications.')
  }
  const valueFound = part.usedIn.join(', ')
  const listed = part.usedIn.some((entry) => entry.trim().toLowerCase() === raw.toLowerCase())
  return listed
    ? {
        status: 'potential_match',
        explanation: `${raw} is listed among the typical applications (${valueFound}). This is a class-level indication only, not model-specific fitment.`,
        specLabel,
        valueFound,
      }
    : unverified(
        'not_listed',
        `${raw} is not among the typical applications (${valueFound}). A typical-applications list is not exhaustive, so this does not show incompatibility.`,
        specLabel,
        valueFound,
      )
}

function assessField(def: RequirementFieldDef, raw: string, part: Part): FieldAssessment {
  let outcome: Outcome
  if (def.kind === 'list-contains') {
    outcome = evaluateList(part, raw)
  } else {
    const specs = findSpecs(part, def)
    if (specs.length === 0) {
      outcome = unverified('missing', `The record does not list ${def.specLabels.map((l) => `“${l}”`).join(' or ')}, so “${def.label}” cannot be checked.`)
    } else if (def.kind === 'text-equals') {
      outcome = evaluateTextEquals(raw, specs)
    } else if (def.kind === 'text-contains') {
      outcome = evaluateTextContains(raw, specs)
    } else {
      outcome = evaluateNumber(def, raw, specs)
    }
  }

  const evidence = buildEvidence(part, outcome.specLabel, outcome.valueFound)

  // A passing value needs a source URL to count as evidence-backed.
  if (outcome.status === 'potential_match' && evidence.availability !== 'source_with_url') {
    outcome = {
      ...outcome,
      status: 'unverified',
      reason: 'no_evidence',
      explanation: `${outcome.explanation} However, the record has no source URL to back this value, so it is not treated as a match.`,
    }
  } else if (outcome.status === 'mismatch' && evidence.availability !== 'source_with_url') {
    outcome = { ...outcome, explanation: `${outcome.explanation} The record has no source URL, so treat this as a warning to check.` }
  }

  return {
    fieldId: def.id,
    label: def.label,
    unit: def.unit,
    constraint: constraintLabels[def.kind],
    requiredValue: def.unit ? `${raw} ${def.unit}` : raw,
    status: outcome.status,
    reason: outcome.reason,
    explanation: outcome.explanation,
    evidence,
  }
}

/* ------------------------------------------------------------------ */
/* Part and report                                                     */
/* ------------------------------------------------------------------ */

export function countStatuses(fields: Array<{ status: CompatibilityStatus }>): StatusCounts {
  const counts: StatusCounts = { match: 0, mismatch: 0, unverified: 0, total: fields.length }
  for (const field of fields) {
    if (field.status === 'potential_match') counts.match += 1
    else if (field.status === 'mismatch') counts.mismatch += 1
    else counts.unverified += 1
  }
  return counts
}

export function overallStatus(counts: StatusCounts): CompatibilityStatus | null {
  if (counts.total === 0) return null
  if (counts.mismatch > 0) return 'mismatch'
  if (counts.unverified > 0) return 'unverified'
  return 'potential_match'
}

function summarise(status: CompatibilityStatus | null, fields: FieldAssessment[], counts: StatusCounts): string {
  const names = (wanted: CompatibilityStatus) =>
    fields.filter((field) => field.status === wanted).map((field) => field.label).join(', ')
  if (status === 'mismatch') {
    return `${counts.mismatch} of ${counts.total} entered requirements fail (${names('mismatch')}).`
  }
  if (status === 'unverified') {
    return `No entered requirement fails, but ${counts.unverified} of ${counts.total} could not be verified (${names('unverified')}).`
  }
  if (status === 'potential_match') {
    return `All ${counts.total} entered requirements are met by the recorded values, each with a source reference. This is not an installation guarantee.`
  }
  return 'No requirements were entered for this part’s domain.'
}

export function assessPart(part: Part, input: RequirementInput): PartAssessment {
  const fields = configuredFields(input, [part.domain]).map(({ def, raw }) => assessField(def, raw, part))
  const counts = countStatuses(fields)
  const status = overallStatus(counts)
  return { partId: part.id, assessed: fields.length > 0, status, fields, counts, summary: summarise(status, fields, counts) }
}

export function assessParts(parts: Part[], input: RequirementInput): AssessmentReport {
  const assessments = parts.map((part) => assessPart(part, input))
  const partTotals = { potential_match: 0, mismatch: 0, unverified: 0, notAssessed: 0 }
  for (const assessment of assessments) {
    if (assessment.status === null) partTotals.notAssessed += 1
    else partTotals[assessment.status] += 1
  }
  return { target: input.target.trim(), parts: assessments, partTotals }
}
