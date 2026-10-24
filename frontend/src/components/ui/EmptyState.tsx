import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-lg border border-dashed border-line-strong bg-white px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-subtle text-ink-500">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-ink-900">{title}</h2>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
