import { cloneElement, isValidElement, useEffect, useId, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface TooltipProps {
  content: ReactNode
  /** A single focusable element (button, link, input) or any element given tabIndex. */
  children: ReactElement
  side?: 'top' | 'bottom'
  className?: string
}

/**
 * Hover/focus tooltip. The text is linked to the trigger with aria-describedby, closes
 * with Escape, and never holds information that is not available elsewhere
 * (important content stays in the page, tooltips only explain).
 */
export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const id = useId()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!isValidElement(children)) return children
  const existing = (children.props as { 'aria-describedby'?: string })['aria-describedby']
  const trigger = cloneElement(children as ReactElement<Record<string, unknown>>, {
    'aria-describedby': [existing, open ? id : undefined].filter(Boolean).join(' ') || undefined,
  })

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {trigger}
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute left-1/2 z-50 w-max max-w-[16rem] -translate-x-1/2 animate-fade-in rounded-md bg-ink-900 px-2.5 py-1.5 text-xs font-medium leading-snug text-surface shadow-pop',
            side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
        >
          {content}
        </span>
      )}
    </span>
  )
}
