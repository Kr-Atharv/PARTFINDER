import { parseQuantity, toBase } from '@/lib/quantity'
import type {
  Availability,
  NumericRangeSpec,
  Part,
  PartSpec,
  ResultFilters,
  SearchCriteria,
  SearchPaging,
  SearchRefinements,
  SortKey,
} from '@/types'

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
    ...(part.location ? [part.location] : []),
    ...part.keywords,
    ...part.specs.map((spec) => `${spec.label} ${spec.value}`),
  ]
    .join(' ')
    .toLowerCase()
}

/** Substring match that also tolerates punctuation differences in part numbers. */
export function includesLoose(haystack: string, needle: string): boolean {
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
  if (r.category || r.availability || r.specLabel || r.specValue) return true
  if (r.specs) {
    const s = r.specs
    if (s.manufacturer || s.partNumber || s.category || s.material || s.threadSize || s.portSize || s.tolerance || s.compatibleModel || s.location) {
      return true
    }
    const ranges = [
      s.diameter,
      s.length,
      s.width,
      s.height,
      s.weight,
      s.pressure,
      s.temperature,
      s.voltage,
      s.current,
      s.power,
      s.flowRate,
      s.speed,
      s.price,
    ]
    if (ranges.some((rng) => rng && ((rng.min !== undefined && rng.min !== '') || (rng.max !== undefined && rng.max !== '')))) {
      return true
    }
  }
  return false
}

function checkRangeMatch(specs: PartSpec[], labelKeywords: string[], range?: NumericRangeSpec): boolean {
  if (!range || ((range.min === undefined || range.min === '') && (range.max === undefined || range.max === ''))) {
    return true
  }

  const minVal = range.min !== undefined && range.min !== '' ? Number(range.min) : -Infinity
  const maxVal = range.max !== undefined && range.max !== '' ? Number(range.max) : Infinity

  const matchedSpecs = specs.filter((s) => {
    const lower = s.label.toLowerCase()
    return labelKeywords.some((kw) => lower.includes(kw))
  })

  if (matchedSpecs.length === 0) return false

  return matchedSpecs.some((spec) => {
    const q = parseQuantity(spec.value)
    if (!q) return false

    let specMin = q.min
    let specMax = q.max

    // Unit conversion if requested range has a unit and parsed quantity has a unit
    if (range.unit && q.unit) {
      const convertedMin = toBase(specMin, q.unit, range.unit)
      const convertedMax = toBase(specMax, q.unit, range.unit)
      if (convertedMin !== null && convertedMax !== null) {
        specMin = convertedMin
        specMax = convertedMax
      }
    }

    if (Number.isFinite(minVal) && specMax < minVal) return false
    if (Number.isFinite(maxVal) && specMin > maxVal) return false
    return true
  })
}

/**
 * Same semantics as the backend's category / availability / specification filters
 * (case-insensitive "contains"), used for both the offline demo catalogue and live filtering.
 */
export function matchRefinements(parts: Part[], refinements: SearchRefinements): Part[] {
  const category = (refinements.category || refinements.specs?.category || '').trim().toLowerCase()
  const label = refinements.specLabel.trim().toLowerCase()
  const value = refinements.specValue.trim().toLowerCase()
  const s = refinements.specs

  return parts.filter((part) => {
    if (category && !part.category.toLowerCase().includes(category)) return false
    if (refinements.availability && part.availability !== refinements.availability) return false

    // Core single spec filter
    if (label || value) {
      const hit = part.specs.some(
        (spec) =>
          (!label || spec.label.toLowerCase().includes(label)) &&
          (!value || spec.value.toLowerCase().includes(value)),
      )
      if (!hit) return false
    }

    // Detailed Specification Filters
    if (s) {
      if (s.manufacturer && !includesLoose(part.manufacturer, s.manufacturer)) return false
      if (s.partNumber && !includesLoose(part.partNumber, s.partNumber)) return false
      if (s.compatibleModel && !part.usedIn.some((u) => includesLoose(u, s.compatibleModel!)) && !includesLoose(part.description, s.compatibleModel)) {
        return false
      }
      if (s.material) {
        const matHit = part.specs.some((spec) => spec.label.toLowerCase().includes('material') && includesLoose(spec.value, s.material!))
        if (!matHit && !includesLoose(part.description, s.material)) return false
      }
      if (s.threadSize) {
        const threadHit = part.specs.some((spec) => spec.label.toLowerCase().includes('thread') && includesLoose(spec.value, s.threadSize!))
        if (!threadHit) return false
      }
      if (s.portSize) {
        const portHit = part.specs.some((spec) => (spec.label.toLowerCase().includes('port') || spec.label.toLowerCase().includes('inlet') || spec.label.toLowerCase().includes('outlet')) && includesLoose(spec.value, s.portSize!))
        if (!portHit) return false
      }
      if (s.tolerance) {
        const tolHit = part.specs.some((spec) => spec.label.toLowerCase().includes('tolerance') && includesLoose(spec.value, s.tolerance!))
        if (!tolHit) return false
      }
      if (s.location) {
        const locText = `${part.location ?? ''} ${part.source.name}`
        if (!includesLoose(locText, s.location)) return false
      }

      // Numeric ranges with units
      if (!checkRangeMatch(part.specs, ['diameter', 'bore', 'rod', 'inner diameter', 'outer diameter', 'id', 'od'], s.diameter)) return false
      if (!checkRangeMatch(part.specs, ['length', 'oal'], s.length)) return false
      if (!checkRangeMatch(part.specs, ['width'], s.width)) return false
      if (!checkRangeMatch(part.specs, ['height', 'thickness'], s.height)) return false
      if (!checkRangeMatch(part.specs, ['weight', 'mass'], s.weight)) return false
      if (!checkRangeMatch(part.specs, ['pressure'], s.pressure)) return false
      if (!checkRangeMatch(part.specs, ['temperature'], s.temperature)) return false
      if (!checkRangeMatch(part.specs, ['voltage'], s.voltage)) return false
      if (!checkRangeMatch(part.specs, ['current'], s.current)) return false
      if (!checkRangeMatch(part.specs, ['power'], s.power)) return false
      if (!checkRangeMatch(part.specs, ['flow'], s.flowRate)) return false
      if (!checkRangeMatch(part.specs, ['speed', 'rpm'], s.speed)) return false

      if (s.price && ((s.price.min !== undefined && s.price.min !== '') || (s.price.max !== undefined && s.price.max !== ''))) {
        if (!part.price) return false
        const minP = s.price.min !== undefined && s.price.min !== '' ? Number(s.price.min) : -Infinity
        const maxP = s.price.max !== undefined && s.price.max !== '' ? Number(s.price.max) : Infinity
        if (part.price.amount < minP || part.price.amount > maxP) return false
      }
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
