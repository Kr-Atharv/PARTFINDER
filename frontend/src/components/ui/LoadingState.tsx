import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

interface LoadingStateProps {
  label?: string
  className?: string
}

export function LoadingState({ label = 'Loading…', className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex items-center justify-center gap-2 py-12 text-sm text-ink-500', className)}
    >
      <Loader2 className="h-4 w-4 animate-spin text-brand-600" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
