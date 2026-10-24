import { FilterX, Info, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { availabilityMeta } from '@/components/parts/AvailabilityBadge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { SelectOption } from '@/components/ui/Select'
import { Tooltip } from '@/components/ui/Tooltip'
import { availabilityOrder, hasRefinements, PAGE_SIZES } from '@/lib/search'
import type { Loaded } from '@/services/catalogService'
import type { Facets, SearchPaging, SearchRefinements, SortKey } from '@/types'

export const SORT_OPTIONS: Array<SelectOption & { value: SortKey }> = [
  { value: 'name-asc', label: 'Part name (A to Z)' },
  { value: 'name-desc', label: 'Part name (Z to A)' },
  { value: 'manufacturer-asc', label: 'Manufacturer (A to Z)' },
  { value: 'manufacturer-desc', label: 'Manufacturer (Z to A)' },
]

export interface ActiveChip {
  key: string
  label: string
  clear: Partial<SearchRefinements>
}

/** One removable chip per active refinement. Exported for tests. */
export function activeChips(refinements: SearchRefinements): ActiveChip[] {
  const chips: ActiveChip[] = []
  if (refinements.category) chips.push({ key: 'category', label: `Category: ${refinements.category}`, clear: { category: '' } })
  if (refinements.availability) {
    chips.push({ key: 'availability', label: `Availability: ${availabilityMeta[refinements.availability].label}`, clear: { availability: '' } })
  }
  if (refinements.specLabel || refinements.specValue) {
    const label = [refinements.specLabel, refinements.specValue].filter(Boolean).join(' = ')
    chips.push({ key: 'spec', label: `Spec: ${label}`, clear: { specLabel: '', specValue: '' } })
  }
  return chips
}

interface FilterPanelProps {
  refinements: SearchRefinements
  paging: SearchPaging
  facets: Loaded<Facets> | null
  onRefinements: (next: SearchRefinements) => void
  onSort: (sort: SortKey) => void
  onPageSize: (size: number) => void
  onClear: () => void
}

export function FilterPanel({ refinements, paging, facets, onRefinements, onSort, onPageSize, onClear }: FilterPanelProps) {
  const panelId = useId()
  const specListId = useId()
  const [open, setOpen] = useState(false) // collapsed by default on small screens only
  const [specLabel, setSpecLabel] = useState(refinements.specLabel)
  const [specValue, setSpecValue] = useState(refinements.specValue)

  // Keep the text boxes in step with the URL (back/forward, chip removal).
  useEffect(() => setSpecLabel(refinements.specLabel), [refinements.specLabel])
  useEffect(() => setSpecValue(refinements.specValue), [refinements.specValue])

  const data = facets?.status === 'ok' ? facets.data : null
  const categoryOptions: SelectOption[] = [
    { value: '', label: 'All categories' },
    ...(data?.categories ?? []).map((c) => ({ value: c.value, label: `${c.value} (${c.count})` })),
  ]
  const availabilityOptions: SelectOption[] = [
    { value: '', label: 'Any availability' },
    ...availabilityOrder.map((a) => {
      const count = data?.availability.find((f) => f.value === a)?.count
      return { value: a, label: `${availabilityMeta[a].label}${count !== undefined ? ` (${count})` : ''}` }
    }),
  ]

  const chips = activeChips(refinements)
  const applySpec = (event?: FormEvent) => {
    event?.preventDefault()
    if (specLabel.trim() !== refinements.specLabel || specValue.trim() !== refinements.specValue) {
      onRefinements({ ...refinements, specLabel: specLabel.trim(), specValue: specValue.trim() })
    }
  }

  return (
    <Card aria-label="Filters and sorting">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex items-center gap-2 rounded-md text-sm font-semibold text-ink-900 lg:pointer-events-none"
        >
          <SlidersHorizontal className="h-4 w-4 text-ink-500" aria-hidden="true" />
          Filters &amp; sorting
          {chips.length > 0 && (
            <span className="rounded bg-brand-600 px-1.5 py-0.5 font-mono text-xs text-white" aria-label={`${chips.length} active`}>
              {chips.length}
            </span>
          )}
        </button>
        {(hasRefinements(refinements) || paging.sort !== 'name-asc') && (
          <Button variant="ghost" size="sm" icon={<FilterX className="h-4 w-4" aria-hidden="true" />} onClick={onClear}>
            Clear filters
          </Button>
        )}
      </div>

      {chips.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={() => onRefinements({ ...refinements, ...chip.clear })}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-500 bg-brand-50 py-1 pl-3 pr-2 text-xs font-medium text-brand-700 hover:bg-brand-100"
                aria-label={`Remove filter ${chip.label}`}
              >
                {chip.label}
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div id={panelId} className={open ? 'mt-4' : 'mt-4 hidden lg:block'}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data ? (
            <Select label="Category" value={refinements.category} options={categoryOptions} onChange={(e) => onRefinements({ ...refinements, category: e.target.value })} />
          ) : (
            <Input
              label="Category"
              value={refinements.category}
              placeholder="e.g. Seals"
              onChange={(e) => onRefinements({ ...refinements, category: e.target.value })}
              hint={facets?.status === 'unavailable' ? 'Category list unavailable; type to filter.' : undefined}
            />
          )}
          <Select
            label="Availability"
            value={refinements.availability}
            options={availabilityOptions}
            onChange={(e) => onRefinements({ ...refinements, availability: e.target.value as SearchRefinements['availability'] })}
          />
          <Select label="Sort by" value={paging.sort} options={SORT_OPTIONS} onChange={(e) => onSort(e.target.value as SortKey)} />
          <Select
            label="Results per page"
            value={String(paging.pageSize)}
            options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
            onChange={(e) => onPageSize(Number(e.target.value))}
          />
        </div>

        <form onSubmit={applySpec} className="mt-4 grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]" aria-label="Specification filter">
          <Input
            label="Specification"
            value={specLabel}
            onChange={(e) => setSpecLabel(e.target.value)}
            placeholder="e.g. Max pressure"
            list={data && data.specLabels.length > 0 ? specListId : undefined}
            autoComplete="off"
            maxLength={80}
          />
          {data && data.specLabels.length > 0 && (
            <datalist id={specListId}>
              {data.specLabels.slice(0, 300).map((s) => (
                <option key={s.value} value={s.value} />
              ))}
            </datalist>
          )}
          <Input
            label="Value contains"
            value={specValue}
            onChange={(e) => setSpecValue(e.target.value)}
            placeholder="e.g. 250"
            autoComplete="off"
            maxLength={80}
          />
          <Button type="submit" variant="secondary">
            Apply
          </Button>
        </form>

        <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <Tooltip content="The catalogue stores no prices, so price cannot be filtered here. Prices appear only on live supplier research results.">
              <span tabIndex={0} className="font-medium text-ink-700 underline decoration-dotted">
                Price filter
              </span>
            </Tooltip>{' '}
            is available on the Live supplier research tab only. Specification filters match the text of the recorded value, not units.
          </span>
        </p>
      </div>
    </Card>
  )
}
