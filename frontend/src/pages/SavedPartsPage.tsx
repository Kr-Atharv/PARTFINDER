import { Bookmark, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PartCard } from '@/components/parts/PartCard'
import { Button } from '@/components/ui/Button'
import { ConfirmButton } from '@/components/ui/ConfirmButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { PageHeading } from '@/components/ui/PageHeading'
import { Pagination } from '@/components/ui/Pagination'
import { Select } from '@/components/ui/Select'
import { domains } from '@/data/domains'
import { timeAgo } from '@/lib/format'
import { filterSaved, pageOf, sortSaved } from '@/lib/history'
import type { SavedSort } from '@/lib/history'
import { DEVICE_ONLY_NOTE, userData, useSavedParts } from '@/state/userData'

const PAGE_SIZE = 10

export default function SavedPartsPage() {
  const saved = useSavedParts()
  const [text, setText] = useState('')
  const [domain, setDomain] = useState('')
  const [sort, setSort] = useState<SavedSort>('recent')
  const [page, setPage] = useState(1)

  useEffect(() => setPage(1), [text, domain, sort])

  const shown = useMemo(() => sortSaved(filterSaved(saved, { text, domain }), sort), [saved, text, domain, sort])
  const current = pageOf(shown, page, PAGE_SIZE)

  return (
    <div className="space-y-6">
      <PageHeading
        title="Saved Parts"
        description="Parts you saved for later. Each one is kept exactly as it was when you saved it."
        actions={
          <ConfirmButton
            label="Clear saved parts"
            confirmLabel="Remove all saved parts?"
            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
            disabled={saved.length === 0}
            onConfirm={userData.clearSaved}
          />
        }
      />
      <p className="text-sm text-ink-500">{DEVICE_ONLY_NOTE}</p>

      {saved.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved parts yet"
          description="Choose Save on a search result, a part page or the quick view and it will be listed here."
          action={
            <Button to="/find" icon={<Search className="h-4 w-4" aria-hidden="true" />}>
              Find a Part
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="Filter saved parts" type="search" value={text} onChange={(event) => setText(event.target.value)} placeholder="Name, part number, manufacturer…" />
            <Select
              label="Domain"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              options={[{ value: '', label: 'All domains' }, ...domains.map((d) => ({ value: d.id, label: d.label }))]}
            />
            <Select
              label="Sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as SavedSort)}
              options={[
                { value: 'recent', label: 'Recently saved' },
                { value: 'name', label: 'Name A–Z' },
                { value: 'manufacturer', label: 'Manufacturer A–Z' },
              ]}
            />
          </div>

          <p className="text-sm text-ink-500" aria-live="polite">
            {shown.length === saved.length ? `${saved.length} saved ${saved.length === 1 ? 'part' : 'parts'}` : `${shown.length} of ${saved.length} match the filter`}
          </p>

          {shown.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              title="No saved part matches"
              description="Try a different filter."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setText('')
                    setDomain('')
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <ul className="space-y-4">
              {current.items.map((entry) => (
                <li key={entry.part.id}>
                  <p className="mb-1 text-xs text-ink-500">Saved {timeAgo(entry.savedAt)}</p>
                  <PartCard part={entry.part} />
                </li>
              ))}
            </ul>
          )}
          <Pagination page={current.page} totalPages={current.totalPages} onPage={setPage} label="Saved parts pages" />
        </>
      )}
    </div>
  )
}
