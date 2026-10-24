import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'info'

interface BadgeProps {
  tone?: BadgeTone
  /** Show a leading status dot. */
  dot?: boolean
  className?: string
  children: ReactNode
}

const tones: Record<BadgeTone, { wrap: string; dot: string }> = {
  neutral: { wrap: 'bg-surface-subtle text-ink-600 border-line', dot: 'bg-ink-400' },
  brand: { wrap: 'bg-brand-50 text-brand-700 border-brand-100', dot: 'bg-brand-500' },
  success: { wrap: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
  warning: { wrap: 'bg-amber-50 text-amber-800 border-amber-100', dot: 'bg-amber-500' },
  info: { wrap: 'bg-sky-50 text-sky-700 border-sky-100', dot: 'bg-sky-500' },
}

export function Badge({ tone = 'neutral', dot = false, className, children }: BadgeProps) {
  const t = tones[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-0.5 text-xs font-medium',
        t.wrap,
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} aria-hidden="true" />}
      {children}
    </span>
  )
}
