import { domainById } from '@/data/domains'
import { buildSearchParams } from '@/lib/validation'
import type { ComparisonRecord, RecentSearch, SavedPart } from '@/state/userData'

/** Link that reopens a recorded search on the Find Parts page (research searches open the research tab). */
export function searchLink(entry: Pick<RecentSearch, 'kind' | 'query' | 'domain' | 'manufacturer' | 'model'>): string {
  const params = buildSearchParams(
    { query: entry.query, domain: entry.domain, manufacturer: entry.manufacturer, model: entry.model },
    undefined,
    {},
    { tab: entry.kind === 'research' ? 'research' : undefined },
  )
  const text = params.toString()
  return text ? `/find?${text}` : '/find'
}

/** One-line description of a recorded search, built only from what the person entered. */
export function describeSearch(entry: Pick<RecentSearch, 'query' | 'domain' | 'manufacturer' | 'model'>): string {
  const parts = [entry.query.trim()]
  if (entry.manufacturer.trim()) parts.push(`manufacturer: ${entry.manufacturer.trim()}`)
  if (entry.model.trim()) parts.push(`model: ${entry.model.trim()}`)
  const text = parts.filter(Boolean).join(' · ')
  if (text) return text
  return entry.domain ? `All ${domainById[entry.domain].label.toLowerCase()} parts` : 'Browse all parts'
}

export type HistorySort = 'newest' | 'oldest' | 'query'
export type KindFilter = 'all' | 'catalogue' | 'research'

const time = (iso: string) => {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? 0 : t
}
const lc = (value: string) => value.trim().toLowerCase()

export function filterSearches(list: RecentSearch[], opts: { text?: string; kind?: KindFilter }): RecentSearch[] {
  const text = lc(opts.text ?? '')
  return list.filter((entry) => {
    if (opts.kind && opts.kind !== 'all' && entry.kind !== opts.kind) return false
    if (!text) return true
    return lc(`${describeSearch(entry)} ${entry.domain ?? ''}`).includes(text)
  })
}

export function sortSearches(list: RecentSearch[], sort: HistorySort): RecentSearch[] {
  const copy = [...list]
  if (sort === 'oldest') return copy.sort((a, b) => time(a.at) - time(b.at))
  if (sort === 'query') return copy.sort((a, b) => describeSearch(a).localeCompare(describeSearch(b), 'en', { sensitivity: 'base' }) || time(b.at) - time(a.at))
  return copy.sort((a, b) => time(b.at) - time(a.at))
}

export function filterComparisons(list: ComparisonRecord[], text: string): ComparisonRecord[] {
  const needle = lc(text)
  if (!needle) return list
  return list.filter((record) => record.parts.some((part) => lc(`${part.name} ${part.partNumber} ${part.manufacturer}`).includes(needle)))
}

export function sortComparisons(list: ComparisonRecord[], sort: Exclude<HistorySort, 'query'>): ComparisonRecord[] {
  const copy = [...list]
  return sort === 'oldest' ? copy.sort((a, b) => time(a.at) - time(b.at)) : copy.sort((a, b) => time(b.at) - time(a.at))
}

export type SavedSort = 'recent' | 'name' | 'manufacturer'

export function filterSaved(list: SavedPart[], opts: { text?: string; domain?: string }): SavedPart[] {
  const text = lc(opts.text ?? '')
  return list.filter(({ part }) => {
    if (opts.domain && part.domain !== opts.domain) return false
    if (!text) return true
    return lc(`${part.name} ${part.partNumber} ${part.manufacturer} ${part.category}`).includes(text)
  })
}

export function sortSaved(list: SavedPart[], sort: SavedSort): SavedPart[] {
  const copy = [...list]
  const cmp = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })
  if (sort === 'name') return copy.sort((a, b) => cmp(a.part.name, b.part.name) || cmp(a.part.partNumber, b.part.partNumber))
  if (sort === 'manufacturer') return copy.sort((a, b) => cmp(a.part.manufacturer, b.part.manufacturer) || cmp(a.part.name, b.part.name))
  return copy.sort((a, b) => time(b.savedAt) - time(a.savedAt))
}

/** Slice one page out of a list; the page is clamped into range. */
export function pageOf<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(Math.max(1, page), totalPages)
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, totalPages, total: items.length }
}
