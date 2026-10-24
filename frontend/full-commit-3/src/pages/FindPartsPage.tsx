import { useSearchParams } from 'react-router-dom'
import { Search, Settings2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { PageHeading } from '@/components/ui/PageHeading'
import { domains, isDomainId } from '@/data/domains'
import { cn } from '@/lib/cn'

export default function FindPartsPage() {
  const [params, setParams] = useSearchParams()
  const domainParam = params.get('domain')
  const activeDomain = isDomainId(domainParam) ? domainParam : null
  const query = params.get('q') ?? ''

  const selectDomain = (id: string) => {
    const next = new URLSearchParams(params)
    if (activeDomain === id) next.delete('domain')
    else next.set('domain', id)
    setParams(next, { replace: true })
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Find Parts"
        description="Search for a part across industrial, electronics and automotive sources."
        actions={<Badge tone="warning">Search not connected</Badge>}
      />

      <Card>
        <div role="group" aria-label="Domain" className="flex flex-wrap gap-2">
          {domains.map(({ id, label, icon: Icon }) => {
            const selected = activeDomain === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectDomain(id)}
                aria-pressed={selected}
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors',
                  selected
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-line-strong bg-white text-ink-600 hover:bg-surface-muted',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            className="flex-1"
            label="Part name or number"
            placeholder="e.g. part number, description or specification"
            icon={<Search className="h-4 w-4" aria-hidden="true" />}
            defaultValue={query}
            disabled
            hint="Part search is disabled until the search workflow is built."
          />
          <Button disabled icon={<Search className="h-4 w-4" aria-hidden="true" />}>
            Search
          </Button>
        </div>
      </Card>

      <EmptyState
        icon={Settings2}
        title="Part search is not available yet"
        description="This page is a placeholder. Search, filtering and results will be added in the next stage of development. No requests are made to any backend."
      />
    </div>
  )
}
