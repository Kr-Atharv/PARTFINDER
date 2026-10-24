import { FilterX, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PartCard } from '@/components/parts/PartCard'
import { availabilityMeta } from '@/components/parts/AvailabilityBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select } from '@/components/ui/Select'
import type { SelectOption } from '@/components/ui/Select'
import {
  availabilityOrder,
  emptyFilters,
  filterParts,
  hasActiveFilters,
  sortParts,
  uniqueSorted,
} from '@/lib/search'
import type { Availability, Part, ResultFilters, SearchCriteria, SortKey } from '@/types'

const SORT_OPTIONS: Array<SelectOption & { value: SortKey }> = [
  { value: 'name-asc', label: 'Part name (A to Z)' },
  { value: 'name-desc', label: 'Part name (Z to A)' },
  { value: 'manufacturer-asc', label: 'Manufacturer (A to Z)' },
  { value: 'manufacturer-desc', label: 'Manufacturer (Z to A)' },
]

interface ResultsPanelProps {
  results: Part[]
  criteria: SearchCriteria
}

/**
 * Filters and sorts a result set. Mount it with a `key` that changes per
 * search so filter and sort state resets for every new search.
 */
export function ResultsPanel({ results, criteria }: ResultsPanelProps) {
  const [filters, setFilters] = useState<ResultFilters>(emptyFilters)
  const [sort, setSort] = useState<SortKey>('name-asc')

  const manufacturerOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'All manufacturers' },
      ...uniqueSorted(results.map((p) => p.manufacturer)).map((m) => ({ value: m, label: m })),
    ],
    [results],
  )
  const categoryOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'All categories' },
      ...uniqueSorted(results.map((p) => p.category)).map((c) => ({ value: c, label: c })),
    ],
    [results],
  )
  const availabilityOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'Any availability' },
      ...availabilityOrder
        .filter((a) => results.some((p) => p.availability === a))
        .map((a) => ({ value: a, label: availabilityMeta[a].label })),
    ],
    [results],
  )

  const visible = useMemo(() => sortParts(filterParts(results, filters), sort), [results, filters, sort])
  const filtersActive = hasActiveFilters(filters)

  if (results.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="No parts found"
        description={`Nothing in the demo catalogue matches “${criteria.query}”${
          criteria.domain ? ` in ${criteria.domain}` : ''
        }. Check the spelling, use fewer words, or remove the manufacturer, model or domain restriction.`}
      />
    )
  }

  return (
    <section aria-label="Search results" className="space-y-4">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Manufacturer"
            value={filters.manufacturer}
            options={manufacturerOptions}
            onChange={(e) => setFilters({ ...filters, manufacturer: e.target.value })}
          />
          <Select
            label="Category"
            value={filters.category}
            options={categoryOptions}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          />
          <Select
            label="Availability (demo)"
            value={filters.availability}
            options={availabilityOptions}
            onChange={(e) =>
              setFilters({ ...filters, availability: e.target.value as Availability | '' })
            }
          />
          <Select
            label="Sort by"
            value={sort}
            options={SORT_OPTIONS}
            onChange={(e) => setSort(e.target.value as SortKey)}
          />
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600" aria-live="polite">
          Showing <span className="font-semibold text-ink-900">{visible.length}</span> of{' '}
          {results.length} {results.length === 1 ? 'result' : 'results'} for{' '}
          <span className="font-medium text-ink-900">“{criteria.query}”</span>
        </p>
        <div className="flex items-center gap-2">
          <Badge tone="warning">Demo data</Badge>
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              icon={<FilterX className="h-4 w-4" aria-hidden="true" />}
              onClick={() => setFilters(emptyFilters)}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={FilterX}
          title="No results match these filters"
          description="Your search found parts, but none match the current manufacturer, category or availability filters."
          action={
            <Button variant="secondary" onClick={() => setFilters(emptyFilters)}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <ul className="space-y-4">
          {visible.map((part) => (
            <li key={part.id}>
              <PartCard part={part} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
