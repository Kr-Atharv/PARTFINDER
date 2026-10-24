import { describe, expect, it } from 'vitest'
import { buildSearchParams, normalizeCriteria, paramsToCriteria, paramsToDraft, paramsToPaging, paramsToRefinements } from '@/lib/validation'
import type { SearchCriteria } from '@/types'

const criteria: SearchCriteria = { query: 'seal kit', domain: 'industrial', manufacturer: 'Acme', model: 'P7' }

describe('buildSearchParams <-> paramsTo*', () => {
  it('round-trips criteria, refinements and paging', () => {
    const params = buildSearchParams(
      criteria,
      { category: 'Seals', availability: 'in_stock', specLabel: 'Max pressure', specValue: '250' },
      { page: 3, pageSize: 50, sort: 'manufacturer-desc' },
    )
    const read = new URLSearchParams(params.toString())
    expect(paramsToDraft(read)).toEqual(criteria)
    expect(paramsToRefinements(read)).toEqual({ category: 'Seals', availability: 'in_stock', specLabel: 'Max pressure', specValue: '250' })
    expect(paramsToPaging(read)).toEqual({ page: 3, pageSize: 50, sort: 'manufacturer-desc' })
    expect(paramsToCriteria(read)).toEqual(criteria)
  })

  it('omits defaults so links stay short', () => {
    const text = buildSearchParams(criteria, undefined, { page: 1, pageSize: 20, sort: 'name-asc' }).toString()
    expect(text).not.toMatch(/page=|size=|sort=/)
  })

  it('drops an empty query and adds browse / tab only when asked', () => {
    const text = buildSearchParams({ ...criteria, query: '' }, undefined, {}, { browse: true, tab: 'research' }).toString()
    expect(text).not.toContain('q=')
    expect(text).toContain('browse=1')
    expect(text).toContain('tab=research')
  })

  it('ignores invalid URL values instead of trusting them', () => {
    const read = new URLSearchParams('q=x&domain=bogus&avail=nope&sort=weird&size=7&page=-2')
    expect(paramsToDraft(read).domain).toBeNull()
    expect(paramsToRefinements(read).availability).toBe('')
    expect(paramsToPaging(read)).toEqual({ page: 1, pageSize: 20, sort: 'name-asc' })
  })

  it('a URL with no query and no browse intent is not a runnable search', () => {
    expect(paramsToCriteria(new URLSearchParams(''))).toBeNull()
    expect(paramsToCriteria(new URLSearchParams('domain=automotive'))).not.toBeNull()
  })

  it('normalizeCriteria trims', () => {
    expect(normalizeCriteria({ query: '  a ', domain: null, manufacturer: ' b', model: 'c ' })).toEqual({ query: 'a', domain: null, manufacturer: 'b', model: 'c' })
  })
})
