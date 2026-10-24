import { afterEach, describe, expect, it, vi } from 'vitest'
import { fieldsForDomain } from '@/data/requirementFields'
import { ApiError } from '@/services/api'
import { assessCompatibility, inferReason, mapBackendPartResult, toCandidate } from '@/services/compatibilityService'
import type { BackendPartResult, BackendRequirementResult } from '@/services/compatibilityService'
import { makePart } from '@/test/fixtures'
import type { RequirementInput } from '@/types/compatibility'

const defs = fieldsForDomain('industrial')
const pressureReq: RequirementInput = { target: 'Press 7', values: { 'ind.pressure': '100' } }

const req = (over: Partial<BackendRequirementResult> = {}): BackendRequirementResult => ({
  id: 'ind.pressure',
  name: 'Operating pressure',
  rule: 'number-min',
  mandatory: true,
  expectedValue: '100',
  expectedUnit: 'bar',
  actualOriginalValue: '250 bar',
  result: 'pass',
  explanation: '250 bar is at least 100 bar.',
  supportingSource: { sourceName: 'Acme', sourceUrl: 'https://acme.test/p', claimEvidence: 'Max pressure 250 bar', retrievedAt: '2026-01-01T00:00:00Z' },
  ...over,
})

const backendResult = (partId: string, status: BackendPartResult['status'], requirements: BackendRequirementResult[]): BackendPartResult => ({
  partId,
  status,
  summary: { passed: 0, failed: 0, unverified: 0, total: requirements.length },
  requirements,
})

const part = makePart({ id: 'p1', specs: [{ label: 'Max pressure', value: '250 bar' }] })

describe('mapBackendPartResult', () => {
  it('maps pass/fail/unverified and overall status straight from the backend', () => {
    const a = mapBackendPartResult(part, backendResult('p1', 'POTENTIAL_MATCH', [req()]), defs)
    expect(a.status).toBe('potential_match')
    expect(a.engine).toBe('backend')
    expect(a.fields[0].status).toBe('potential_match')
    expect(a.counts).toMatchObject({ match: 1, mismatch: 0, unverified: 0, total: 1 })

    const b = mapBackendPartResult(part, backendResult('p1', 'MISMATCH', [req({ result: 'fail', explanation: '60 bar is below 100 bar.', actualOriginalValue: '60 bar' })]), defs)
    expect(b.status).toBe('mismatch')
    expect(b.fields[0].status).toBe('mismatch')

    const c = mapBackendPartResult(part, backendResult('p1', 'UNVERIFIED', [req({ result: 'unverified', actualOriginalValue: undefined, explanation: 'Not listed in the part record.', supportingSource: undefined })]), defs)
    expect(c.status).toBe('unverified')
    expect(c.fields[0].reason).toBe('missing')
    expect(c.fields[0].evidence.availability).toBe('none')
  })

  it('does not re-judge: the backend overall status wins over the field mix', () => {
    const a = mapBackendPartResult(part, backendResult('p1', 'UNVERIFIED', [req()]), defs)
    expect(a.status).toBe('unverified')
  })

  it('keeps evidence, source and retrieval time, and only accepts safe http(s) URLs', () => {
    const ok = mapBackendPartResult(part, backendResult('p1', 'POTENTIAL_MATCH', [req()]), defs).fields[0].evidence
    expect(ok).toMatchObject({ availability: 'source_with_url', sourceUrl: 'https://acme.test/p', sourceName: 'Acme', claimEvidence: 'Max pressure 250 bar', retrievedAt: '2026-01-01T00:00:00Z', valueFound: '250 bar', specLabel: 'Max pressure' })
    const bad = mapBackendPartResult(part, backendResult('p1', 'POTENTIAL_MATCH', [req({ supportingSource: { sourceName: 'X', sourceUrl: 'javascript:alert(1)' } })]), defs).fields[0].evidence
    expect(bad.sourceUrl).toBeUndefined()
    expect(bad.availability).toBe('source_name_only')
  })

  it('appends conflicting values to the explanation', () => {
    const f = mapBackendPartResult(
      part,
      backendResult('p1', 'UNVERIFIED', [req({ result: 'unverified', explanation: 'Sources report conflicting values.', conflictingClaims: [{ value: '250 bar', sourceName: 'A' }, { value: '100 bar', sourceName: 'B' }] })]),
      defs,
    ).fields[0]
    expect(f.reason).toBe('contradictory')
    expect(f.explanation).toContain('“250 bar” (A) vs “100 bar” (B)')
  })

  it('a result with no requirements is not assessed', () => {
    const a = mapBackendPartResult(part, backendResult('p1', 'UNVERIFIED', []), defs)
    expect(a.assessed).toBe(false)
    expect(a.status).toBeNull()
  })
})

describe('inferReason', () => {
  it('only classifies unverified results', () => {
    expect(inferReason(req({ result: 'pass' }))).toBeUndefined()
    expect(inferReason(req({ result: 'fail' }))).toBeUndefined()
  })
  it('classifies by explanation text', () => {
    const u = (explanation: string, extra: Partial<BackendRequirementResult> = {}) => inferReason(req({ result: 'unverified', explanation, ...extra }))
    expect(u('Value found but provenance is missing.')).toBe('no_evidence')
    expect(u('The part provides a range.')).toBe('range')
    expect(u('Unit mismatch: dimension differs.')).toBe('unit')
    expect(u('Something else', { actualOriginalValue: undefined })).toBe('missing')
  })
})

describe('toCandidate', () => {
  it('sends specs and claims with their evidence', () => {
    const c = toCandidate(makePart({ specs: [{ label: 'A', value: '1' }], claims: [{ label: 'A', value: '1', evidence: 'A is 1', sourceName: 'S', sourceUrl: 'https://s.test' }] }))
    expect(c.specs).toEqual([{ label: 'A', value: '1' }])
    expect(c.sourceClaims?.[0]).toMatchObject({ label: 'A', claimedValue: '1', evidence: 'A is 1', sourceRecord: { name: 'S', url: 'https://s.test' } })
  })
})

describe('assessCompatibility', () => {
  afterEach(() => vi.unstubAllGlobals())

  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  it('uses the backend verdict when the server answers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { data: { totalAssessed: 1, assessments: [backendResult('p1', 'MISMATCH', [req({ result: 'fail', explanation: 'too low' })])] } }))
    vi.stubGlobal('fetch', fetchMock)
    const report = await assessCompatibility([part], pressureReq)
    expect(report.engine).toBe('backend')
    expect(report.fallbackReason).toBeUndefined()
    // The server said MISMATCH even though the local rules would pass this part: the server wins.
    expect(report.parts[0].status).toBe('mismatch')
    expect(report.partTotals).toMatchObject({ mismatch: 1, potential_match: 0 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/compatibility/check')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.domain).toBe('industrial')
    expect(body.partIds).toEqual(['p1'])
    expect(body.requirements[0]).toMatchObject({ id: 'ind.pressure', expectedValue: '100', rule: 'number-min' })
  })

  it('falls back to the local engine, labelled, when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const report = await assessCompatibility([part], pressureReq)
    expect(report.engine).toBe('local')
    expect(report.fallbackReason).toMatch(/could not be reached/i)
    expect(report.parts[0].engine).toBe('local')
    expect(report.parts[0].status).toBe('potential_match')
  })

  it('falls back on a 5xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(503, { error: { message: 'down', code: 'UPSTREAM' } })))
    const report = await assessCompatibility([part], pressureReq)
    expect(report.engine).toBe('local')
    expect(report.fallbackReason).toContain('down')
  })

  it('surfaces a 4xx rejection as an error instead of silently using the local engine', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(400, { error: { message: 'bad requirement', code: 'VALIDATION_ERROR' } })))
    await expect(assessCompatibility([part], pressureReq)).rejects.toBeInstanceOf(ApiError)
  })

  it('reports mixed when the server returns a result for only some parts', async () => {
    const second = makePart({ id: 'p2', specs: [{ label: 'Max pressure', value: '40 bar' }] })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, { data: { totalAssessed: 1, assessments: [backendResult('p1', 'POTENTIAL_MATCH', [req()])] } })))
    const report = await assessCompatibility([part, second], pressureReq)
    expect(report.engine).toBe('mixed')
    expect(report.fallbackReason).toMatch(/no result for 1 part/)
    expect(report.parts[1].engine).toBe('local')
    expect(report.parts[1].status).toBe('mismatch')
  })

  it('does not call the server when nothing is entered', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const report = await assessCompatibility([part], { target: '', values: {} })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(report.parts[0].assessed).toBe(false)
    expect(report.partTotals.notAssessed).toBe(1)
  })

  it('passes an abort through as an ABORTED error, not a fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')))
    await expect(assessCompatibility([part], pressureReq, new AbortController().signal)).rejects.toMatchObject({ code: 'ABORTED' })
  })
})
