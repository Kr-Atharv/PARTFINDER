import { API_BASE_URL, ApiError, apiFetch, isAbort, parseErrorResponse } from '@/services/api'
import type { ConflictingSpec, DomainId, Part, PartClaim, PartPrice } from '@/types'

/**
 * Live supplier research (TinyFish) through the backend.
 *
 * `streamResearch` calls POST /api/research/stream and reports each pipeline event as it
 * actually happens. `conductLiveResearch` (the non-streaming endpoint) is kept for callers
 * that only need the final list.
 */

export interface ResearchedSpec {
  label: string
  value: string
  unit?: string
}

export interface ResearchedSourceClaim {
  label: string
  claimedValue: string
  unit?: string
  evidence?: string
  sourceUrl?: string
}

export interface ResearchedPart {
  id: string
  name: string
  partNumber: string
  manufacturer: string
  domain: string
  category: string
  description: string
  availability: 'in_stock' | 'limited' | 'out_of_stock' | 'unknown'
  usedIn?: string[]
  keywords?: string[]
  specs: ResearchedSpec[]
  source: { name: string; url: string; retrievedAt: string }
  sourceClaims?: ResearchedSourceClaim[]
  price?: PartPrice
  evidenceLevel?: 'full_page' | 'snippet_only'
  conflictingSpecs?: ConflictingSpec[]
}

/** Events the backend emits (see ResearchProgressEvent in the backend schemas). */
export type ResearchEvent =
  | { type: 'started'; query: string; searchQuery: string; maxResults: number }
  | { type: 'search_done'; count: number; results: Array<{ url: string; title: string; siteName?: string }> }
  | { type: 'fetch_done'; fetched: number; failed: Array<{ url: string; error: string }> }
  | {
      type: 'page_processed'
      url: string
      outcome: 'extracted' | 'skipped'
      reason?: string
      partId?: string
      specCount?: number
      evidenceLevel?: 'full_page' | 'snippet_only'
    }
  | { type: 'persisted'; count: number }
  | { type: 'complete'; data: { query: string; domain: string; totalResearched: number; results: ResearchedPart[] } }
  | { type: 'error'; error: { message: string; code: string; status: number } }

export interface ResearchParams {
  query: string
  domain: DomainId
  manufacturer?: string
  model?: string
  maxResults?: number
  persistToDb?: boolean
}

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

/** ResearchedPart -> Part, keeping prices, claims and evidence level exactly as received. */
export function researchedToPart(raw: ResearchedPart): Part {
  const claims: PartClaim[] = (raw.sourceClaims ?? []).map((claim) => ({
    label: claim.label,
    value: claim.claimedValue,
    unit: claim.unit,
    evidence: claim.evidence,
    sourceName: raw.source?.name,
    sourceUrl: claim.sourceUrl ?? raw.source?.url,
  }))
  return {
    id: raw.id,
    name: raw.name,
    partNumber: raw.partNumber,
    manufacturer: raw.manufacturer,
    domain: raw.domain as DomainId,
    category: raw.category,
    description: raw.description,
    specs: raw.specs.map((spec) => ({ label: spec.label, value: spec.value })),
    availability: raw.availability,
    source: { name: raw.source?.name ?? 'Web source', url: raw.source?.url, retrievedAt: raw.source?.retrievedAt },
    usedIn: raw.usedIn ?? [],
    keywords: raw.keywords ?? [],
    isDemo: false,
    origin: 'research',
    claims: claims.length > 0 ? claims : undefined,
    price: raw.price,
    evidenceLevel: raw.evidenceLevel,
    conflictingSpecs: raw.conflictingSpecs,
  }
}

/* ------------------------------------------------------------------ */
/* NDJSON parsing                                                      */
/* ------------------------------------------------------------------ */

/**
 * Incremental newline-delimited JSON parser. Feed it text chunks (which may split a line
 * anywhere); it returns the events completed by each chunk and keeps the partial tail.
 * Lines that are not valid JSON are skipped and counted in `skipped`.
 */
export class NdjsonParser {
  private buffer = ''
  skipped = 0

  push(chunk: string): ResearchEvent[] {
    this.buffer += chunk
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''
    return this.parseLines(lines)
  }

  /** Call once the stream has ended to parse a final line that had no trailing newline. */
  flush(): ResearchEvent[] {
    const rest = this.buffer
    this.buffer = ''
    return this.parseLines([rest])
  }

  private parseLines(lines: string[]): ResearchEvent[] {
    const events: ResearchEvent[] = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed && typeof parsed.type === 'string') events.push(parsed as ResearchEvent)
        else this.skipped += 1
      } catch {
        this.skipped += 1
      }
    }
    return events
  }
}

/* ------------------------------------------------------------------ */
/* Streaming call                                                      */
/* ------------------------------------------------------------------ */

function requestBody(params: ResearchParams) {
  return JSON.stringify({
    query: params.query,
    domain: params.domain,
    manufacturer: params.manufacturer || undefined,
    model: params.model || undefined,
    maxResults: params.maxResults ?? 5,
    persistToDb: params.persistToDb ?? true,
  })
}

/**
 * Runs research and reports events as they arrive. Resolves with the final parts when the
 * backend sends `complete`; rejects with ApiError on a backend `error` event, an HTTP
 * error, a dropped connection or abort (code `ABORTED`).
 */
export async function streamResearch(
  params: ResearchParams,
  options: { onEvent?: (event: ResearchEvent) => void; signal?: AbortSignal } = {},
): Promise<Part[]> {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}/api/research/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
      body: requestBody(params),
      signal: options.signal,
    })
  } catch (error) {
    if (isAbort(error)) throw new ApiError('The research was cancelled.', 0, 'ABORTED')
    throw new ApiError('The PartFinder server could not be reached.', 0, 'NETWORK')
  }
  if (!res.ok) throw await parseErrorResponse(res)
  if (!res.body) throw new ApiError('The server sent no research stream.', res.status, 'BAD_RESPONSE')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const parser = new NdjsonParser()
  let result: Part[] | null = null

  const handle = (events: ResearchEvent[]) => {
    for (const event of events) {
      options.onEvent?.(event)
      if (event.type === 'error') {
        throw new ApiError(event.error.message, event.error.status || 500, event.error.code || 'RESEARCH_ERROR')
      }
      if (event.type === 'complete') result = (event.data.results ?? []).map(researchedToPart)
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      handle(parser.push(decoder.decode(value, { stream: true })))
    }
    handle(parser.push(decoder.decode()))
    handle(parser.flush())
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (isAbort(error)) throw new ApiError('The research was cancelled.', 0, 'ABORTED')
    throw new ApiError('The connection to the server was lost during research.', 0, 'NETWORK')
  }

  if (result === null) {
    throw new ApiError('The research ended before the server reported a result.', 200, 'BAD_RESPONSE')
  }
  return result
}

/** Non-streaming research (POST /api/research/search). */
export async function conductLiveResearch(params: ResearchParams): Promise<Part[]> {
  const data = await apiFetch<{ results?: ResearchedPart[]; parts?: ResearchedPart[] }>('/api/research/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: requestBody(params),
  })
  return (data?.results ?? data?.parts ?? []).map(researchedToPart)
}
