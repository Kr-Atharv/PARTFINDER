import { constraintLabels, assessPart, configuredFields, countStatuses, summarise } from '@/lib/compatibility'
import { safeExternalUrl } from '@/lib/safeUrl'
import { ApiError, apiFetch } from '@/services/api'
import type { DomainId, Part } from '@/types'
import type {
  AssessmentReport,
  CompatibilityStatus,
  EvidenceInfo,
  FieldAssessment,
  PartAssessment,
  RequirementFieldDef,
  RequirementInput,
  UnverifiedReason,
} from '@/types/compatibility'

/**
 * Compatibility service boundary.
 *
 * The verdict shown to the user is the one returned by POST /api/compatibility/check
 * (deterministic backend engine). The local engine in lib/compatibility.ts is used only
 * when the backend is unavailable, and every result then says so (`engine: 'local'`,
 * `fallbackReason`). A request the backend rejects (4xx) is surfaced as an error.
 */

/* ------------------------------------------------------------------ */
/* Backend wire types                                                  */
/* ------------------------------------------------------------------ */

export interface BackendRequirementResult {
  id: string
  name: string
  rule: string
  mandatory: boolean
  expectedValue: string
  expectedUnit?: string
  actualOriginalValue?: string
  result: 'pass' | 'fail' | 'unverified'
  explanation: string
  supportingSource?: {
    sourceName?: string
    sourceUrl?: string
    retrievedAt?: string
    isVerified?: boolean
    claimEvidence?: string
  }
  conflictingClaims?: Array<{ value: string; sourceName?: string; evidence?: string }>
}

export interface BackendPartResult {
  partId: string
  status: 'POTENTIAL_MATCH' | 'MISMATCH' | 'UNVERIFIED'
  summary: { passed: number; failed: number; unverified: number; total: number }
  requirements: BackendRequirementResult[]
}

interface BackendCheckResponse {
  totalAssessed: number
  assessments: BackendPartResult[]
}

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

const STATUS_MAP: Record<BackendRequirementResult['result'], CompatibilityStatus> = {
  pass: 'potential_match',
  fail: 'mismatch',
  unverified: 'unverified',
}

const OVERALL_MAP: Record<BackendPartResult['status'], CompatibilityStatus> = {
  POTENTIAL_MATCH: 'potential_match',
  MISMATCH: 'mismatch',
  UNVERIFIED: 'unverified',
}

/**
 * The backend gives a free-text explanation for unverified results; classify it into the
 * same reason codes the UI already labels. Only used for display, never to change a status.
 */
export function inferReason(result: BackendRequirementResult): UnverifiedReason | undefined {
  if (result.result !== 'unverified') return undefined
  const text = result.explanation.toLowerCase()
  if ((result.conflictingClaims?.length ?? 0) > 1 || text.includes('conflicting')) return 'contradictory'
  if (text.includes('provenance') || text.includes('source url')) return 'no_evidence'
  if (text.includes('not listed in the part record') || text.includes('no documented fitment')) return 'missing'
  if (text.includes('does not list') || text.includes('typical applications')) return 'not_listed'
  if (text.includes('provides a range') || text.includes('a range')) return 'range'
  if (text.includes('unit') || text.includes('dimension')) return 'unit'
  if (text.includes('unreadable') || text.includes('could not be parsed')) return 'unreadable'
  return result.actualOriginalValue === undefined ? 'missing' : undefined
}

function buildEvidence(part: Part, def: RequirementFieldDef | undefined, result: BackendRequirementResult): EvidenceInfo {
  const source = result.supportingSource
  const sourceUrl = safeExternalUrl(source?.sourceUrl)
  const sourceName = source?.sourceName?.trim() || undefined
  const hasValue = result.actualOriginalValue !== undefined
  const wanted = def?.specLabels.map((l) => l.trim().toLowerCase()) ?? []
  const spec = part.specs.find((s) => wanted.includes(s.label.trim().toLowerCase()))
  return {
    availability: !hasValue ? 'none' : sourceUrl ? 'source_with_url' : sourceName ? 'source_name_only' : 'none',
    specLabel: result.rule === 'list-contains' ? 'Typical applications' : spec?.label,
    valueFound: result.actualOriginalValue,
    sourceName,
    sourceUrl,
    isDemo: part.isDemo,
    claimEvidence: source?.claimEvidence,
    retrievedAt: source?.retrievedAt,
  }
}

function describeConflicts(result: BackendRequirementResult): string {
  const claims = result.conflictingClaims ?? []
  if (claims.length < 2) return ''
  const list = claims.map((c) => `“${c.value}”${c.sourceName ? ` (${c.sourceName})` : ''}`).join(' vs ')
  return ` Conflicting values: ${list}.`
}

/**
 * Maps one backend part result to the PartAssessment the UI renders.
 * pass -> potential_match, fail -> mismatch, unverified -> unverified; explanations and evidence
 * come straight from the backend, nothing is re-judged here.
 */
export function mapBackendPartResult(
  part: Part,
  result: BackendPartResult,
  defs: RequirementFieldDef[],
): PartAssessment {
  const defById = new Map(defs.map((def) => [def.id, def]))
  const fields: FieldAssessment[] = result.requirements.map((req) => {
    const def = defById.get(req.id)
    const unit = def?.unit ?? req.expectedUnit
    return {
      fieldId: req.id,
      label: req.name,
      unit,
      constraint: def ? constraintLabels[def.kind] : req.rule,
      requiredValue: unit ? `${req.expectedValue} ${unit}` : req.expectedValue,
      status: STATUS_MAP[req.result] ?? 'unverified',
      reason: inferReason(req),
      explanation: `${req.explanation}${describeConflicts(req)}`.trim(),
      evidence: buildEvidence(part, def, req),
    }
  })
  const counts = countStatuses(fields)
  const status = OVERALL_MAP[result.status] ?? null
  return {
    partId: part.id,
    assessed: fields.length > 0,
    status: fields.length > 0 ? status : null,
    fields,
    counts,
    summary: summarise(fields.length > 0 ? status : null, fields, counts),
    engine: 'backend',
  }
}

/* ------------------------------------------------------------------ */
/* Request building                                                    */
/* ------------------------------------------------------------------ */

/** The shape the backend accepts for a candidate part. Claims keep their evidence and source. */
export function toCandidate(part: Part) {
  return {
    id: part.id,
    name: part.name,
    partNumber: part.partNumber,
    manufacturer: part.manufacturer,
    domain: part.domain,
    category: part.category,
    description: part.description,
    availability: part.availability,
    usedIn: part.usedIn,
    specs: part.specs.map((spec) => ({ label: spec.label, value: spec.value })),
    source: { name: part.source.name, url: part.source.url },
    sourceClaims: part.claims?.map((claim) => ({
      label: claim.label,
      claimedValue: claim.value,
      unit: claim.unit,
      evidence: claim.evidence,
      sourceUrl: claim.sourceUrl,
      sourceRecord: claim.sourceName || claim.sourceUrl ? { name: claim.sourceName, url: claim.sourceUrl } : undefined,
    })),
  }
}

export function toRequirementItems(defs: Array<{ def: RequirementFieldDef; raw: string }>) {
  return defs.map(({ def, raw }) => ({
    id: def.id,
    label: def.label,
    expectedValue: raw,
    expectedUnit: def.unit,
    rule: def.kind,
    mandatory: true,
    specLabels: def.specLabels,
  }))
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

function emptyTotals() {
  return { potential_match: 0, mismatch: 0, unverified: 0, notAssessed: 0 }
}

export async function assessCompatibility(
  parts: Part[],
  requirements: RequirementInput,
  signal?: AbortSignal,
): Promise<AssessmentReport> {
  const byDomain = new Map<DomainId, Part[]>()
  for (const part of parts) byDomain.set(part.domain, [...(byDomain.get(part.domain) ?? []), part])

  const assessments = new Map<string, PartAssessment>()
  const fallbackReasons: string[] = []

  for (const [domain, domainParts] of byDomain) {
    const configured = configuredFields(requirements, [domain])
    if (configured.length === 0) {
      // Nothing entered for this domain: nothing to assess, and no engine involved.
      for (const part of domainParts) assessments.set(part.id, assessPart(part, requirements))
      continue
    }

    const defs = configured.map((entry) => entry.def)
    let response: BackendCheckResponse | null = null
    try {
      response = await apiFetch<BackendCheckResponse>('/api/compatibility/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          partIds: domainParts.map((p) => p.id),
          candidateParts: domainParts.map(toCandidate),
          requirements: toRequirementItems(configured),
        }),
        signal,
      })
    } catch (error) {
      if (error instanceof ApiError && error.isUnavailable && error.code !== 'ABORTED') {
        fallbackReasons.push(error.message)
      } else {
        throw error
      }
    }

    const results = new Map((response?.assessments ?? []).map((r) => [r.partId, r]))
    let missing = 0
    for (const part of domainParts) {
      const result = results.get(part.id)
      if (result) {
        assessments.set(part.id, mapBackendPartResult(part, result, defs))
      } else {
        if (response) missing += 1
        assessments.set(part.id, assessPart(part, requirements))
      }
    }
    if (missing > 0) {
      fallbackReasons.push(`The server returned no result for ${missing} part${missing === 1 ? '' : 's'}.`)
    }
  }

  const ordered = parts.map((part) => assessments.get(part.id)!)
  const totals = emptyTotals()
  for (const a of ordered) {
    if (a.status === null) totals.notAssessed += 1
    else totals[a.status] += 1
  }
  const engines = new Set(ordered.filter((a) => a.assessed).map((a) => a.engine))
  const engine = engines.size > 1 ? 'mixed' : engines.has('local') ? 'local' : 'backend'
  return {
    target: requirements.target.trim(),
    engine,
    fallbackReason: fallbackReasons.length > 0 ? Array.from(new Set(fallbackReasons)).join(' ') : undefined,
    parts: ordered,
    partTotals: totals,
  }
}
