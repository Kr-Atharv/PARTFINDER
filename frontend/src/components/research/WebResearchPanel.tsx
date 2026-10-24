import {
  AlertTriangle,
  CircleCheck,
  CircleDashed,
  CircleX,
  FileSearch,
  Globe,
  Info,
  Loader2,
  RotateCcw,
  Sparkles,
  Square,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PartCard } from '@/components/parts/PartCard'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { Select } from '@/components/ui/Select'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/context/ToastContext'
import { domains, isDomainId } from '@/data/domains'
import { availabilityOrder } from '@/lib/search'
import { availabilityMeta } from '@/components/parts/AvailabilityBadge'
import { cn } from '@/lib/cn'
import { displayUrl, safeExternalUrl } from '@/lib/safeUrl'
import { deriveProgress, formatElapsed } from '@/lib/researchProgress'
import type { Stage } from '@/lib/researchProgress'
import {
  RESEARCH_PAGE_SIZE,
  currenciesOf,
  emptyResearchFilters,
  filterResearch,
  hasPriceBounds,
  sortResearch,
} from '@/lib/researchFilter'
import type { ResearchFilters, ResearchSort } from '@/lib/researchFilter'
import { ApiError, describeError, isAbort } from '@/services/api'
import { streamResearch } from '@/services/researchService'
import type { ResearchEvent, ResearchParams } from '@/services/researchService'
import { userData } from '@/state/userData'
import type { DomainId, Part } from '@/types'

interface WebResearchPanelProps {
  initialQuery?: string
  domain?: string
  manufacturer?: string
  model?: string
}

type RunState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done' }
  | { status: 'cancelled' }
  | { status: 'error'; error: ReturnType<typeof describeError> }

const SORT_OPTIONS: Array<{ value: ResearchSort; label: string }> = [
  { value: 'relevance', label: 'Relevance (as found)' },
  { value: 'name', label: 'Name (A to Z)' },
  { value: 'manufacturer', label: 'Manufacturer (A to Z)' },
  { value: 'price-asc', label: 'Listed price (low to high)' },
  { value: 'price-desc', label: 'Listed price (high to low)' },
  { value: 'specs-desc', label: 'Most specifications' },
]

function StageIcon({ status }: { status: Stage['status'] }) {
  switch (status) {
    case 'done':
      return <CircleCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
    case 'active':
      return <Loader2 className="h-4 w-4 animate-spin text-brand-600" aria-hidden="true" />
    case 'error':
      return <CircleX className="h-4 w-4 text-red-600" aria-hidden="true" />
    case 'skipped':
      return <CircleDashed className="h-4 w-4 text-ink-400" aria-hidden="true" />
    default:
      return <CircleDashed className="h-4 w-4 text-ink-300" aria-hidden="true" />
  }
}

const STAGE_TEXT: Record<Stage['status'], string> = {
  pending: 'waiting',
  active: 'in progress',
  done: 'done',
  skipped: 'skipped',
  error: 'failed',
}

export function WebResearchPanel({ initialQuery = '', domain = '', manufacturer = '', model = '' }: WebResearchPanelProps) {
  const { notify } = useToast()
  const [query, setQuery] = useState(initialQuery)
  const [queryTouched, setQueryTouched] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<DomainId | ''>(isDomainId(domain) ? domain : '')
  const [domainTouched, setDomainTouched] = useState(false)
  const [maxResults, setMaxResults] = useState(3)
  const [persist, setPersist] = useState(true)
  const [errors, setErrors] = useState<{ query?: string; domain?: string }>({})

  const [run, setRun] = useState<RunState>({ status: 'idle' })
  const [events, setEvents] = useState<ResearchEvent[]>([])
  const [results, setResults] = useState<Part[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [lastRun, setLastRun] = useState<{ params: ResearchParams; persist: boolean } | null>(null)

  const [sort, setSort] = useState<ResearchSort>('relevance')
  const [filters, setFilters] = useState<ResearchFilters>(emptyResearchFilters)
  const [page, setPage] = useState(1)

  const controllerRef = useRef<AbortController | null>(null)
  const startedAt = useRef(0)

  // Follow the search form above until the person edits these fields here.
  useEffect(() => {
    if (!queryTouched) setQuery(initialQuery)
  }, [initialQuery, queryTouched])
  useEffect(() => {
    if (!domainTouched) setSelectedDomain(isDomainId(domain) ? domain : '')
  }, [domain, domainTouched])

  // Cancel any running research when the page is left.
  useEffect(() => () => controllerRef.current?.abort(), [])

  // Elapsed timer while running.
  const running = run.status === 'running'
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt.current), 500)
    return () => window.clearInterval(timer)
  }, [running])

  const execute = useCallback(
    async (params: ResearchParams, persistFlag: boolean) => {
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller
      startedAt.current = Date.now()
      setElapsed(0)
      setEvents([])
      setResults([])
      setPage(1)
      setFilters(emptyResearchFilters)
      setSort('relevance')
      setLastRun({ params, persist: persistFlag })
      setRun({ status: 'running' })

      try {
        const parts = await streamResearch(params, {
          signal: controller.signal,
          onEvent: (event) => setEvents((prev) => [...prev, event]),
        })
        setElapsed(Date.now() - startedAt.current)
        setResults(parts)
        setRun({ status: 'done' })
        userData.recordSearch({
          kind: 'research',
          query: params.query,
          domain: params.domain,
          manufacturer: params.manufacturer ?? '',
          model: params.model ?? '',
          resultCount: parts.length,
        })
        notify(
          parts.length > 0
            ? { tone: 'success', title: `Found ${parts.length} supplier ${parts.length === 1 ? 'record' : 'records'}` }
            : { tone: 'warning', title: 'No parts could be extracted', description: 'See the page log below for why pages were skipped.' },
        )
      } catch (error) {
        setElapsed(Date.now() - startedAt.current)
        if (isAbort(error) || (error instanceof ApiError && error.code === 'ABORTED')) {
          setRun({ status: 'cancelled' })
          return
        }
        const description = describeError(error, 'Live research failed')
        setRun({ status: 'error', error: description })
        notify({ tone: 'error', title: description.title, description: description.message })
      }
    },
    [notify],
  )

  const start = () => {
    const trimmed = query.trim()
    const found: typeof errors = {}
    if (trimmed.length < 2) found.query = 'Enter a part number or description of at least 2 characters.'
    if (!selectedDomain) found.domain = 'Choose the domain to research.'
    setErrors(found)
    if (found.query || found.domain) return
    void execute(
      {
        query: trimmed,
        domain: selectedDomain as DomainId,
        manufacturer: manufacturer.trim() || undefined,
        model: model.trim() || undefined,
        maxResults,
        persistToDb: persist,
      },
      persist,
    )
  }

  const cancel = () => controllerRef.current?.abort()
  const retry = () => lastRun && void execute(lastRun.params, lastRun.persist)

  const progress = useMemo(
    () => deriveProgress(events, { persist: lastRun?.persist ?? persist, running, failed: run.status === 'error' }),
    [events, lastRun, persist, running, run.status],
  )

  const currencies = useMemo(() => currenciesOf(results), [results])
  const visible = useMemo(() => sortResearch(filterResearch(results, filters), sort), [results, filters, sort])
  const totalPages = Math.max(1, Math.ceil(visible.length / RESEARCH_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = visible.slice((safePage - 1) * RESEARCH_PAGE_SIZE, safePage * RESEARCH_PAGE_SIZE)
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(emptyResearchFilters)
  const needsCurrency = currencies.length > 1 && hasPriceBounds(filters) && !filters.currency
  const showProgress = run.status !== 'idle'

  const updateFilters = (next: Partial<ResearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }))
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent-700" aria-hidden="true" />
          <h2 className="text-base font-semibold text-ink-900">Live supplier research</h2>
          <Badge tone="info">Live web (TinyFish)</Badge>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-600">
          Searches the web for supplier and datasheet pages and reads specifications, availability and listed prices from the page
          text. Values are extracted automatically and shown with the text they came from; they are not manually verified.
        </p>

        <form
          className="mt-4 space-y-4"
          aria-label="Live supplier research"
          onSubmit={(event) => {
            event.preventDefault()
            if (!running) start()
          }}
          noValidate
        >
          <div className="grid gap-4 md:grid-cols-[2fr_1fr_auto]">
            <Input
              label="Part number or description"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setQueryTouched(true)
              }}
              placeholder="e.g. SKF 6205 bearing datasheet"
              error={errors.query}
              maxLength={120}
              autoComplete="off"
            />
            <div>
              <Select
                label="Domain"
                value={selectedDomain}
                onChange={(e) => {
                  setSelectedDomain(e.target.value as DomainId | '')
                  setDomainTouched(true)
                }}
                aria-invalid={errors.domain ? true : undefined}
                options={[{ value: '', label: 'Choose a domain…' }, ...domains.map((d) => ({ value: d.id, label: d.label }))]}
              />
              {errors.domain && <p className="mt-1.5 text-xs font-medium text-red-700">{errors.domain}</p>}
            </div>
            <Select
              label="Max pages"
              value={String(maxResults)}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
            />
          </div>

          {(manufacturer.trim() || model.trim()) && (
            <p className="text-xs text-ink-500">
              Also using from the search form:{' '}
              {manufacturer.trim() && <Badge>Manufacturer: {manufacturer.trim()}</Badge>}{' '}
              {model.trim() && <Badge>Model: {model.trim()}</Badge>}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <label className="inline-flex items-center gap-2 text-sm text-ink-800">
              <input
                type="checkbox"
                checked={persist}
                onChange={(e) => setPersist(e.target.checked)}
                className="h-4 w-4 rounded border-line-strong text-brand-600"
              />
              Save results to the catalogue
              <Tooltip content="When on, each record found is stored in the shared catalogue database so it appears in later catalogue searches. Turn it off to look without saving anything.">
                <span tabIndex={0} aria-label="What does saving do?" className="text-ink-400">
                  <Info className="h-4 w-4" aria-hidden="true" />
                </span>
              </Tooltip>
            </label>

            {running ? (
              <Button variant="secondary" onClick={cancel} icon={<Square className="h-4 w-4" aria-hidden="true" />}>
                Cancel research
              </Button>
            ) : (
              <Button type="submit" icon={<Globe className="h-4 w-4" aria-hidden="true" />}>
                Research suppliers
              </Button>
            )}
            {showProgress && <span className="font-mono text-sm text-ink-600" aria-label="Elapsed time">{formatElapsed(elapsed)}</span>}
          </div>
        </form>
      </Card>

      {showProgress && (
        <Card aria-label="Research progress">
          <h3 className="text-sm font-semibold text-ink-900">Progress</h3>
          <ol className="mt-3 space-y-2" role="list">
            {progress.stages.map((stage) => (
              <li key={stage.id} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5">
                  <StageIcon status={stage.status} />
                </span>
                <span className="min-w-0">
                  <span className={cn('font-medium', stage.status === 'pending' || stage.status === 'skipped' ? 'text-ink-500' : 'text-ink-900')}>
                    {stage.label}
                  </span>
                  <span className="sr-only"> — {STAGE_TEXT[stage.status]}</span>
                  {stage.detail && <span className="ml-2 text-ink-500">{stage.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
          <p className="sr-only" role="status" aria-live="polite">
            {run.status === 'running' ? 'Research in progress' : run.status === 'done' ? 'Research finished' : run.status === 'cancelled' ? 'Research cancelled' : run.status === 'error' ? 'Research failed' : ''}
          </p>

          {progress.pages.length > 0 && (
            <details className="mt-4" open={run.status !== 'done' || results.length === 0}>
              <summary className="cursor-pointer text-sm font-medium text-brand-700">Page log ({progress.pages.length})</summary>
              <ul className="mt-2 divide-y divide-line rounded border border-line text-sm">
                {progress.pages.map((pageInfo, index) => {
                  const url = safeExternalUrl(pageInfo.url)
                  return (
                    <li key={`${pageInfo.url}-${index}`} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
                      <span className="min-w-0 break-all">
                        {url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                            {displayUrl(url)}
                            <span className="sr-only"> (opens in a new tab)</span>
                          </a>
                        ) : (
                          pageInfo.url
                        )}
                        {pageInfo.reason && <span className="mt-0.5 block text-xs text-ink-500">Skipped: {pageInfo.reason}</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {pageInfo.evidenceLevel === 'snippet_only' && (
                          <Tooltip content="The page itself could not be fetched; only the search snippet was read.">
                            <span tabIndex={0}>
                              <Badge tone="warning">Snippet only</Badge>
                            </span>
                          </Tooltip>
                        )}
                        {pageInfo.outcome === 'extracted' ? (
                          <Badge tone="success">{pageInfo.specCount ?? 0} specs</Badge>
                        ) : (
                          <Badge>Skipped</Badge>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </details>
          )}
        </Card>
      )}

      {run.status === 'error' && (
        <Alert
          tone="error"
          title={run.error.title}
          action={
            run.error.retryable ? (
              <Button variant="secondary" size="sm" onClick={retry} icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>
                Retry
              </Button>
            ) : undefined
          }
        >
          {run.error.message}
        </Alert>
      )}

      {run.status === 'cancelled' && (
        <Alert
          tone="info"
          title="Research cancelled"
          action={
            <Button variant="secondary" size="sm" onClick={retry} icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>
              Run again
            </Button>
          }
        >
          Nothing from this run is shown. Records the server had already saved before you cancelled may still appear in catalogue searches.
        </Alert>
      )}

      {run.status === 'done' && results.length === 0 && (
        <EmptyState
          icon={FileSearch}
          title="No parts could be extracted"
          description="The pages found did not contain recognisable specifications. Try a manufacturer name or an exact part number, or raise the number of pages."
          action={
            <Button variant="secondary" onClick={retry} icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>
              Search again
            </Button>
          }
        />
      )}

      {run.status === 'done' && results.length > 0 && (
        <section aria-label="Research results" className="space-y-4">
          <Card>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Select label="Sort by" value={sort} options={SORT_OPTIONS} onChange={(e) => { setSort(e.target.value as ResearchSort); setPage(1) }} />
              <Select
                label="Availability"
                value={filters.availability}
                onChange={(e) => updateFilters({ availability: e.target.value as ResearchFilters['availability'] })}
                options={[{ value: '', label: 'Any availability' }, ...availabilityOrder.map((a) => ({ value: a, label: availabilityMeta[a].label }))]}
              />
              <Input
                label="Min listed price"
                type="number"
                inputMode="decimal"
                min={0}
                value={filters.minPrice}
                onChange={(e) => updateFilters({ minPrice: e.target.value })}
              />
              <Input
                label="Max listed price"
                type="number"
                inputMode="decimal"
                min={0}
                value={filters.maxPrice}
                onChange={(e) => updateFilters({ maxPrice: e.target.value })}
              />
              {currencies.length > 1 && (
                <Select
                  label="Currency for price filter"
                  value={filters.currency}
                  onChange={(e) => updateFilters({ currency: e.target.value })}
                  options={[{ value: '', label: 'Choose…' }, ...currencies.map((c) => ({ value: c, label: c }))]}
                />
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
              <label className="inline-flex items-center gap-2 text-sm text-ink-800">
                <input
                  type="checkbox"
                  checked={filters.onlyWithPrice}
                  onChange={(e) => updateFilters({ onlyWithPrice: e.target.checked })}
                  className="h-4 w-4 rounded border-line-strong text-brand-600"
                />
                Only parts with a listed price
              </label>
              {filtersActive && (
                <Button variant="ghost" size="sm" onClick={() => { setFilters(emptyResearchFilters); setPage(1) }}>
                  Clear filters
                </Button>
              )}
            </div>
            {needsCurrency && (
              <p className="mt-2 text-xs text-amber-800">
                These results list prices in more than one currency. Choose a currency so prices are only compared like for like; amounts are never converted.
              </p>
            )}
            <p className="mt-2 text-xs text-ink-500">
              Prices are shown exactly as printed on each source page. They are not verified, converted or guaranteed current.
            </p>
          </Card>

          <p className="text-sm text-ink-600" aria-live="polite">
            Showing <span className="font-semibold text-ink-900">{visible.length === 0 ? 0 : (safePage - 1) * RESEARCH_PAGE_SIZE + 1}–{(safePage - 1) * RESEARCH_PAGE_SIZE + pageItems.length}</span> of{' '}
            <span className="font-semibold text-ink-900">{visible.length}</span>
            {visible.length !== results.length && <> (filtered from {results.length})</>} supplier {results.length === 1 ? 'record' : 'records'}
          </p>

          {visible.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="No results match these filters"
              description="Your research found parts, but none match the current filters."
              action={
                <Button variant="secondary" onClick={() => { setFilters(emptyResearchFilters); setPage(1) }}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <ul className="space-y-4">
                {pageItems.map((part) => (
                  <li key={part.id} className="space-y-2">
                    <PartCard part={part} />
                    {part.conflictingSpecs && part.conflictingSpecs.length > 0 && (
                      <Alert tone="warning" title="Conflicting values across sources">
                        Different values were found for: {part.conflictingSpecs.map((c) => c.label).join(', ')}. Open Quick view to see each value and where it came from.
                      </Alert>
                    )}
                  </li>
                ))}
              </ul>
              <Pagination page={safePage} totalPages={totalPages} onPage={setPage} label="Research results pages" />
            </>
          )}
        </section>
      )}
    </div>
  )
}
