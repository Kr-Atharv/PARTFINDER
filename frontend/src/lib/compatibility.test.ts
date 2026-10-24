import { describe, expect, it } from 'vitest'
import { assessPart } from '@/lib/compatibility'
import { researchedToPart } from '@/services/researchService'
import type { ResearchedPart } from '@/services/researchService'
import { makePart } from '@/test/fixtures'
import type { RequirementInput } from '@/types/compatibility'

const need = (values: Record<string, string>): RequirementInput => ({ target: '', values })

const researched = (specs: ResearchedPart['specs'], source: Partial<ResearchedPart['source']> = {}): ResearchedPart => ({
  id: 'r1',
  name: 'Researched seal',
  partNumber: 'R-1',
  manufacturer: 'Acme',
  domain: 'industrial',
  category: 'Seals',
  description: 'd',
  availability: 'unknown',
  specs,
  source: { name: 'Acme site', url: 'https://acme.test/r1', retrievedAt: '2026-01-01T00:00:00Z', ...source },
})

describe('requirement spec-label synonyms (ind.pressure reads "Max pressure" and "Operating pressure")', () => {
  it.each(['Max pressure', 'Operating pressure'])('a researched part listing "%s" is assessed against ind.pressure', (label) => {
    const part = researchedToPart(researched([{ label, value: '250', unit: 'bar' }, { label: 'Bore', value: '80 mm' }].map((s) => ({ ...s, value: s.label === label ? '250 bar' : s.value }))))
    const result = assessPart(part, need({ 'ind.pressure': '100' }))
    expect(result.status).toBe('potential_match')
    expect(result.fields[0].evidence).toMatchObject({ availability: 'source_with_url', valueFound: '250 bar' })
  })

  it('still reports a MISMATCH when the researched value is too low', () => {
    const part = researchedToPart(researched([{ label: 'Operating pressure', value: '60 bar' }]))
    expect(assessPart(part, need({ 'ind.pressure': '100' })).status).toBe('mismatch')
  })

  it('a label that is not a known synonym is not guessed: the field is Unverified (missing)', () => {
    const part = researchedToPart(researched([{ label: 'Burst strength', value: '900 bar' }]))
    const result = assessPart(part, need({ 'ind.pressure': '100' }))
    expect(result.status).toBe('unverified')
    expect(result.fields[0].reason).toBe('missing')
  })

  it('a matching value with no source URL is never a PASS (needs evidence)', () => {
    const part = researchedToPart(researched([{ label: 'Max pressure', value: '250 bar' }], { url: '' }))
    const result = assessPart(part, need({ 'ind.pressure': '100' }))
    expect(result.status).toBe('unverified')
    expect(result.fields[0].reason).toBe('no_evidence')
  })

  it('nothing entered for the domain means not assessed', () => {
    const result = assessPart(makePart({ specs: [{ label: 'Max pressure', value: '250 bar' }] }), need({}))
    expect(result.assessed).toBe(false)
    expect(result.status).toBeNull()
  })
})
