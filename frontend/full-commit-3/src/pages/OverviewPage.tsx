import { Link } from 'react-router-dom'
import { ArrowRight, ChevronRight, Search } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { domainById, domains } from '@/data/domains'
import { sampleRecentSearches, workflowSteps } from '@/data/sample'
import { cn } from '@/lib/cn'
import type { SearchStatus } from '@/types'

const statusMeta: Record<SearchStatus, { label: string; tone: BadgeTone }> = {
  completed: { label: 'Completed', tone: 'success' },
  in_progress: { label: 'In progress', tone: 'info' },
  needs_review: { label: 'Needs review', tone: 'warning' },
}

export default function OverviewPage() {
  const recentSearches = sampleRecentSearches

  return (
    <div className="space-y-8">
      <Card className="sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <Badge tone="brand" dot>
              Find. Compare. Verify.
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink-900">
              Welcome to PartFinder
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-600 sm:text-base">
              PartFinder is a spare-parts discovery and compatibility intelligence platform. Search for
              parts across industrial machinery, electronics and automotive, compare candidates on
              extracted specifications, and verify fit before you order.
            </p>
            <p className="mt-3 text-xs text-ink-500">
              Live-web discovery will be connected in a later step. This screen is the interface
              foundation only.
            </p>
          </div>
          <div className="shrink-0">
            <Button
              to="/find"
              size="lg"
              icon={<Search className="h-5 w-5" aria-hidden="true" />}
              className="w-full md:w-auto"
            >
              Find a Part
            </Button>
          </div>
        </div>
      </Card>

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
              className="group flex flex-col rounded-lg border border-line bg-white p-5 shadow-card transition-colors hover:border-brand-500 hover:shadow-pop"
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
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="How it works">
        <Card>
          <CardHeader
            title="How it works"
            description="The workflow PartFinder is being built around."
          />
          <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {workflowSteps.map(({ id, title, description, icon: Icon }, index) => (
              <li key={id} className="relative rounded-md border border-line bg-surface-muted p-4">
                <div className="flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-brand-600 shadow-card">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-xs text-ink-400">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-ink-900">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">{description}</p>
                {index < workflowSteps.length - 1 && (
                  <ChevronRight
                    className="absolute -right-3.5 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-ink-400 lg:block"
                    aria-hidden="true"
                  />
                )}
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section aria-labelledby="recent-heading">
        <Card padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 id="recent-heading" className="text-base font-semibold text-ink-900">
                Recent searches
              </h2>
              <p className="mt-0.5 text-sm text-ink-500">
                Illustrative sample data. No searches have been run.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone="warning">Sample data</Badge>
              <Link
                to="/history"
                className="text-sm font-medium text-brand-700 hover:text-brand-600"
              >
                View all
              </Link>
            </div>
          </div>

          {recentSearches.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Search}
                title="No searches yet"
                description="Your recent searches will appear here once you run your first part search."
                action={
                  <Button to="/find" icon={<Search className="h-4 w-4" aria-hidden="true" />}>
                    Find a Part
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-muted text-xs uppercase tracking-wider text-ink-500">
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Query
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Domain
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recentSearches.map((search) => {
                    const domain = domainById[search.domain]
                    const status = statusMeta[search.status]
                    const DomainIcon = domain.icon
                    return (
                      <tr key={search.id} className="hover:bg-surface-muted">
                        <td className="px-5 py-3 font-medium text-ink-900">{search.query}</td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-2 text-ink-600">
                            <DomainIcon className="h-4 w-4 text-ink-400" aria-hidden="true" />
                            {domain.label}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={status.tone} dot>
                            {status.label}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            to={`/find?domain=${search.domain}&q=${encodeURIComponent(search.query)}`}
                            className={cn(
                              'inline-flex items-center gap-1 text-sm font-medium text-brand-700',
                              'hover:text-brand-600',
                            )}
                          >
                            Open
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  )
}
