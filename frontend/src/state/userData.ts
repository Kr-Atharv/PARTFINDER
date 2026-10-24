import { isDomainId } from '@/data/domains'
import { createPersistentStore } from '@/lib/storage'
import type { DomainId, Part } from '@/types'

/**
 * Device-local user data: recent searches, saved parts, comparison history and view counts.
 *
 * This lives in this browser's localStorage only. There is no database table for it, so it
 * is not synced between devices or browsers and is lost if site data is cleared. The UI
 * says so wherever it is shown (see DEVICE_ONLY_NOTE).
 */

export const DEVICE_ONLY_NOTE = 'Stored only in this browser on this device. It is not synced and clearing site data removes it.'

export const MAX_RECENT_SEARCHES = 20
export const MAX_COMPARISONS = 20
export const MAX_VIEWED = 50
export const MAX_SAVED = 200

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SearchKind = 'catalogue' | 'research'

export interface RecentSearch {
  id: string
  kind: SearchKind
  query: string
  domain: DomainId | null
  manufacturer: string
  model: string
  /** Number of results the search returned, when known. */
  resultCount?: number
  /** ISO timestamp of the most recent run. */
  at: string
}

export interface SavedPart {
  part: Part
  savedAt: string
}

export interface ComparisonRecord {
  id: string
  /** Sorted part ids joined with "|" - the identity of a comparison. */
  key: string
  parts: Part[]
  at: string
}

export interface ViewedPart {
  part: Part
  count: number
  lastAt: string
}

/* ------------------------------------------------------------------ */
/* Pure helpers (exported for tests)                                   */
/* ------------------------------------------------------------------ */

const lc = (value: string) => value.trim().toLowerCase()

export function searchKey(entry: Pick<RecentSearch, 'kind' | 'query' | 'domain' | 'manufacturer' | 'model'>): string {
  return [entry.kind, lc(entry.query), entry.domain ?? '', lc(entry.manufacturer), lc(entry.model)].join('|')
}

export function comparisonKey(parts: Array<Pick<Part, 'id'>>): string {
  return parts
    .map((p) => p.id)
    .sort()
    .join('|')
}

/** Adds a search at the top, replacing an identical earlier one, capped at MAX_RECENT_SEARCHES. */
export function addRecentSearch(
  list: RecentSearch[],
  input: Omit<RecentSearch, 'id' | 'at'>,
  now: Date = new Date(),
): RecentSearch[] {
  if (!input.query.trim() && !input.manufacturer.trim() && !input.model.trim() && !input.domain) return list
  const key = searchKey(input)
  const entry: RecentSearch = {
    ...input,
    query: input.query.trim(),
    manufacturer: input.manufacturer.trim(),
    model: input.model.trim(),
    id: `s-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    at: now.toISOString(),
  }
  return [entry, ...list.filter((existing) => searchKey(existing) !== key)].slice(0, MAX_RECENT_SEARCHES)
}

export function toggleSaved(list: SavedPart[], part: Part, now: Date = new Date()): SavedPart[] {
  if (list.some((entry) => entry.part.id === part.id)) return list.filter((entry) => entry.part.id !== part.id)
  return [{ part, savedAt: now.toISOString() }, ...list].slice(0, MAX_SAVED)
}

/** Records a comparison; the same set of parts (in any order) moves to the top instead of duplicating. */
export function addComparison(list: ComparisonRecord[], parts: Part[], now: Date = new Date()): ComparisonRecord[] {
  if (parts.length < 2) return list
  const key = comparisonKey(parts)
  const record: ComparisonRecord = {
    id: `c-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
    key,
    parts,
    at: now.toISOString(),
  }
  return [record, ...list.filter((existing) => existing.key !== key)].slice(0, MAX_COMPARISONS)
}

export function bumpView(list: ViewedPart[], part: Part, now: Date = new Date()): ViewedPart[] {
  const existing = list.find((entry) => entry.part.id === part.id)
  const next: ViewedPart = {
    part,
    count: (existing?.count ?? 0) + 1,
    lastAt: now.toISOString(),
  }
  const rest = list.filter((entry) => entry.part.id !== part.id)
  // Keep the most-viewed entries when over the cap.
  return [next, ...rest].sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt)).slice(0, MAX_VIEWED)
}

/* ------------------------------------------------------------------ */
/* Sanitising (storage may be corrupt or hand-edited)                  */
/* ------------------------------------------------------------------ */

const isObject = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null
const str = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback)
const isoOrNow = (value: unknown) => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : new Date(0).toISOString())

function sanitizePart(raw: unknown): Part | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string' || !isDomainId(raw.domain)) return null
  return {
    ...(raw as unknown as Part),
    specs: Array.isArray(raw.specs) ? raw.specs.filter((s: any) => isObject(s) && typeof s.label === 'string') : [],
    usedIn: Array.isArray(raw.usedIn) ? raw.usedIn : [],
    keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
    source: isObject(raw.source) ? (raw.source as Part['source']) : { name: 'No source recorded' },
    partNumber: str(raw.partNumber),
    manufacturer: str(raw.manufacturer),
    category: str(raw.category),
    description: str(raw.description),
    availability: (['in_stock', 'limited', 'out_of_stock', 'unknown'] as const).includes(raw.availability as never)
      ? (raw.availability as Part['availability'])
      : 'unknown',
    isDemo: Boolean(raw.isDemo),
  }
}

const list = <T>(raw: unknown, map: (item: unknown) => T | null): T[] =>
  Array.isArray(raw) ? raw.map(map).filter((item): item is T => item !== null) : []

export function sanitizeSearches(raw: unknown): RecentSearch[] {
  return list(raw, (item) => {
    if (!isObject(item) || typeof item.query !== 'string') return null
    return {
      id: str(item.id, `s-${Math.random().toString(36).slice(2, 9)}`),
      kind: item.kind === 'research' ? 'research' : 'catalogue',
      query: item.query,
      domain: isDomainId(item.domain) ? item.domain : null,
      manufacturer: str(item.manufacturer),
      model: str(item.model),
      resultCount: typeof item.resultCount === 'number' ? item.resultCount : undefined,
      at: isoOrNow(item.at),
    } satisfies RecentSearch
  }).slice(0, MAX_RECENT_SEARCHES)
}

export function sanitizeSaved(raw: unknown): SavedPart[] {
  return list(raw, (item) => {
    if (!isObject(item)) return null
    const part = sanitizePart(item.part)
    return part ? { part, savedAt: isoOrNow(item.savedAt) } : null
  }).slice(0, MAX_SAVED)
}

export function sanitizeComparisons(raw: unknown): ComparisonRecord[] {
  return list(raw, (item) => {
    if (!isObject(item) || !Array.isArray(item.parts)) return null
    const parts = list(item.parts, sanitizePart)
    if (parts.length < 2) return null
    return { id: str(item.id, `c-${Math.random().toString(36).slice(2, 9)}`), key: comparisonKey(parts), parts, at: isoOrNow(item.at) }
  }).slice(0, MAX_COMPARISONS)
}

export function sanitizeViewed(raw: unknown): ViewedPart[] {
  return list(raw, (item) => {
    if (!isObject(item)) return null
    const part = sanitizePart(item.part)
    const count = Number(item.count)
    return part && Number.isFinite(count) && count > 0 ? { part, count: Math.floor(count), lastAt: isoOrNow(item.lastAt) } : null
  }).slice(0, MAX_VIEWED)
}

/* ------------------------------------------------------------------ */
/* Stores                                                              */
/* ------------------------------------------------------------------ */

export const searchesStore = createPersistentStore<RecentSearch[]>('partfinder.recentSearches', [], sanitizeSearches)
export const savedStore = createPersistentStore<SavedPart[]>('partfinder.savedParts', [], sanitizeSaved)
export const comparisonsStore = createPersistentStore<ComparisonRecord[]>('partfinder.comparisons', [], sanitizeComparisons)
export const viewedStore = createPersistentStore<ViewedPart[]>('partfinder.viewedParts', [], sanitizeViewed)

export const userData = {
  recordSearch: (input: Omit<RecentSearch, 'id' | 'at'>) => searchesStore.set((prev) => addRecentSearch(prev, input)),
  removeSearch: (id: string) => searchesStore.set((prev) => prev.filter((s) => s.id !== id)),
  clearSearches: () => searchesStore.set([]),

  /** Returns true when the part is saved after the call. */
  toggleSaved(part: Part): boolean {
    savedStore.set((prev) => toggleSaved(prev, part))
    return userData.isSaved(part.id)
  },
  isSaved: (id: string) => savedStore.get().some((entry) => entry.part.id === id),
  removeSaved: (id: string) => savedStore.set((prev) => prev.filter((entry) => entry.part.id !== id)),
  clearSaved: () => savedStore.set([]),

  recordComparison: (parts: Part[]) => comparisonsStore.set((prev) => addComparison(prev, parts)),
  removeComparison: (id: string) => comparisonsStore.set((prev) => prev.filter((c) => c.id !== id)),
  clearComparisons: () => comparisonsStore.set([]),

  recordView: (part: Part) => viewedStore.set((prev) => bumpView(prev, part)),
  clearViewed: () => viewedStore.set([]),
}

/* Hooks */
export const useRecentSearches = () => searchesStore.use()
export const useSavedParts = () => savedStore.use()
export const useComparisonHistory = () => comparisonsStore.use()
export const useViewedParts = () => viewedStore.use()
export const useIsSaved = (id: string) => savedStore.use().some((entry) => entry.part.id === id)
