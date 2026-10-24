import { API_BASE_URL, ApiError, apiFetch } from '@/services/api'
import type { DomainId, Facets } from '@/types'

/**
 * Catalogue metadata from the real backend. There is deliberately no fallback to
 * invented values: when the server cannot answer, callers get `unavailable` and show that.
 */

export type Loaded<T> =
  | { status: 'ok'; data: T }
  | { status: 'unavailable'; message: string }

export interface SuggestedPart {
  id: string
  name: string
  partNumber: string
  manufacturer: string
  category: string
  domain: DomainId
}

export interface Suggestions {
  parts: SuggestedPart[]
  manufacturers: string[]
  categories: string[]
}

export interface PopularSearch {
  query: string
  domain: DomainId | null
  count: number
}

export interface PopularSearches {
  /** False when the server could not read its search history. */
  available: boolean
  searches: PopularSearch[]
}

async function load<T>(path: string, signal?: AbortSignal): Promise<Loaded<T>> {
  try {
    return { status: 'ok', data: await apiFetch<T>(path, { signal }) }
  } catch (error) {
    if (error instanceof ApiError && error.code === 'ABORTED') throw error
    return { status: 'unavailable', message: error instanceof Error ? error.message : 'Request failed.' }
  }
}

export const fetchFacets = (signal?: AbortSignal) => load<Facets>('/api/parts/facets', signal)

export const fetchSuggestions = (q: string, signal?: AbortSignal) =>
  load<Suggestions>(`/api/parts/suggest?q=${encodeURIComponent(q.trim())}&limit=8`, signal)

export const fetchPopular = (signal?: AbortSignal) => load<PopularSearches>('/api/parts/popular', signal)

/** Server health: reachable or not, never guessed. */
export interface Health {
  status: string
  uptime?: number
}

export async function fetchHealth(signal?: AbortSignal): Promise<Loaded<Health>> {
  try {
    // /api/health answers `{status, uptime}` without a `data` envelope.
    const res = await fetch(`${API_BASE_URL}/api/health`, { signal })
    if (!res.ok) return { status: 'unavailable', message: `Server responded ${res.status}.` }
    return { status: 'ok', data: (await res.json()) as Health }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return { status: 'unavailable', message: 'The PartFinder server could not be reached.' }
  }
}
