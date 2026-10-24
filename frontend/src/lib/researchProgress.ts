import type { ResearchEvent } from '@/services/researchService'

export type StageStatus = 'pending' | 'active' | 'done' | 'skipped' | 'error'

export interface Stage {
  id: 'search' | 'fetch' | 'extract' | 'save'
  label: string
  status: StageStatus
  detail?: string
}

export interface PageOutcome {
  url: string
  outcome: 'extracted' | 'skipped'
  reason?: string
  specCount?: number
  evidenceLevel?: 'full_page' | 'snippet_only'
}

export interface Progress {
  stages: Stage[]
  pages: PageOutcome[]
  /** Pages the search found, once known. */
  found?: number
  failedFetches: Array<{ url: string; error: string }>
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Turns the real events from /api/research/stream into a stage timeline. Nothing here is
 * simulated: a stage is only "done" once the backend has reported it, and "pending" stages
 * are shown without any invented percentage.
 */
export function deriveProgress(
  events: ResearchEvent[],
  options: { persist: boolean; running: boolean; failed?: boolean },
): Progress {
  let found: number | undefined
  let searchDone = false
  let fetchDone: { fetched: number; failed: Array<{ url: string; error: string }> } | null = null
  let persisted: number | null = null
  let complete = false
  const pages: PageOutcome[] = []

  for (const event of events) {
    switch (event.type) {
      case 'started':
        break
      case 'search_done':
        searchDone = true
        found = event.count
        break
      case 'fetch_done':
        fetchDone = { fetched: event.fetched, failed: event.failed }
        break
      case 'page_processed':
        pages.push({
          url: event.url,
          outcome: event.outcome,
          reason: event.reason,
          specCount: event.specCount,
          evidenceLevel: event.evidenceLevel,
        })
        break
      case 'persisted':
        persisted = event.count
        break
      case 'complete':
        complete = true
        break
    }
  }

  const live = options.running
  const mark = (done: boolean, activeWhen: boolean): StageStatus =>
    done ? 'done' : live && activeWhen ? 'active' : 'pending'

  const extractedCount = pages.filter((p) => p.outcome === 'extracted').length
  const extractDone = complete || (found !== undefined && pages.length >= found && fetchDone !== null)

  const stages: Stage[] = [
    {
      id: 'search',
      label: 'Searching the web',
      status: mark(searchDone, true),
      detail: searchDone ? `${plural(found ?? 0, 'page')} found` : undefined,
    },
    {
      id: 'fetch',
      label: 'Fetching pages',
      status: mark(fetchDone !== null, searchDone),
      detail: fetchDone
        ? `${fetchDone.fetched} fetched${fetchDone.failed.length > 0 ? `, ${fetchDone.failed.length} could not be fetched (snippet used instead)` : ''}`
        : undefined,
    },
    {
      id: 'extract',
      label: 'Extracting specifications',
      status: mark(extractDone, fetchDone !== null),
      detail:
        pages.length > 0
          ? `${pages.length}${found !== undefined ? ` of ${found}` : ''} processed, ${extractedCount} with specifications`
          : undefined,
    },
    {
      id: 'save',
      label: 'Saving to catalogue',
      status: !options.persist ? 'skipped' : mark(persisted !== null, extractDone),
      detail: !options.persist
        ? 'Turned off for this run'
        : persisted !== null
          ? `${plural(persisted, 'record')} saved`
          : undefined,
    },
  ]

  // A finished run settles any stage that never needed to report (e.g. nothing extracted, so nothing to save).
  if (complete) {
    for (const stage of stages) if (stage.status === 'pending' || stage.status === 'active') stage.status = stage.id === 'save' && persisted === null ? 'skipped' : 'done'
    const save = stages[3]
    if (save.status === 'skipped' && options.persist && persisted === null) save.detail = 'Nothing to save'
  }
  if (options.failed) {
    const active = stages.find((s) => s.status === 'active') ?? stages.find((s) => s.status === 'pending')
    if (active) active.status = 'error'
  }
  return { stages, pages, found, failedFetches: fetchDone?.failed ?? [] }
}

/** mm:ss */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
