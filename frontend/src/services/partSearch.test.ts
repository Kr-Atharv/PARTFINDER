import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/api'
import { buildSearchQuery, fetchPartByIdStrict, searchDemoCatalogue, searchPartsPage, toPart } from '@/services/partSearch'
import { sampleParts } from '@/data/sampleParts'
import { emptyRefinements } from '@/lib/search'

const none = { query: '', domain: null, manufacturer: '', model: '' } as const

describe('searchDemoCatalogue', () => {
  it('pages, sorts and labels results as demo', () => {
    const first = searchDemoCatalogue({ ...none, domain: 'industrial' }, emptyRefinements, { page: 1, pageSize: 3, sort: 'name-asc' }, 'offline')
    const industrial = sampleParts.filter((p) => p.domain === 'industrial')
    expect(first.source).toBe('demo')
    expect(first.demoReason).toBe('offline')
    expect(first.total).toBe(industrial.length)
    expect(first.results).toHaveLength(Math.min(3, industrial.length))
    expect(first.totalPages).toBe(Math.ceil(industrial.length / 3))
    expect(first.results.every((p) => p.isDemo)).toBe(true)
    const names = first.results.map((p) => p.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })))
  })

  it('page 2 continues where page 1 stopped and an out-of-range page is clamped', () => {
    const paging = { pageSize: 2, sort: 'name-asc' as const }
    const p1 = searchDemoCatalogue(none, emptyRefinements, { ...paging, page: 1 }, 'x')
    const p2 = searchDemoCatalogue(none, emptyRefinements, { ...paging, page: 2 }, 'x')
    expect(p2.results.map((p) => p.id)).not.toEqual(p1.results.map((p) => p.id))
    const last = searchDemoCatalogue(none, emptyRefinements, { ...paging, page: 9999 }, 'x')
    expect(last.page).toBe(last.totalPages)
    expect(last.results.length).toBeGreaterThan(0)
  })

  it('applies refinements and returns an empty page (not invented rows) for no match', () => {
    const res = searchDemoCatalogue({ ...none, query: 'zzzz-no-such-part' }, emptyRefinements, { page: 1, pageSize: 10, sort: 'name-asc' }, 'x')
    expect(res.total).toBe(0)
    expect(res.results).toEqual([])
    expect(res.totalPages).toBe(1)
  })
})

describe('buildSearchQuery', () => {
  it('uses the backend parameter names', () => {
    const q = buildSearchQuery({ query: ' seal ', domain: 'industrial', manufacturer: 'A', model: 'M' }, { category: 'C', availability: 'limited', specLabel: 'L', specValue: 'V' }, { page: 2, pageSize: 10, sort: 'name-desc' })
    expect(Object.fromEntries(q)).toEqual({ query: 'seal', domain: 'industrial', manufacturer: 'A', model: 'M', category: 'C', availability: 'limited', specLabel: 'L', specValue: 'V', page: '2', limit: '10', sort: 'name-desc' })
  })
})

describe('toPart', () => {
  it('reads claims from both catalogue (source) and research (sourceUrl) shapes and invents nothing', () => {
    const part = toPart({
      id: 7,
      name: 'X',
      domain: 'industrial',
      specs: [{ label: 'A', value: 1 }],
      sourceClaims: [
        { label: 'A', claimedValue: '1', evidence: 'A=1', source: { name: 'S1', url: 'https://s1.test' } },
        { label: 'B', claimedValue: '2', sourceUrl: 'https://s2.test' },
      ],
    })
    expect(part.id).toBe('7')
    expect(part.specs).toEqual([{ label: 'A', value: '1' }])
    expect(part.claims?.[0]).toMatchObject({ sourceName: 'S1', sourceUrl: 'https://s1.test', evidence: 'A=1' })
    expect(part.claims?.[1].sourceUrl).toBe('https://s2.test')
    expect(part.isDemo).toBe(false)
    expect(part.source.name).toBe('No source recorded')
    expect(part.price).toBeUndefined()
  })
})

describe('server vs demo fallback', () => {
  afterEach(() => vi.unstubAllGlobals())
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

  it('uses demo data only when the server is unavailable, and labels it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('x')))
    const page = await searchPartsPage({ ...none, domain: 'industrial' }, emptyRefinements, { page: 1, pageSize: 5, sort: 'name-asc' })
    expect(page.source).toBe('demo')
    expect(page.demoReason).toBeTruthy()
  })

  it('never substitutes demo data for a rejected request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(400, { error: { message: 'bad', code: 'VALIDATION_ERROR' } })))
    await expect(searchPartsPage(none, emptyRefinements, { page: 1, pageSize: 5, sort: 'name-asc' })).rejects.toBeInstanceOf(ApiError)
  })

  it('maps a backend page to Parts with source "backend"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, { data: { results: [{ id: 'a', name: 'N', domain: 'industrial', specs: [] }], total: 41, page: 2, limit: 20, totalPages: 3 } })))
    const page = await searchPartsPage({ ...none, query: 'n' }, emptyRefinements, { page: 2, pageSize: 20, sort: 'name-asc' })
    expect(page).toMatchObject({ source: 'backend', total: 41, page: 2, totalPages: 3 })
    expect(page.results[0].id).toBe('a')
  })

  it('fetchPartByIdStrict: 404 -> null, other failures throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(404, { error: { message: 'nope', code: 'NOT_FOUND' } })))
    await expect(fetchPartByIdStrict('x')).resolves.toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(500, { error: { message: 'boom', code: 'INTERNAL' } })))
    await expect(fetchPartByIdStrict('x')).rejects.toBeInstanceOf(ApiError)
  })
})
