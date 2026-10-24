import type { Availability, Part } from '@/types'

export type ResearchSort = 'relevance' | 'name' | 'manufacturer' | 'price-asc' | 'price-desc' | 'specs-desc'

export interface ResearchFilters {
  availability: Availability | ''
  onlyWithPrice: boolean
  /** Empty string means no bound. */
  minPrice: string
  maxPrice: string
  /** Required when results contain more than one currency and a price bound is set. */
  currency: string
}

export const emptyResearchFilters: ResearchFilters = {
  availability: '',
  onlyWithPrice: false,
  minPrice: '',
  maxPrice: '',
  currency: '',
}

export const RESEARCH_PAGE_SIZE = 6

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

const toNumber = (value: string): number | null => {
  if (!value.trim()) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function currenciesOf(parts: Part[]): string[] {
  return Array.from(new Set(parts.filter((p) => p.price).map((p) => p.price!.currencyKey))).sort()
}

export function hasPriceBounds(filters: ResearchFilters): boolean {
  return toNumber(filters.minPrice) !== null || toNumber(filters.maxPrice) !== null
}

/**
 * Filters research results. Prices are compared only within one currency: amounts in different
 * currencies are never converted or compared with each other. A part without a price never
 * satisfies a price bound.
 */
export function filterResearch(parts: Part[], filters: ResearchFilters): Part[] {
  const min = toNumber(filters.minPrice)
  const max = toNumber(filters.maxPrice)
  const currencies = currenciesOf(parts)
  const currency = filters.currency || (currencies.length === 1 ? currencies[0] : '')
  return parts.filter((part) => {
    if (filters.availability && part.availability !== filters.availability) return false
    if (filters.onlyWithPrice && !part.price) return false
    if (min !== null || max !== null) {
      if (!part.price) return false
      if (currency && part.price.currencyKey !== currency) return false
      if (min !== null && part.price.amount < min) return false
      if (max !== null && part.price.amount > max) return false
    }
    return true
  })
}

export function sortResearch(parts: Part[], sort: ResearchSort): Part[] {
  if (sort === 'relevance') return [...parts]
  const copy = parts.map((part, index) => ({ part, index }))
  copy.sort((a, b) => {
    let result = 0
    switch (sort) {
      case 'name':
        result = collator.compare(a.part.name, b.part.name)
        break
      case 'manufacturer':
        result = collator.compare(a.part.manufacturer, b.part.manufacturer)
        break
      case 'specs-desc':
        result = b.part.specs.length - a.part.specs.length
        break
      case 'price-asc':
      case 'price-desc': {
        const pa = a.part.price
        const pb = b.part.price
        if (!pa && !pb) result = 0
        else if (!pa) return 1 // unpriced parts always last
        else if (!pb) return -1
        else if (pa.currencyKey !== pb.currencyKey) result = collator.compare(pa.currencyKey, pb.currencyKey)
        else result = sort === 'price-asc' ? pa.amount - pb.amount : pb.amount - pa.amount
        break
      }
    }
    return result || a.index - b.index
  })
  return copy.map((entry) => entry.part)
}
