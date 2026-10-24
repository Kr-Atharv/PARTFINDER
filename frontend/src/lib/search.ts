import type { Availability, Part, ResultFilters, SearchCriteria, SearchPaging, SearchRefinements, SortKey } from '@/types'

export const emptyFilters: ResultFilters = { manufacturer: '', category: '', availability: '' }

export const availabilityOrder: Availability[] = ['in_stock', 'limited', 'out_of_stock', 'unknown']

/** Lower-case and strip everything except letters and digits ("SOT-223" -> "sot223"). */
function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function buildHaystack(part: Part): string {
  return [
    part.name,
    part.partNumber,
    part.manufacturer,
    part.category,
    part.description,
    ...part.keywords,
    ...part.specs.map((spec) => `${spec.label} ${spec.value}`),
  ]
    .join(' ')
    .toLowerCase()
}

/** Substring match that also tolerates punctuation differences in part numbers. */
function includesLoose(haystack: string, needle: string): boolean {
  const trimmed = needle.toLowerCase().trim()
  if (!trimmed) return true
  if (haystack.includes(trimmed)) return true
  const compactNeedle = compact(trimmed)
  return compactNeedle.length > 0 && compact(haystack).includes(compactNeedle)
}

export function tokenize(query: string): string[] {
  return query.split(/[\s,]+/).filter(Boolean)
}

/** Every query word must match somewhere in the part's searchable text. */
export function matchParts(parts: Part[], criteria: SearchCriteria): Part[] {
  const tokens = tokenize(criteria.query)
  const manufacturer = criteria.manufacturer.trim()
  const model = criteria.model.trim()

  return parts.filter((part) => {
    if (criteria.domain && part.domain !== criteria.domain) return false
    if (manufacturer && !includesLoose(part.manufacturer.toLowerCase(), manufacturer)) return false
    if (model && !part.usedIn.some((entry) => includesLoose(entry.toLowerCase(), model))) return false
    if (tokens.length === 0) return true
    const haystack = buildHaystack(part)
    return tokens.every((token) => includesLoose(haystack, token))
  })
}

export function filterParts(parts: Part[], filters: ResultFilters): Part[] {
  return parts.filter((part) => {
    if (filters.manufacturer && part.manufacturer !== filters.manufacturer) return false
    if (filters.category && part.category !== filters.category) return false
    if (filters.availability && part.availability !== filters.availability) return false
    return true
  })
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

export function sortParts(parts: Part[], sort: SortKey): Part[] {
  const [field, direction] = sort.split('-') as ['name' | 'manufacturer', 'asc' | 'desc']
  const sign = direction === 'asc' ? 1 : -1
  return [...parts].sort((a, b) => {
    const primary = collator.compare(a[field], b[field])
    if (primary !== 0) return primary * sign
    // Stable, predictable tie-break regardless of direction.
    return collator.compare(a.name, b.name) || collator.compare(a.partNumber, b.partNumber)
  })
}

export function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => collator.compare(a, b))
}

export function hasActiveFilters(filters: ResultFilters): boolean {
  return Boolean(filters.manufacturer || filters.category || filters.availability)
}

export const emptyRefinements: SearchRefinements = { category: '', availability: '', specLabel: '', specValue: '' }

export const PAGE_SIZES = [10, 20, 50] as const
export const DEFAULT_PAGE_SIZE = 20

export function hasRefinements(r: SearchRefinements): boolean {
  return Boolean(r.category || r.availability || r.specLabel || r.specValue)
}

/**
 * Same semantics as the backend's category / availability / specification filters
 * (case-insensitive "contains"), used only for the offline demo catalogue.
 */
export function matchRefinements(parts: Part[], refinements: SearchRefinements): Part[] {
  const category = refinements.category.trim().toLowerCase()
  const label = refinements.specLabel.trim().toLowerCase()
  const value = refinements.specValue.trim().toLowerCase()
  return parts.filter((part) => {
    if (category && !part.category.toLowerCase().includes(category)) return false
    if (refinements.availability && part.availability !== refinements.availability) return false
    if (label || value) {
      const hit = part.specs.some(
        (spec) =>
          (!label || spec.label.toLowerCase().includes(label)) &&
          (!value || spec.value.toLowerCase().includes(value)),
      )
      if (!hit) return false
    }
    return true
  })
}

export function paginate<T>(items: T[], paging: Pick<SearchPaging, 'page' | 'pageSize'>) {
  const totalPages = Math.max(1, Math.ceil(items.length / paging.pageSize))
  const page = Math.min(Math.max(1, paging.page), totalPages)
  const start = (page - 1) * paging.pageSize
  return { page, totalPages, total: items.length, items: items.slice(start, start + paging.pageSize) }
}

/** Counts per distinct value, sorted alphabetically (numeric-aware). */
export function tally(values: string[]): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>()
  for (const raw of values) {
    const value = raw.trim()
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => collator.compare(a.value, b.value))
}
