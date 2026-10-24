import { GitCompareArrows, Search, Trash2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeading } from '@/components/ui/PageHeading'
import { useCompare } from '@/context/CompareContext'
import { domainById } from '@/data/domains'

export default function ComparePartsPage() {
  const { items, count, max, remove, clear } = useCompare()

  return (
    <div className="space-y-6">
      <PageHeading
        title="Compare Parts"
        description="Line up candidate parts side by side on their extracted specifications."
        actions={
          count > 0 ? (
            <Button
              variant="secondary"
              icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              onClick={clear}
            >
              Clear selection
            </Button>
          ) : undefined
        }
      />

      {count === 0 ? (
        <EmptyState
          icon={GitCompareArrows}
          title="No parts selected for comparison"
          description="Use Add to comparison on a search result or part page. Your selection is kept while you move between pages."
          action={
            <Button to="/find" icon={<Search className="h-4 w-4" aria-hidden="true" />}>
              Go to Find Parts
            </Button>
          }
        />
      ) : (
        <>
          <Alert tone="info" title="Side-by-side comparison is not built yet">
            This page lists the parts you have selected. The detailed comparison and compatibility
            evidence are not implemented yet.
          </Alert>

          <section aria-label="Selected parts" className="space-y-3">
            <p className="text-sm text-ink-600" aria-live="polite">
              {count} of {max} parts selected
            </p>
            <ul className="space-y-3">
              {items.map((part) => (
                <li key={part.id}>
                  <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="brand">{domainById[part.domain].label}</Badge>
                        <Badge>{part.category}</Badge>
                        {part.isDemo && <Badge tone="warning">Demo data</Badge>}
                      </div>
                      <p className="mt-2 font-semibold text-ink-900">
                        <Link to={`/find/${part.id}`} className="hover:text-brand-700">
                          {part.name}
                        </Link>
                      </p>
                      <p className="text-sm text-ink-500">
                        <span className="font-mono text-ink-700">{part.partNumber}</span>
                        <span aria-hidden="true"> · </span>
                        {part.manufacturer}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<X className="h-4 w-4" aria-hidden="true" />}
                      onClick={() => remove(part.id)}
                      aria-label={`Remove ${part.name} from comparison`}
                    >
                      Remove
                    </Button>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
