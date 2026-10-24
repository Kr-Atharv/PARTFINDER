import { GitCompareArrows, History, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ComparisonRow, SearchRow } from '@/components/history/HistoryRows'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmButton } from '@/components/ui/ConfirmButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { PageHeading } from '@/components/ui/PageHeading'
import { Pagination } from '@/components/ui/Pagination'
import { Select } from '@/components/ui/Select'
import { Tabs, panelId, tabId } from '@/components/ui/Tabs'
import { filterComparisons, filterSearches, pageOf, sortComparisons, sortSearches } from '@/lib/history'
import type { HistorySort, KindFilter } from '@/lib/history'
import { DEVICE_ONLY_NOTE, userData, useComparisonHistory, useRecentSearches } from '@/state/userData'

type HistoryTab = 'searches' | 'comparisons'
const PAGE_SIZE = 10
const ID = 'history'

export default function SearchHistoryPage() {
  const searches = useRecentSearches()
  const comparisons = useComparisonHistory()
  const [tab, setTab] = useState<HistoryTab>('searches')
  const [text, setText] = useState('')
  const [sort, setSort] = useState<HistorySort>('newest')
  const [kind, setKind] = useState<KindFilter>('all')
  const [page, setPage] = useState(1)

  useEffect(() => setPage(1), [tab, text, sort, kind])

  const shownSearches = useMemo(
    () => sortSearches(filterSearches(searches, { text, kind }), sort),
    [searches, text, kind, sort],
  )
  const shownComparisons = useMemo(
    () => sortComparisons(filterComparisons(comparisons, text), sort === 'oldest' ? 'oldest' : 'newest'),
    [comparisons, text, sort],
  )
  const searchPage = pageOf(shownSearches, page, PAGE_SIZE)
  const comparisonPage = pageOf(shownComparisons, page, PAGE_SIZE)

  const isSearches = tab === 'searches'
  const total = isSearches ? searches.length : comparisons.length
  const shown = isSearches ? shownSearches.length : shownComparisons.length
  const current = isSearches ? searchPage : comparisonPage

  return (
    <div className="space-y-6">
      <PageHeading
        title="Search History"
        description="Reopen your previous searches and comparisons."
        actions={
          <ConfirmButton
            key={tab}
            label={isSearches ? 'Clear search history' : 'Clear comparison history'}
            confirmLabel={isSearches ? 'Clear all searches?' : 'Clear all comparisons?'}
            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
            disabled={total === 0}
            onConfirm={isSearches ? userData.clearSearches : userData.clearComparisons}
          />
        }
      />
      <p className="text-sm text-ink-500">{DEVICE_ONLY_NOTE}</p>

      <Tabs<HistoryTab>
        idPrefix={ID}
        label="History type"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'searches', label: `Searches (${searches.length})` },
          { id: 'comparisons', label: `Comparisons (${comparisons.length})` },
        ]}
      />

      <div role="tabpanel" id={panelId(ID, tab)} aria-labelledby={tabId(ID, tab)} className="space-y-4">
        {total === 0 ? (
          <EmptyState
            icon={isSearches ? History : GitCompareArrows}
            title={isSearches ? 'No search history yet' : 'No comparisons yet'}
            description={
              isSearches
                ? 'Searches you run on Find Parts are listed here, with the number of results each returned.'
                : 'A comparison is recorded after you keep two or more parts on the Compare page for a moment.'
            }
            action={
              <Button to={isSearches ? '/find' : '/compare'} icon={<Search className="h-4 w-4" aria-hidden="true" />}>
                {isSearches ? 'Find a Part' : 'Go to Compare'}
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label={isSearches ? 'Filter searches' : 'Filter by part'}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={isSearches ? 'Query, manufacturer, model…' : 'Part name, number, manufacturer…'}
                type="search"
              />
              {isSearches && (
                <Select
                  label="Type"
                  value={kind}
                  onChange={(event) => setKind(event.target.value as KindFilter)}
                  options={[
                    { value: 'all', label: 'All searches' },
                    { value: 'catalogue', label: 'Catalogue' },
                    { value: 'research', label: 'Live research' },
                  ]}
                />
              )}
              <Select
                label="Sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as HistorySort)}
                options={[
                  { value: 'newest', label: 'Newest first' },
                  { value: 'oldest', label: 'Oldest first' },
                  ...(isSearches ? [{ value: 'query', label: 'Query A–Z' }] : []),
                ]}
              />
            </div>

            <p className="text-sm text-ink-500" aria-live="polite">
              {shown === total ? `${total} ${isSearches ? 'searches' : 'comparisons'}` : `${shown} of ${total} match the filter`}
            </p>

            {shown === 0 ? (
              <EmptyState
                icon={History}
                title="Nothing matches"
                description="Try a different filter."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setText('')
                      setKind('all')
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <Card padded={false}>
                <ul className="divide-y divide-line">
                  {isSearches
                    ? searchPage.items.map((entry) => <SearchRow key={entry.id} entry={entry} removable />)
                    : comparisonPage.items.map((record) => <ComparisonRow key={record.id} record={record} removable />)}
                </ul>
              </Card>
            )}
            <Pagination page={current.page} totalPages={current.totalPages} onPage={setPage} label="History pages" />
            {!isSearches && (
              <p className="text-xs text-ink-500">
                Reopening restores the parts exactly as they were saved on this device; it does not re-fetch them.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
