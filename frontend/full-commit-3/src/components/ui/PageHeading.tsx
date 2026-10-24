import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface PageHeadingProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeading({ title, description, actions, className }: PageHeadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
