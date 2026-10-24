import { cn } from '@/lib/cn'

/** Pulsing placeholder block. Purely visual; wrap groups in an element with aria-busy. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded bg-surface-subtle motion-reduce:animate-none', className)}
    />
  )
}

/** Placeholder with the same footprint as a PartCard. */
export function PartCardSkeleton() {
  return (
    <div className="rounded-lg border border-line bg-surface p-5 shadow-card" aria-hidden="true">
      <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
          </div>
          <Skeleton className="h-3 w-1/2" />
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:w-56 lg:flex-col">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      </div>
    </div>
  )
}

export function PartListSkeleton({ count = 4, label = 'Loading results' }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-4">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <PartCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-2 p-5">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9" />
      ))}
    </div>
  )
}
