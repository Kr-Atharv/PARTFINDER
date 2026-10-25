import { sampleParts } from '@/data/sampleParts'
import { matchParts, matchRefinements, paginate, sortParts } from '@/lib/search'
import { ApiError, apiFetch } from '@/services/api'
import type {
  Part,
  PartClaim,
  SearchCriteria,
  SearchPage,
  SearchPaging,
  SearchRefinements,
} from '@/types'

/* ------------------------------------------------------------------ */
/* Backend record -> Part                                              */
/* ------------------------------------------------------------------ */

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined

/**
 * Maps a backend part record onto the frontend Part. Only reshapes what the
 * backend sent: claims are carried over with their evidence and source, and
 * nothing is invented. `sourceClaims[].source` (catalogue) and a flat
 * `sourceUrl` (live research) are both understood.
 */
export function toPart(raw: any): Part {
  const claims: PartClaim[] = Array.isArray(raw?.sourceClaims)
    ? raw.sourceClaims
        .filter((claim: any) => claim && typeof claim.label === 'string')
        .map((claim: any) => ({
          label: claim.label,
          value: String(claim.claimedValue ?? ''),
          unit: asString(claim.unit),
          evidence: asString(claim.evidence),
          sourceName: asString(claim.source?.name ?? claim.sourceRecord?.name),
          sourceUrl: asString(claim.source?.url ?? claim.sourceRecord?.url ?? claim.sourceUrl),
        }))
    : []

  return {
    id: String(raw.id),
    name: raw.name ?? '',
    partNumber: raw.partNumber ?? '',
    manufacturer: raw.manufacturer ?? '',
    domain: raw.domain,
    category: raw.category ?? '',
    description: raw.description ?? '',
    specs: Array.isArray(raw.specs)
      ? raw.specs.map((spec: any) => ({ label: String(spec.label), value: String(spec.value) }))
      : [],
    availability: raw.availability ?? 'unknown',
    source: {
      name: raw.source?.name ?? 'No source recorded',
      url: asString(raw.source?.url),
      retrievedAt: asString(raw.source?.retrievedAt),
    },
    usedIn: Array.isArray(raw.usedIn) ? raw.usedIn : [],
    keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
    isDemo: Boolean(raw.isDemo),
    origin: raw.origin === 'research' ? 'research' : 'catalogue',
    claims: claims.length > 0 ? claims : undefined,
    price: raw.price ?? undefined,
    evidenceLevel: raw.evidenceLevel ?? undefined,
    conflictingSpecs: raw.conflictingSpecs ?? undefined,
    verificationTier: raw.verificationTier ?? undefined,
    location: asString(raw.location),
  }
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export function buildSearchQuery(
  criteria: SearchCriteria,
  refinements: SearchRefinements,
  paging: SearchPaging,
): URLSearchParams {
  const params = new URLSearchParams()
  if (criteria.query.trim()) params.set('query', criteria.query.trim())
  if (criteria.domain) params.set('domain', criteria.domain)
  if (criteria.manufacturer.trim()) params.set('manufacturer', criteria.manufacturer.trim())
  if (criteria.model.trim()) params.set('model', criteria.model.trim())
  if (refinements.category.trim()) params.set('category', refinements.category.trim())
  if (refinements.availability) params.set('availability', refinements.availability)
  if (refinements.specLabel.trim()) params.set('specLabel', refinements.specLabel.trim())
  if (refinements.specValue.trim()) params.set('specValue', refinements.specValue.trim())
  params.set('page', String(paging.page))
  params.set('limit', String(paging.pageSize))
  params.set('sort', paging.sort)
  return params
}

/** Demo-catalogue search with the same semantics as the backend. Used only when the backend is unavailable. */
export function searchDemoCatalogue(
  criteria: SearchCriteria,
  refinements: SearchRefinements,
  paging: SearchPaging,
  demoReason: string,
): SearchPage {
  const matched = sortParts(matchRefinements(matchParts(sampleParts, criteria), refinements), paging.sort)
  const slice = paginate(matched, paging)
  return {
    results: slice.items,
    total: slice.total,
    page: slice.page,
    pageSize: paging.pageSize,
    totalPages: slice.totalPages,
    source: 'demo',
    demoReason,
  }
}

/**
 * One page of catalogue results from the backend (filtering, sorting and paging all happen
 * server-side). Only when the backend itself is unavailable does it fall back to the demo
 * catalogue, and the result is then labelled `source: 'demo'`. A request the backend
 * rejects (4xx) is an error, never silently replaced by demo data.
 */
export async function searchPartsPage(
  criteria: SearchCriteria,
  refinements: SearchRefinements,
  paging: SearchPaging,
  signal?: AbortSignal,
): Promise<SearchPage> {
  try {
    const data = await apiFetch<any>(`/api/parts/search?${buildSearchQuery(criteria, refinements, paging)}`, {
      signal,
    })
    if (!data || !Array.isArray(data.results)) {
      throw new ApiError('The server sent a search response in an unexpected shape.', 200, 'BAD_RESPONSE')
    }
    return {
      results: data.results.map(toPart),
      total: Number(data.total ?? data.results.length),
      page: Number(data.page ?? paging.page),
      pageSize: Number(data.limit ?? paging.pageSize),
      totalPages: Number(data.totalPages ?? 1),
      source: 'backend',
      truncated: Boolean(data.truncated),
    }
  } catch (error) {
    if (error instanceof ApiError && error.isUnavailable && error.code !== 'ABORTED') {
      return searchDemoCatalogue(criteria, refinements, paging, error.message)
    }
    throw error
  }
}

/** Legacy helper: all results of the first page. Kept for callers that only need a list. */
export async function searchParts(criteria: SearchCriteria): Promise<Part[]> {
  const page = await searchPartsPage(
    criteria,
    { category: '', availability: '', specLabel: '', specValue: '' },
    { page: 1, pageSize: 100, sort: 'name-asc' },
  )
  return page.results
}

/* ------------------------------------------------------------------ */
/* Single parts                                                        */
/* ------------------------------------------------------------------ */

/** Synchronous lookup in the demo catalogue only. */
export function getPartById(id: string): Part | undefined {
  return sampleParts.find((part) => part.id === id)
}

/**
 * Fetches one part from the backend. Returns `null` when the backend says it does not exist,
 * and throws ApiError for any other failure (no silent fallback).
 */
export async function fetchPartByIdStrict(id: string, signal?: AbortSignal): Promise<Part | null> {
  try {
    const raw = await apiFetch<any>(`/api/parts/${encodeURIComponent(id)}`, { signal })
    return raw ? toPart(raw) : null
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

/** Backend part, falling back to the demo catalogue only when the backend is unavailable. */
export async function fetchPartById(id: string): Promise<Part | undefined> {
  try {
    return (await fetchPartByIdStrict(id)) ?? undefined
  } catch (error) {
    if (error instanceof ApiError && error.isUnavailable) return getPartById(id)
    throw error
  }
}

/** Fetch multiple parts for comparison from `/api/parts/compare?ids=...`. */
export async function fetchPartsForCompare(ids: string[]): Promise<Part[]> {
  if (ids.length === 0) return []
  try {
    const data = await apiFetch<any[]>(`/api/parts/compare?ids=${encodeURIComponent(ids.join(','))}`)
    return Array.isArray(data) ? data.map(toPart) : []
  } catch (error) {
    if (error instanceof ApiError && error.isUnavailable) {
      return sampleParts.filter((part) => ids.includes(part.id))
    }
    throw error
  }
}
