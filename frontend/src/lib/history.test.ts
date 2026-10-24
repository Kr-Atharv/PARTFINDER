import { describe, expect, it } from 'vitest'
import { describeSearch, filterComparisons, filterSaved, filterSearches, pageOf, searchLink, sortComparisons, sortSaved, sortSearches } from '@/lib/history'
import { paramsToCriteria } from '@/lib/validation'
import type { ComparisonRecord, RecentSearch, SavedPart } from '@/state/userData'
import { makePart } from '@/test/fixtures'

const search = (over: Partial<RecentSearch>): RecentSearch => ({ id: 'x', kind: 'catalogue', query: 'q', domain: null, manufacturer: '', model: '', at: '2026-01-01T00:00:00.000Z', ...over })

describe('searchLink', () => {
  it('reopens a catalogue search on /find', () => {
    const link = searchLink(search({ query: 'seal kit', domain: 'industrial', manufacturer: 'Acme' }))
    expect(link.startsWith('/find?')).toBe(true)
    const params = new URLSearchParams(link.split('?')[1])
    expect(params.get('tab')).toBeNull()
    expect(paramsToCriteria(params)).toEqual({ query: 'seal kit', domain: 'industrial', manufacturer: 'Acme', model: '' })
  })
  it('opens the research tab for research searches', () => {
    expect(searchLink(search({ kind: 'research', query: 'pump' }))).toContain('tab=research')
  })
})

describe('describeSearch', () => {
  it('uses what was entered and falls back to a plain description', () => {
    expect(describeSearch(search({ query: 'seal', manufacturer: 'Acme', model: 'P7' }))).toBe('seal · manufacturer: Acme · model: P7')
    expect(describeSearch(search({ query: '', domain: 'automotive' }))).toBe('All automotive parts')
    expect(describeSearch(search({ query: '' }))).toBe('Browse all parts')
  })
})

describe('search filtering and sorting', () => {
  const list = [
    search({ id: '1', query: 'pump', at: '2026-01-02T00:00:00.000Z' }),
    search({ id: '2', query: 'Alpha seal', kind: 'research', at: '2026-01-03T00:00:00.000Z' }),
    search({ id: '3', query: 'brake', at: '2026-01-01T00:00:00.000Z' }),
  ]
  it('filters by text and kind', () => {
    expect(filterSearches(list, { text: 'SEAL' }).map((s) => s.id)).toEqual(['2'])
    expect(filterSearches(list, { kind: 'research' }).map((s) => s.id)).toEqual(['2'])
    expect(filterSearches(list, { kind: 'all' })).toHaveLength(3)
  })
  it('sorts newest, oldest and by query without mutating the input', () => {
    const copy = [...list]
    expect(sortSearches(list, 'newest').map((s) => s.id)).toEqual(['2', '1', '3'])
    expect(sortSearches(list, 'oldest').map((s) => s.id)).toEqual(['3', '1', '2'])
    expect(sortSearches(list, 'query').map((s) => s.id)).toEqual(['2', '3', '1'])
    expect(list).toEqual(copy)
  })
})

describe('comparison and saved helpers', () => {
  const record = (id: string, at: string, names: string[]): ComparisonRecord => ({ id, key: id, at, parts: names.map((n) => makePart({ id: n, name: n })) })
  const comps = [record('a', '2026-01-01T00:00:00.000Z', ['Seal', 'Ring']), record('b', '2026-01-02T00:00:00.000Z', ['Pump', 'Valve'])]

  it('filters comparisons by any part and sorts by time', () => {
    expect(filterComparisons(comps, 'valve').map((c) => c.id)).toEqual(['b'])
    expect(filterComparisons(comps, '')).toHaveLength(2)
    expect(sortComparisons(comps, 'newest').map((c) => c.id)).toEqual(['b', 'a'])
    expect(sortComparisons(comps, 'oldest').map((c) => c.id)).toEqual(['a', 'b'])
  })

  const saved: SavedPart[] = [
    { part: makePart({ id: '1', name: 'Zeta', manufacturer: 'Acme', domain: 'industrial' }), savedAt: '2026-01-01T00:00:00.000Z' },
    { part: makePart({ id: '2', name: 'Alpha', manufacturer: 'Zed', domain: 'automotive' }), savedAt: '2026-01-02T00:00:00.000Z' },
  ]
  it('filters and sorts saved parts', () => {
    expect(filterSaved(saved, { domain: 'automotive' }).map((s) => s.part.id)).toEqual(['2'])
    expect(filterSaved(saved, { text: 'acme' }).map((s) => s.part.id)).toEqual(['1'])
    expect(sortSaved(saved, 'recent').map((s) => s.part.id)).toEqual(['2', '1'])
    expect(sortSaved(saved, 'name').map((s) => s.part.id)).toEqual(['2', '1'])
    expect(sortSaved(saved, 'manufacturer').map((s) => s.part.id)).toEqual(['1', '2'])
  })
})

describe('pageOf', () => {
  const items = Array.from({ length: 25 }, (_, i) => i)
  it('slices and clamps', () => {
    expect(pageOf(items, 1, 10)).toMatchObject({ page: 1, totalPages: 3, total: 25 })
    expect(pageOf(items, 3, 10).items).toEqual([20, 21, 22, 23, 24])
    expect(pageOf(items, 99, 10).page).toBe(3)
    expect(pageOf(items, 0, 10).page).toBe(1)
    expect(pageOf([], 1, 10)).toMatchObject({ items: [], totalPages: 1, total: 0 })
  })
})
