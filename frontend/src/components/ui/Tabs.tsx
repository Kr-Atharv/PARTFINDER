import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TabDef<Id extends string> {
  id: Id
  label: ReactNode
}

export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`
export const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`

interface TabsProps<Id extends string> {
  /** Unique per page; used to link tabs to their panels. */
  idPrefix: string
  label: string
  tabs: Array<TabDef<Id>>
  value: Id
  onChange: (id: Id) => void
  className?: string
}

/**
 * Accessible tab list (WAI-ARIA tabs pattern with automatic activation): Left/Right/Home/End
 * move between tabs. The caller renders the panels with `role="tabpanel"`, `id={panelId(...)}`
 * and `aria-labelledby={tabId(...)}`, and may keep inactive panels mounted with `hidden`.
 */
export function Tabs<Id extends string>({ idPrefix, label, tabs, value, onChange, className }: TabsProps<Id>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === value)
    let next = -1
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    if (next < 0) return
    event.preventDefault()
    onChange(tabs[next].id)
    refs.current[tabs[next].id]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={cn('flex gap-1 border-b border-line', className)}>
      {tabs.map((tab) => {
        const selected = tab.id === value
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[tab.id] = el
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.id)}
            aria-selected={selected}
            aria-controls={panelId(idPrefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              '-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              selected ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-600 hover:text-ink-900',
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
