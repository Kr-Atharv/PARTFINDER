import { describe, expect, it } from 'vitest'
import { emptyResearchFilters, filterResearch, hasPriceBounds, sortResearch } from '@/lib/researchFilter'
import { makePart } from '@/test/fixtures'
import type { Part, PartPrice } from '@/types'

const price = (amount: number, currencyKey = 'USD'): PartPrice => ({ raw: String(amount), amount, currencyKey } as PartPrice)
const p = (id: string, over: Partial<Part> = {}) => makePart({ id, name: id, ...over })

describe('filterResearch', () => {
  const parts = [p('cheap', { price: price(5) }), p('mid', { price: price(50) }), p('none'), p('eur', { price: price(20, 'EUR') })]

  it('a part without a price never satisfies a price bound', () => {
    const ids = filterResearch(parts, { ...emptyResearchFilters, minPrice: '1', currency: 'USD' }).map((x) => x.id)
    expect(ids).toEqual(['cheap', 'mid'])
  })

  it('never compares across currencies: with several currencies a bound applies to the chosen one only', () => {
    const ids = filterResearch(parts, { ...emptyResearchFilters, maxPrice: '30', currency: 'EUR' }).map((x) => x.id)
    expect(ids).toEqual(['eur'])
  })

  it('uses the only currency automatically', () => {
    const usd = parts.filter((x) => x.id !== 'eur')
    expect(filterResearch(usd, { ...emptyResearchFilters, minPrice: '10' }).map((x) => x.id)).toEqual(['mid'])
  })

  it('filters by availability and priced-only; passes everything when nothing is set', () => {
    expect(filterResearch(parts, emptyResearchFilters)).toHaveLength(4)
    expect(filterResearch(parts, { ...emptyResearchFilters, onlyWithPrice: true })).toHaveLength(3)
    const mixed = [p('a', { availability: 'limited' }), p('b')]
    expect(filterResearch(mixed, { ...emptyResearchFilters, availability: 'limited' }).map((x) => x.id)).toEqual(['a'])
  })

  it('ignores a non-numeric bound', () => {
    expect(hasPriceBounds({ ...emptyResearchFilters, minPrice: 'abc' })).toBe(false)
    expect(hasPriceBounds({ ...emptyResearchFilters, maxPrice: '0' })).toBe(true)
  })
})

describe('sortResearch', () => {
  const parts = [p('b', { price: price(50), manufacturer: 'Zed' }), p('a', { manufacturer: 'Acme' }), p('c', { price: price(5), manufacturer: 'Mid' }), p('d', { price: price(9, 'EUR') })]

  it('relevance keeps the received order and does not mutate', () => {
    const copy = [...parts]
    expect(sortResearch(parts, 'relevance').map((x) => x.id)).toEqual(['b', 'a', 'c', 'd'])
    expect(parts).toEqual(copy)
  })

  it('price sorts put unpriced parts last in both directions and group by currency', () => {
    expect(sortResearch(parts, 'price-asc').map((x) => x.id)).toEqual(['d', 'c', 'b', 'a'])
    expect(sortResearch(parts, 'price-desc').map((x) => x.id)).toEqual(['d', 'b', 'c', 'a'])
  })

  it('name and manufacturer sorts, and spec count desc', () => {
    expect(sortResearch(parts, 'name').map((x) => x.id)).toEqual(['a', 'b', 'c', 'd'])
    // part "d" has the fixture's default manufacturer, "Testco"
    expect(sortResearch(parts, 'manufacturer').map((x) => x.manufacturer)).toEqual(['Acme', 'Mid', 'Testco', 'Zed'])
    const specs = [p('few', { specs: [{ label: 'A', value: '1' }] }), p('many', { specs: [{ label: 'A', value: '1' }, { label: 'B', value: '2' }] })]
    expect(sortResearch(specs, 'specs-desc').map((x) => x.id)).toEqual(['many', 'few'])
  })
})
