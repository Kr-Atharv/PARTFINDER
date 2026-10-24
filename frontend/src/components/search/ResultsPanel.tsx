import { FilterX, Globe, SearchX } from 'lucide-react'
import { PartCard } from '@/components/parts/PartCard'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import type { SearchCriteria, SearchPage } from '@/types'

/** "1–20 of 134" style range for the current page. Exported for tests. */
export function resultRange(page: Pick<SearchPage, 'page' | 'pageSize' | 'total' | 'results'>) {
  if (page.total === 0 || page.results.length === 0) return { from: 0, to: 0 }
  const from = (page.page - 1) * page.pageSize + 1
  return { from, to: from + page.results.length - 1 }
}

interface ResultsPanelProps {
  page: SearchPage
  criteria: SearchCriteria
  filtersActive: boolean
  onPage: (page: number) => void
  onClearFilters: () => void
  /** Switch to the live supplier research tab with the current query. */
  onResearch: () => void
}

/**
 * Presentational list of one server-side page of results. Filtering, sorting and paging
 * happen on the server (or, labelled as demo, in the demo catalogue); nothing is re-filtered here.
 */
export function ResultsPanel({ page, criteria, filtersActive, onPage, onClearFilters, onResearch }: ResultsPanelProps) {
  const { from, to } = resultRange(page)
  const isDemo = page.source === 'demo'
  const summary = criteria.query ? (
    <>
      for <span className="font-medium text-ink-900">“{criteria.query}”</span>
    </>
  ) : null

  return (
    <section aria-label="Search results" className="space-y-4">
      {isDemo && (
        <Alert tone="warning" title="Showing the demo catalogue, not live data">
          The PartFinder server could not be reached ({page.demoReason ?? 'no response'}), so these results come from a small
          built-in demo catalogue of invented parts. Do not rely on them.
        </Alert>
      )}
      {page.truncated && (
        <Alert tone="warning" title="Specification filter scanned only part of the catalogue">
          The server checks specifications on a limited number of records, so the total below may be incomplete. Add a query or
          another filter to narrow it down.
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600" aria-live="polite">
          {page.total === 0 ? (
            <>No results {summary}</>
          ) : (
            <>
              Showing <span className="font-semibold text-ink-900">{from}–{to}</span> of{' '}
              <span className="font-semibold text-ink-900">{page.total}</span> {page.total === 1 ? 'result' : 'results'} {summary}
            </>
          )}
        </p>
        {isDemo ? <Badge tone="warning">Demo data</Badge> : <Badge tone="success" dot>Live catalogue</Badge>}
      </div>

      {page.total === 0 ? (
        <EmptyState
          icon={filtersActive ? FilterX : SearchX}
          title="No parts found"
          description={
            filtersActive
              ? 'Nothing matches the search together with the current filters. Remove a filter or widen the search.'
              : `Nothing in the ${isDemo ? 'demo ' : ''}catalogue matches this search. Check the spelling, use fewer words, or remove the manufacturer, model or domain restriction.`
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {filtersActive && (
                <Button variant="secondary" icon={<FilterX className="h-4 w-4" aria-hidden="true" />} onClick={onClearFilters}>
                  Clear filters
                </Button>
              )}
              {!isDemo && criteria.query && (
                <Button icon={<Globe className="h-4 w-4" aria-hidden="true" />} onClick={onResearch}>
                  Research suppliers on the web
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <>
          <ul className="space-y-4">
            {page.results.map((part) => (
              <li key={part.id}>
                <PartCard part={part} />
              </li>
            ))}
          </ul>
          <Pagination page={page.page} totalPages={page.totalPages} onPage={onPage} label="Search results pages" className="pt-2" />
        </>
      )}
    </section>
  )
}
