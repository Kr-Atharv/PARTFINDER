import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useCompare } from '@/context/CompareContext'

/** Persistent summary of the comparison selection, shown on every page except Compare. */
export function CompareTray() {
  const { items, count, max, isFull, clear } = useCompare()

  return (
    <div
      role="region"
      aria-label="Comparison selection"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-4 py-3 shadow-pop sm:px-6 lg:left-64 lg:px-8"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-900">
            {count} of {max} parts selected for comparison
          </p>
          <p className="truncate text-xs text-ink-500">
            <span className="font-mono">{items.map((item) => item.partNumber).join(' · ')}</span>
            {isFull && ' · Limit reached'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clear}>
            Clear
          </Button>
          <Button
            to="/compare"
            size="sm"
            iconRight={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
          >
            Review
          </Button>
        </div>
      </div>
    </div>
  )
}
