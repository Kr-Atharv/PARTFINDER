import { describe, expect, it } from 'vitest'
import { activeChips } from '@/components/search/FilterPanel'
import { SUGGEST_MIN_CHARS, buildOptions } from '@/components/search/SearchBox'
import type { Suggestions } from '@/services/catalogService'

const suggestions: Suggestions = {
  parts: [{ id: '1', name: 'Seal Kit', partNumber: 'SK-80', manufacturer: 'Acme', category: 'Seals', domain: 'industrial' }],
  manufacturers: ['Acme'],
  categories: ['Seals'],
}

describe('buildOptions', () => {
  it('shows recent then popular searches before the person has typed enough', () => {
    const options = buildOptions({
      typed: 'a',
      recents: [{ query: 'pump', kind: 'catalogue' }, { query: 'seal', kind: 'research' }, { query: '  ', kind: 'catalogue' }],
      popular: { available: true, searches: [{ query: 'brake pad', domain: 'automotive', count: 3 }, { query: 'pump', domain: null, count: 1 }] },
      suggestions,
    })
    expect(options.map((o) => `${o.kind}:${o.value}`)).toEqual(['recent:pump', 'recent:seal', 'popular:brake pad', 'popular:pump'])
    expect(options[1].detail).toBe('live research')
    expect(options[2].detail).toBe('3 searches')
    expect(options[3].detail).toBe('1 search')
  })

  it('omits popular searches when the server says they are unavailable', () => {
    const options = buildOptions({ typed: '', recents: [], popular: { available: false, searches: [{ query: 'x', domain: null, count: 9 }] }, suggestions: null })
    expect(options).toEqual([])
  })

  it('caps recents at five', () => {
    const recents = Array.from({ length: 9 }, (_, i) => ({ query: `q${i}`, kind: 'catalogue' }))
    expect(buildOptions({ typed: '', recents, popular: null, suggestions: null })).toHaveLength(5)
  })

  it('shows real suggestions once the minimum number of characters is typed', () => {
    const typed = 'x'.repeat(SUGGEST_MIN_CHARS)
    const options = buildOptions({ typed, recents: [{ query: 'pump', kind: 'catalogue' }], popular: null, suggestions })
    expect(options.map((o) => o.kind)).toEqual(['part', 'manufacturer', 'category'])
    expect(options[0]).toMatchObject({ value: 'SK-80', label: 'Seal Kit', detail: 'SK-80 · Acme' })
  })

  it('has no options while typing if the suggestion service had nothing (no invented entries) and gives unique ids', () => {
    expect(buildOptions({ typed: 'abc', recents: [], popular: null, suggestions: null })).toEqual([])
    const options = buildOptions({ typed: 'abc', recents: [], popular: null, suggestions: { parts: [], manufacturers: ['A', 'a', 'B'], categories: [] } })
    expect(options.map((o) => o.value)).toEqual(['A', 'B'])
    expect(new Set(options.map((o) => o.id)).size).toBe(options.length)
  })
})

describe('activeChips', () => {
  it('has no chips without refinements', () => {
    expect(activeChips({ category: '', availability: '', specLabel: '', specValue: '' })).toEqual([])
  })

  it('makes one removable chip per active refinement, each clearing only its own fields', () => {
    const chips = activeChips({ category: 'Seals', availability: 'in_stock', specLabel: 'Max pressure', specValue: '250' })
    expect(chips.map((c) => c.key)).toEqual(['category', 'availability', 'spec'])
    expect(chips[0]).toMatchObject({ label: 'Category: Seals', clear: { category: '' } })
    expect(chips[1].clear).toEqual({ availability: '' })
    expect(chips[2]).toMatchObject({ label: 'Spec: Max pressure = 250', clear: { specLabel: '', specValue: '' } })
  })

  it('shows a spec chip for a label or a value alone', () => {
    expect(activeChips({ category: '', availability: '', specLabel: 'Bore', specValue: '' })[0].label).toBe('Spec: Bore')
    expect(activeChips({ category: '', availability: '', specLabel: '', specValue: '80' })[0].label).toBe('Spec: 80')
  })
})
