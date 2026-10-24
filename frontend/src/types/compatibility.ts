import type { DomainId } from '@/types'

/** The only three compatibility statuses used anywhere in the app. */
export type CompatibilityStatus = 'potential_match' | 'mismatch' | 'unverified'

/** Why a field is Unverified. Shown to the user next to the status. */
export type UnverifiedReason =
  | 'missing' // the part record does not list the specification
  | 'contradictory' // the record lists conflicting values for it
  | 'unit' // value present but its unit cannot be compared
  | 'unreadable' // value present but cannot be read as the expected kind
  | 'range' // a range was given where a single value is needed
  | 'not_listed' // not in the list of typical applications (absence is not proof)
  | 'no_evidence' // rule passes but there is no source URL to back the value

export type RuleKind =
  | 'number-equals' // part value must equal the required number
  | 'number-min' // part rating must be at least the required number
  | 'number-max' // part value must be at most the required number
  | 'number-within' // required number must sit inside the part's range
  | 'text-equals' // normalised text must be identical
  | 'text-contains' // part text must include every required term
  | 'list-contains' // part's typical-application list must include the entry

export type InputKind = 'number' | 'text' | 'select'

export interface RequirementFieldDef {
  /** Globally unique, e.g. "ind.bore". */
  id: string
  domain: DomainId
  label: string
  kind: RuleKind
  input: InputKind
  /** Unit symbol the user types the number in (also shown as a suffix). */
  unit?: string
  /** Exact spec labels in a part record that this requirement reads. */
  specLabels: string[]
  /** One-line explanation of the rule, shown in the form. */
  hint: string
  placeholder?: string
  /** Choices for select inputs. */
  options?: string[]
}

/** What the user typed. Empty strings mean "not configured". */
export interface RequirementInput {
  /** Free-text name of the target machine, board or vehicle. Context only. */
  target: string
  values: Record<string, string>
}

export type EvidenceAvailability = 'source_with_url' | 'source_name_only' | 'none'

export interface EvidenceInfo {
  availability: EvidenceAvailability
  /** The record field the value was read from (e.g. "Max pressure"). */
  specLabel?: string
  /** The value exactly as recorded. */
  valueFound?: string
  sourceName?: string
  /** Only set when it is a well-formed http(s) URL. */
  sourceUrl?: string
  /** True when the underlying record is an invented demo record. */
  isDemo: boolean
}

export interface FieldAssessment {
  fieldId: string
  label: string
  unit?: string
  /** "At least", "Equal to", ... */
  constraint: string
  /** What the user required, as typed. */
  requiredValue: string
  status: CompatibilityStatus
  reason?: UnverifiedReason
  /** Plain-language explanation of exactly how the status was reached. */
  explanation: string
  evidence: EvidenceInfo
}

export interface StatusCounts {
  match: number
  mismatch: number
  unverified: number
  total: number
}

export interface PartAssessment {
  partId: string
  /** False when nothing was entered for this part's domain. */
  assessed: boolean
  status: CompatibilityStatus | null
  fields: FieldAssessment[]
  counts: StatusCounts
  summary: string
}

export interface AssessmentReport {
  target: string
  parts: PartAssessment[]
  /** Number of parts per overall status, derived from `parts`. */
  partTotals: Record<CompatibilityStatus, number> & { notAssessed: number }
}

export type FieldErrors = Record<string, string>
