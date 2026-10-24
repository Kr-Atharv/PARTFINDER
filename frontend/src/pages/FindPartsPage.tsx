import { Database, Globe, Library, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { WebResearchPanel } from '@/components/research/WebResearchPanel'
import { FilterPanel } from '@/components/search/FilterPanel'
import { ResultsPanel } from '@/components/search/ResultsPanel'
import { SearchForm } from '@/components/search/SearchForm'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeading } from '@/components/ui/PageHeading'
import { PartListSkeleton } from '@/components/ui/Skeleton'
import { Tabs, panelId, tabId } from '@/components/ui/Tabs'
import { domainById } from '@/data/domains'
import { emptyRefinements, hasRefinements } from '@/lib/search'
import {
  buildSearchParams,
  emptyCriteria,
  hasErrors,
  normalizeCriteria,
  paramsToCriteria,
  paramsToDraft,
  paramsToPaging,
  paramsToRefinements,
  validateCriteria,
} from '@/lib/validation'
import { describeError, isAbort } from '@/services/api'
import { fetchFacets } from '@/services/catalogService'
import type { Loaded } from '@/services/catalogService'
import { searchPartsPage } from '@/services/partSearch'
import { userData, useRecentSearches } from '@/state/userData'
import type { DomainId, Facets, SearchCriteria, SearchErrors, SearchPage, SearchRefinements, SortKey } from '@/types'

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; page: SearchPage }
  | { status: 'error'; error: ReturnType<typeof describeError> }

type Tab = 'catalogue' | 'research'

const EXAMPLE_SEARCHES: Array<SearchCriteria & { domain: DomainId }> = [
  { query: 'hydraulic seal kit', domain: 'industrial', manufacturer: '', model: '' },
  { query: 'voltage regulator', domain: 'electronics', manufacturer: '', model: '' },
  { query: 'brake pad', domain: 'automotive', manufacturer: '', model: '' },
]

const ID_PREFIX = 'find'

export default function FindPartsPage() {
  const [params, setParams] = useSearchParams()
  const paramKey = params.toString()
  const sp = useMemo(() => new URLSearchParams(paramKey), [paramKey])

  // The URL is the source of truth for the submitted search, filters, sort and page, so results
  // survive navigation, the back button and links from other pages.
  const urlDraft = useMemo(() => paramsToDraft(sp), [sp])
  const criteria = useMemo(() => paramsToCriteria(sp), [sp])
  const refinements = useMemo(() => paramsToRefinements(sp), [sp])
  const paging = useMemo(() => paramsToPaging(sp), [sp])
  const browse = Boolean(sp.get('browse'))
  const tab: Tab = sp.get('tab') === 'research' ? 'research' : 'catalogue'

  const [draft, setDraft] = useState<SearchCriteria>(urlDraft)
  const [errors, setErrors] = useState<SearchErrors>({})
  const [runId, setRunId] = useState(0)
  const [state, setState] = useState<SearchState>({ status: 'idle' })
  const [facets, setFacets] = useState<Loaded<Facets> | null>(null)
  const recents = useRecentSearches()
  const resultsRef = useRef<HTMLDivElement>(null)
  // Set when the person submits a search, so it is recorded once with its real result count.
  const pendingRecord = useRef<SearchCriteria | null>(null)

  useEffect(() => {
    setDraft(urlDraft)
    setErrors({})
  }, [urlDraft])

  useEffect(() => {
    const controller = new AbortController()
    fetchFacets(controller.signal)
      .then(setFacets)
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  // Everything that changes which catalogue results are shown (but not the tab).
  const searchKey = criteria ? buildSearchParams(criteria, refinements, paging, { browse }).toString() : ''

  useEffect(() => {
    if (!criteria) {
      setState({ status: 'idle' })
      return
    }
    const controller = new AbortController()
    setState({ status: 'loading' })
    searchPartsPage(criteria, refinements, paging, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return
        setState({ status: 'success', page })
        if (pendingRecord.current && page.source === 'backend') {
          userData.recordSearch({ ...pendingRecord.current, kind: 'catalogue', resultCount: page.total })
        }
        pendingRecord.current = null
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return
        pendingRecord.current = null
        setState({ status: 'error', error: describeError(error, 'The search could not be completed') })
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey, runId])

  const withTab = useCallback(
    (next: URLSearchParams, nextTab: Tab = tab) => {
      if (nextTab === 'research') next.set('tab', 'research')
      return next
    },
    [tab],
  )

  const filtersActive = hasRefinements(refinements)

  const writeUrl = (c: SearchCriteria, r: SearchRefinements, p: Partial<typeof paging>, extra: { browse?: boolean } = {}) =>
    setParams(withTab(buildSearchParams(c, r, p, { browse: extra.browse ?? browse })))

  const runSearch = (next: SearchCriteria = draft) => {
    const normalized = normalizeCriteria(next)
    const allowEmpty = Boolean(normalized.domain || normalized.manufacturer || normalized.model || filtersActive || browse)
    const found = validateCriteria(normalized, allowEmpty)
    setErrors(found)
    if (hasErrors(found)) return
    pendingRecord.current = normalized
    writeUrl(normalized, refinements, { ...paging, page: 1 })
    setRunId((n) => n + 1) // Re-run even when the submitted search is unchanged.
  }

  const base = criteria ?? normalizeCriteria(urlDraft)

  const setRefinements = (next: SearchRefinements) => writeUrl(base, next, { ...paging, page: 1 })
  const setSort = (sort: SortKey) => writeUrl(base, refinements, { ...paging, sort, page: 1 })
  const setPageSize = (pageSize: number) => writeUrl(base, refinements, { ...paging, pageSize, page: 1 })
  const setPage = (page: number) => {
    writeUrl(base, refinements, { ...paging, page })
    window.requestAnimationFrame(() => resultsRef.current?.focus({ preventScroll: false }))
  }
  const clearFilters = () => writeUrl(base, emptyRefinements, { ...paging, sort: 'name-asc', page: 1 })

  const browseAll = () => {
    const next = normalizeCriteria({ ...draft, query: '' })
    setDraft(next)
    pendingRecord.current = null
    writeUrl(next, refinements, { ...paging, page: 1 }, { browse: true })
    setRunId((n) => n + 1)
  }

  const setTab = (next: Tab) => {
    const copy = new URLSearchParams(paramKey)
    if (next === 'research') copy.set('tab', 'research')
    else copy.delete('tab')
    setParams(copy, { replace: true })
  }

  const handleDraftChange = (next: SearchCriteria) => {
    setDraft(next)
    setErrors((prev) => ({
      query: next.query !== draft.query ? undefined : prev.query,
      manufacturer: next.manufacturer !== draft.manufacturer ? undefined : prev.manufacturer,
      model: next.model !== draft.model ? undefined : prev.model,
    }))
  }

  const handleReset = () => {
    setDraft(emptyCriteria)
    setErrors({})
    setParams(withTab(new URLSearchParams()))
  }

  const loading = state.status === 'loading'
  const manufacturerOptions = facets?.status === 'ok' ? facets.data.manufacturers.map((m) => m.value) : undefined
  const catalogueSize = facets?.status === 'ok' ? facets.data.totalParts : undefined

  return (
    <div className="space-y-6">
      <PageHeading
        title="Find Parts"
        description="Search by part number, component name or description across industrial, electronics and automotive parts, or research suppliers on the live web."
      />

      <SearchForm
        value={draft}
        errors={errors}
        loading={loading}
        onChange={handleDraftChange}
        onSubmit={(override) => runSearch(override ?? draft)}
        onReset={handleReset}
        manufacturerOptions={manufacturerOptions}
      />

      <Tabs
        idPrefix={ID_PREFIX}
        label="Search source"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'catalogue', label: (<><Library className="h-4 w-4" aria-hidden="true" />Catalogue{catalogueSize !== undefined && <span className="font-mono text-xs text-ink-500">{catalogueSize}</span>}</>) },
          { id: 'research', label: (<><Globe className="h-4 w-4" aria-hidden="true" />Live supplier research</>) },
        ]}
      />

      {/* Both panels stay mounted so a running research or its results survive switching tabs. */}
      <div role="tabpanel" id={panelId(ID_PREFIX, 'catalogue')} aria-labelledby={tabId(ID_PREFIX, 'catalogue')} hidden={tab !== 'catalogue'} className="space-y-6">
        <FilterPanel
          refinements={refinements}
          paging={paging}
          facets={facets}
          onRefinements={setRefinements}
          onSort={setSort}
          onPageSize={setPageSize}
          onClear={clearFilters}
        />

        <div ref={resultsRef} tabIndex={-1} className="space-y-6 focus:outline-none">
          {state.status === 'idle' && (
            <EmptyState
              icon={Search}
              title="Search for a part"
              description="Enter a part number, component name or description above. You can narrow by domain, manufacturer or model, or list everything in the catalogue."
              action={
                <div className="space-y-4">
                  <div className="flex flex-wrap justify-center gap-2">
                    {EXAMPLE_SEARCHES.map((example) => {
                      const DomainIcon = domainById[example.domain].icon
                      return (
                        <Button
                          key={example.query}
                          variant="secondary"
                          size="sm"
                          icon={<DomainIcon className="h-4 w-4" aria-hidden="true" />}
                          onClick={() => {
                            const next = normalizeCriteria(example)
                            setDraft(next)
                            runSearch(next)
                          }}
                        >
                          {example.query}
                        </Button>
                      )
                    })}
                    <Button variant="secondary" size="sm" icon={<Database className="h-4 w-4" aria-hidden="true" />} onClick={browseAll}>
                      Browse all parts
                    </Button>
                  </div>
                  {recents.filter((r) => r.kind === 'catalogue').length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-ink-500">Recent searches on this device</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {recents
                          .filter((r) => r.kind === 'catalogue')
                          .slice(0, 5)
                          .map((r) => (
                            <Button
                              key={r.id}
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const next = normalizeCriteria({ query: r.query, domain: r.domain, manufacturer: r.manufacturer, model: r.model })
                                setDraft(next)
                                runSearch(next)
                              }}
                            >
                              {r.query || '(filters only)'}
                            </Button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              }
            />
          )}

          {state.status === 'loading' && <PartListSkeleton count={Math.min(paging.pageSize, 4)} label="Searching the catalogue" />}

          {state.status === 'error' && (
            <Alert
              tone="error"
              title={state.error.title}
              action={
                state.error.retryable ? (
                  <Button variant="secondary" size="sm" onClick={() => setRunId((n) => n + 1)}>
                    Try again
                  </Button>
                ) : undefined
              }
            >
              {state.error.message}
            </Alert>
          )}

          {state.status === 'success' && criteria && (
            <ResultsPanel
              page={state.page}
              criteria={criteria}
              filtersActive={filtersActive}
              onPage={setPage}
              onClearFilters={clearFilters}
              onResearch={() => setTab('research')}
            />
          )}
        </div>
      </div>

      <div role="tabpanel" id={panelId(ID_PREFIX, 'research')} aria-labelledby={tabId(ID_PREFIX, 'research')} hidden={tab !== 'research'}>
        <WebResearchPanel initialQuery={draft.query} domain={draft.domain ?? undefined} manufacturer={draft.manufacturer} model={draft.model} />
      </div>
    </div>
  )
}
