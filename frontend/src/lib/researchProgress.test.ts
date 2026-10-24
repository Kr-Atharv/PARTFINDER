import { describe, expect, it } from 'vitest'
import { deriveProgress, formatElapsed } from '@/lib/researchProgress'
import type { ResearchEvent } from '@/services/researchService'

const started: ResearchEvent = { type: 'started', query: 'q', searchQuery: 'q', maxResults: 3 }
const searchDone = (count: number): ResearchEvent => ({ type: 'search_done', count, results: [] })
const fetchDone = (fetched: number, failed: Array<{ url: string; error: string }> = []): ResearchEvent => ({ type: 'fetch_done', fetched, failed })
const page = (url: string, outcome: 'extracted' | 'skipped', extra: Partial<Extract<ResearchEvent, { type: 'page_processed' }>> = {}): ResearchEvent => ({ type: 'page_processed', url, outcome, ...extra })
const status = (events: ResearchEvent[], opts: Parameters<typeof deriveProgress>[1]) => deriveProgress(events, opts).stages.map((s) => `${s.id}:${s.status}`)

describe('deriveProgress', () => {
  it('shows only pending stages (nothing invented) before any event, and "active" search while running', () => {
    expect(status([], { persist: true, running: false })).toEqual(['search:pending', 'fetch:pending', 'extract:pending', 'save:pending'])
    expect(status([started], { persist: true, running: true })).toEqual(['search:active', 'fetch:pending', 'extract:pending', 'save:pending'])
  })

  it('advances stage by stage as the backend reports', () => {
    const p = deriveProgress([started, searchDone(3)], { persist: true, running: true })
    expect(p.found).toBe(3)
    expect(p.stages[0]).toMatchObject({ status: 'done', detail: '3 pages found' })
    expect(p.stages[1].status).toBe('active')

    const q = deriveProgress([started, searchDone(3), fetchDone(2, [{ url: 'u', error: 'timeout' }]), page('a', 'extracted', { specCount: 4 })], { persist: true, running: true })
    expect(q.stages[1].detail).toContain('1 could not be fetched')
    expect(q.stages[2]).toMatchObject({ status: 'active', detail: '1 of 3 processed, 1 with specifications' })
    expect(q.failedFetches).toHaveLength(1)
  })

  it('completes every stage on a finished run and marks save as skipped when persistence is off', () => {
    const events: ResearchEvent[] = [
      started,
      searchDone(2),
      fetchDone(2),
      page('a', 'extracted'),
      page('b', 'skipped', { reason: 'no specs' }),
      { type: 'persisted', count: 1 },
      { type: 'complete', data: { query: 'q', domain: 'industrial', totalResearched: 1, results: [] } },
    ]
    expect(status(events, { persist: true, running: false })).toEqual(['search:done', 'fetch:done', 'extract:done', 'save:done'])
    const off = deriveProgress(events, { persist: false, running: false })
    expect(off.stages[3]).toMatchObject({ status: 'skipped', detail: 'Turned off for this run' })
    expect(off.pages.map((p) => p.outcome)).toEqual(['extracted', 'skipped'])
  })

  it('says "Nothing to save" when a finished run extracted nothing', () => {
    const events: ResearchEvent[] = [started, searchDone(1), fetchDone(1), page('a', 'skipped'), { type: 'complete', data: { query: 'q', domain: 'industrial', totalResearched: 0, results: [] } }]
    const p = deriveProgress(events, { persist: true, running: false })
    expect(p.stages[3]).toMatchObject({ status: 'skipped', detail: 'Nothing to save' })
  })

  it('marks the stage that was running as errored when the run failed', () => {
    const p = deriveProgress([started, searchDone(2)], { persist: true, running: false, failed: true })
    expect(p.stages.map((s) => s.status)).toEqual(['done', 'error', 'pending', 'pending'])
  })
})

describe('formatElapsed', () => {
  it('formats mm:ss', () => {
    expect(formatElapsed(0)).toBe('00:00')
    expect(formatElapsed(65_900)).toBe('01:05')
    expect(formatElapsed(-5)).toBe('00:00')
  })
})
