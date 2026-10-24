import { ArrowRight, Bookmark, ChevronRight, Eye, GitCompareArrows, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ComparisonRow, SearchRow } from '@/components/history/HistoryRows'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { usePartDrawer } from '@/context/PartDrawerContext'
import { domainById, domains } from '@/data/domains'
import { workflowSteps } from '@/data/workflow'
import { searchLink } from '@/lib/history'
import { fetchPopular } from '@/services/catalogService'
import type { Loaded, PopularSearches } from '@/services/catalogService'
import { DEVICE_ONLY_NOTE, useComparisonHistory, useRecentSearches, useSavedParts, useViewedParts } from '@/state/userData'
import type { Part } from '@/types'

const DEVICE_BADGE = <Badge tone="neutral">Stored on this device</Badge>

function SectionCard({
  id,
  title,
  note,
  badge,
  link,
  children,
}: {
  id: string
  title: string
  note?: string
  badge?: React.ReactNode
  link?: { to: string; label: string }
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id}>
      <Card padded={false} className="h-full">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id={id} className="text-base font-semibold text-ink-900">
              {title}
            </h2>
            {note && <p className="mt-0.5 text-xs text-ink-500">{note}</p>}
          </div>
          <div className="flex items-center gap-3">
            {badge}
            {link && (
              <Link to={link.to} className="text-sm font-medium text-brand-700 hover:text-brand-600">
                {link.label}
              </Link>
            )}
          </div>
        </div>
        {children}
      </Card>
    </section>
  )
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="px-5 py-6 text-sm text-ink-500">{children}</p>

function PartRow({ part, extra }: { part: Part; extra?: string }) {
  const drawer = usePartDrawer()
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-surface-muted">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900">{part.name}</p>
        <p className="text-xs text-ink-500">
          <span className="font-mono text-ink-700">{part.partNumber}</span> · {part.manufacturer || 'Manufacturer not listed'} · {domainById[part.domain].label}
          {extra ? ` · ${extra}` : ''}
          {part.isDemo ? ' · Demo data' : ''}
        </p>
      </div>
      <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" aria-hidden="true" />} onClick={() => drawer.open(part)} aria-label={`Quick view ${part.name}`}>
        Quick view
      </Button>
    </li>
  )
}

function PopularSearchesCard() {
  const [state, setState] = useState<Loaded<PopularSearches> | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetchPopular(controller.signal)
      .then(setState)
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  return (
    <SectionCard id="popular-heading" title="Popular searches" note="Most frequent searches recorded by the PartFinder server." badge={<Badge tone="info">From the server</Badge>}>
      {state === null ? (
        <LoadingState label="Loading popular searches…" className="py-8" />
      ) : state.status === 'unavailable' ? (
        <Empty>Popular searches are unavailable because the server could not be reached. {state.message}</Empty>
      ) : !state.data.available ? (
        <Empty>The server could not read its search history, so popular searches are unavailable right now.</Empty>
      ) : state.data.searches.length === 0 ? (
        <Empty>No searches have been recorded by the server yet.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {state.data.searches.map((search) => (
            <li key={`${search.query}|${search.domain ?? ''}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-muted">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900">{search.query}</p>
                <p className="text-xs text-ink-500">
                  {search.domain ? domainById[search.domain].label : 'All domains'} · searched {search.count} {search.count === 1 ? 'time' : 'times'}
                </p>
              </div>
              <Link
                to={searchLink({ kind: 'catalogue', query: search.query, domain: search.domain, manufacturer: '', model: '' })}
                className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-600"
                aria-label={`Search for ${search.query}`}
              >
                Search
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

export default function OverviewPage() {
  const searches = useRecentSearches()
  const saved = useSavedParts()
  const comparisons = useComparisonHistory()
  const viewed = useViewedParts()
  const frequentlyViewed = viewed.filter((entry) => entry.count >= 2).slice(0, 4)

  return (
    <div className="space-y-8">
      <Card className="sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <Badge tone="brand" dot>
              Find. Compare. Verify.
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink-900">Welcome to PartFinder</h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-600 sm:text-base">
              Search for spare parts across industrial machinery, electronics and automotive, compare candidates on the
              specifications recorded for them, and check each one against your requirements with the source behind every
              result.
            </p>
          </div>
          <div className="shrink-0">
            <Button to="/find" size="lg" icon={<Search className="h-5 w-5" aria-hidden="true" />} className="w-full md:w-auto">
              Find a Part
            </Button>
          </div>
        </div>
      </Card>

      <p className="text-xs text-ink-500">
        Recent searches, saved parts, comparison history and viewed parts below are personal to this browser. {DEVICE_ONLY_NOTE}
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard id="recent-heading" title="Recent searches" badge={DEVICE_BADGE} link={{ to: '/history', label: 'View all' }}>
          {searches.length === 0 ? (
            <Empty>No searches yet. Your recent searches will appear here once you run one.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {searches.slice(0, 5).map((entry) => (
                <SearchRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard id="saved-heading" title="Saved parts" badge={DEVICE_BADGE} link={{ to: '/saved', label: 'View all' }}>
          {saved.length === 0 ? (
            <Empty>
              <Bookmark className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
              No saved parts yet. Choose Save on a search result to keep it here.
            </Empty>
          ) : (
            <ul className="divide-y divide-line">
              {saved.slice(0, 5).map((entry) => (
                <PartRow key={entry.part.id} part={entry.part} />
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard id="comparisons-heading" title="Comparison history" badge={DEVICE_BADGE} link={{ to: '/history', label: 'View all' }}>
          {comparisons.length === 0 ? (
            <Empty>
              <GitCompareArrows className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
              No comparisons yet. Compare two or more parts and they will be listed here so you can reopen them.
            </Empty>
          ) : (
            <ul className="divide-y divide-line">
              {comparisons.slice(0, 4).map((record) => (
                <ComparisonRow key={record.id} record={record} />
              ))}
            </ul>
          )}
        </SectionCard>

        <PopularSearchesCard />
      </div>

      {frequentlyViewed.length > 0 && (
        <SectionCard id="viewed-heading" title="Frequently viewed parts" note="Parts you opened two or more times." badge={DEVICE_BADGE}>
          <ul className="divide-y divide-line">
            {frequentlyViewed.map((entry) => (
              <PartRow key={entry.part.id} part={entry.part} extra={`viewed ${entry.count} times`} />
            ))}
          </ul>
        </SectionCard>
      )}

      <section aria-labelledby="domains-heading">
        <h2 id="domains-heading" className="text-lg font-semibold text-ink-900">
          Choose a domain
        </h2>
        <p className="mt-1 text-sm text-ink-500">Start from the kind of part you are looking for.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {domains.map(({ id, label, description, examples, icon: Icon }) => (
            <Link
              key={id}
              to={`/find?domain=${id}`}
              className="group flex flex-col rounded-lg border border-line bg-surface p-5 shadow-card transition-colors hover:border-brand-500 hover:shadow-pop"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-ink-900">{label}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">{description}</p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {examples.map((example) => (
                  <li key={example}>
                    <Badge>{example}</Badge>
                  </li>
                ))}
              </ul>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
                Search {label.toLowerCase()} parts
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="How it works">
        <Card>
          <h2 className="text-base font-semibold text-ink-900">How it works</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {workflowSteps.map(({ id, title, description, icon: Icon }, index) => (
              <li key={id} className="relative rounded-md border border-line bg-surface-muted p-4">
                <div className="flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-surface text-brand-600 shadow-card">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-xs text-ink-400">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-ink-900">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">{description}</p>
                {index < workflowSteps.length - 1 && (
                  <ChevronRight className="absolute -right-3.5 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-ink-400 lg:block" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </Card>
      </section>
    </div>
  )
}
