import { beforeEach, describe, expect, it } from 'vitest'
import {
  MAX_COMPARISONS,
  MAX_RECENT_SEARCHES,
  MAX_SAVED,
  MAX_VIEWED,
  addComparison,
  addRecentSearch,
  bumpView,
  comparisonKey,
  comparisonsStore,
  sanitizeComparisons,
  sanitizeSaved,
  sanitizeSearches,
  sanitizeViewed,
  savedStore,
  searchKey,
  searchesStore,
  toggleSaved,
  userData,
  viewedStore,
} from '@/state/userData'
import type { RecentSearch } from '@/state/userData'
import { makePart } from '@/test/fixtures'

const at = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, n))
const input = (query: string, extra: Partial<Omit<RecentSearch, 'id' | 'at'>> = {}) => ({ kind: 'catalogue' as const, query, domain: null, manufacturer: '', model: '', ...extra })

describe('recent searches', () => {
  it('puts the newest first and moves a repeated search to the top instead of duplicating', () => {
    let list: RecentSearch[] = []
    list = addRecentSearch(list, input('seal'), at(1))
    list = addRecentSearch(list, input('pump'), at(2))
    list = addRecentSearch(list, input('  SEAL '), at(3))
    expect(list.map((s) => s.query)).toEqual(['SEAL', 'pump'])
    expect(list[0].at).toBe(at(3).toISOString())
  })

  it('treats catalogue and research searches (and other domains) as different', () => {
    const a = input('seal')
    expect(searchKey(a)).not.toBe(searchKey({ ...a, kind: 'research' }))
    expect(searchKey(a)).not.toBe(searchKey({ ...a, domain: 'automotive' }))
  })

  it('ignores a completely empty search and caps the list', () => {
    expect(addRecentSearch([], input('   '))).toEqual([])
    let list: RecentSearch[] = []
    for (let i = 0; i < MAX_RECENT_SEARCHES + 5; i++) list = addRecentSearch(list, input(`q${i}`), at(i))
    expect(list).toHaveLength(MAX_RECENT_SEARCHES)
    expect(list[0].query).toBe(`q${MAX_RECENT_SEARCHES + 4}`)
  })

  it('keeps a domain-only browse', () => {
    expect(addRecentSearch([], input('', { domain: 'industrial' }))).toHaveLength(1)
  })
})

describe('saved parts', () => {
  it('toggles on and off', () => {
    const p = makePart({ id: 'a' })
    const on = toggleSaved([], p, at(1))
    expect(on.map((e) => e.part.id)).toEqual(['a'])
    expect(toggleSaved(on, p)).toEqual([])
  })
  it('caps the list', () => {
    let list = [] as ReturnType<typeof toggleSaved>
    for (let i = 0; i < MAX_SAVED + 3; i++) list = toggleSaved(list, makePart({ id: `p${i}` }), at(i))
    expect(list).toHaveLength(MAX_SAVED)
  })
})

describe('comparison history', () => {
  const [a, b, c] = ['a', 'b', 'c'].map((id) => makePart({ id }))

  it('needs at least two parts', () => {
    expect(addComparison([], [a])).toEqual([])
  })
  it('the same set in any order is one entry that moves to the top', () => {
    let list = addComparison([], [a, b], at(1))
    list = addComparison(list, [a, c], at(2))
    list = addComparison(list, [b, a], at(3))
    expect(list).toHaveLength(2)
    expect(list[0].key).toBe(comparisonKey([a, b]))
    expect(comparisonKey([b, a])).toBe('a|b')
  })
  it('caps the list', () => {
    let list: ReturnType<typeof addComparison> = []
    for (let i = 0; i < MAX_COMPARISONS + 4; i++) list = addComparison(list, [makePart({ id: `x${i}` }), makePart({ id: `y${i}` })], at(i))
    expect(list).toHaveLength(MAX_COMPARISONS)
  })
})

describe('viewed parts', () => {
  it('counts repeat views and sorts most viewed first', () => {
    const [a, b] = ['a', 'b'].map((id) => makePart({ id }))
    let list = bumpView([], a, at(1))
    list = bumpView(list, b, at(2))
    list = bumpView(list, a, at(3))
    expect(list.map((e) => [e.part.id, e.count])).toEqual([['a', 2], ['b', 1]])
  })
  it('caps the list', () => {
    let list: ReturnType<typeof bumpView> = []
    for (let i = 0; i < MAX_VIEWED + 5; i++) list = bumpView(list, makePart({ id: `v${i}` }), at(i))
    expect(list).toHaveLength(MAX_VIEWED)
  })
})

describe('sanitizers (corrupt or hand-edited storage)', () => {
  it('return empty lists for non-arrays and drop malformed entries', () => {
    for (const fn of [sanitizeSearches, sanitizeSaved, sanitizeComparisons, sanitizeViewed]) {
      expect(fn(null)).toEqual([])
      expect(fn({})).toEqual([])
      expect(fn('x')).toEqual([])
      expect(fn([null, 1, 'a', {}])).toEqual([])
    }
  })

  it('sanitizeSearches fixes bad fields rather than trusting them', () => {
    const [s] = sanitizeSearches([{ query: 'seal', kind: 'weird', domain: 'bogus', at: 'not a date', resultCount: 'many' }])
    expect(s).toMatchObject({ query: 'seal', kind: 'catalogue', domain: null, manufacturer: '', resultCount: undefined })
    expect(Number.isNaN(Date.parse(s.at))).toBe(false)
  })

  it('sanitizeSaved needs a real part with a known domain and normalises its fields', () => {
    expect(sanitizeSaved([{ part: { id: 'a', name: 'n', domain: 'nope' } }])).toEqual([])
    const [e] = sanitizeSaved([{ part: { id: 'a', name: 'n', domain: 'industrial', specs: 'bad', availability: 'weird' } }])
    expect(e.part.specs).toEqual([])
    expect(e.part.availability).toBe('unknown')
    expect(e.part.source.name).toBe('No source recorded')
  })

  it('sanitizeComparisons drops comparisons with fewer than two valid parts and recomputes the key', () => {
    const good = { id: 'a', name: 'A', domain: 'industrial' }
    expect(sanitizeComparisons([{ parts: [good, { bad: true }] }])).toEqual([])
    const [c] = sanitizeComparisons([{ id: 'c1', key: 'tampered', parts: [good, { ...good, id: 'b' }] }])
    expect(c.key).toBe('a|b')
  })

  it('sanitizeViewed needs a positive count', () => {
    const part = { id: 'a', name: 'A', domain: 'industrial' }
    expect(sanitizeViewed([{ part, count: 0 }, { part, count: -1 }, { part, count: 'x' }])).toEqual([])
    expect(sanitizeViewed([{ part, count: 2.7 }])[0].count).toBe(2)
  })
})

describe('stores (localStorage stub)', () => {
  beforeEach(() => {
    userData.clearSearches()
    userData.clearSaved()
    userData.clearComparisons()
    userData.clearViewed()
  })

  it('persist through userData actions and survive a reload from storage', () => {
    userData.recordSearch(input('seal'))
    userData.toggleSaved(makePart({ id: 'a' }))
    userData.recordComparison([makePart({ id: 'a' }), makePart({ id: 'b' })])
    userData.recordView(makePart({ id: 'a' }))
    searchesStore.reload()
    savedStore.reload()
    comparisonsStore.reload()
    viewedStore.reload()
    expect(searchesStore.get()).toHaveLength(1)
    expect(userData.isSaved('a')).toBe(true)
    expect(comparisonsStore.get()).toHaveLength(1)
    expect(viewedStore.get()[0].count).toBe(1)
  })

  it('toggleSaved returns the new state and remove/clear work', () => {
    const p = makePart({ id: 'z' })
    expect(userData.toggleSaved(p)).toBe(true)
    expect(userData.toggleSaved(p)).toBe(false)
    userData.toggleSaved(p)
    userData.removeSaved('z')
    expect(userData.isSaved('z')).toBe(false)
  })
})
