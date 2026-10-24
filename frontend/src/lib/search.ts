import type { Availability, Part, ResultFilters, SearchCriteria, SortKey } from '@/types'

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
