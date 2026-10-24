import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

interface PaginationProps {
  page: number
  totalPages: number
  onPage: (page: number) => void
  label?: string
  className?: string
}

/** Page numbers with ellipses: 1 … 4 5 [6] 7 8 … 20 */
export function pageWindow(page: number, totalPages: number): Array<number | 'gap'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((n) => pages.add(n))
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((n) => pages.add(n))
  const sorted = Array.from(pages)
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b)
  const out: Array<number | 'gap'> = []
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push('gap')
    out.push(n)
  })
  return out
}

const item =
  'inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-md border px-2 text-sm font-medium transition-colors'

export function Pagination({ page, totalPages, onPage, label = 'Pagination', className }: PaginationProps) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label={label} className={cn('flex flex-wrap items-center justify-center gap-1.5', className)}>
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className={cn(item, 'border-line-strong bg-surface text-ink-700 hover:bg-surface-muted disabled:cursor-not-allowed disabled:text-ink-400')}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      {pageWindow(page, totalPages).map((entry, index) =>
        entry === 'gap' ? (
          <span key={`gap-${index}`} className="px-1 text-ink-400" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onPage(entry)}
            aria-current={entry === page ? 'page' : undefined}
            aria-label={`Page ${entry}${entry === page ? ', current page' : ''}`}
            className={cn(
              item,
              entry === page
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-line-strong bg-surface text-ink-700 hover:bg-surface-muted',
            )}
          >
            {entry}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className={cn(item, 'border-line-strong bg-surface text-ink-700 hover:bg-surface-muted disabled:cursor-not-allowed disabled:text-ink-400')}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  )
}
