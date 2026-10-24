import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Part } from '@/types'

export const MAX_COMPARE_ITEMS = 4

interface CompareContextValue {
  items: Part[]
  count: number
  max: number
  isFull: boolean
  has: (partId: string) => boolean
  toggle: (part: Part) => void
  remove: (partId: string) => void
  clear: () => void
}

const CompareContext = createContext<CompareContextValue | null>(null)

/**
 * Holds the parts selected for comparison. Stored in memory (React state) so
 * the selection survives navigation between pages; it resets on a full reload.
 */
export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Part[]>([])

  const has = useCallback((partId: string) => items.some((p) => p.id === partId), [items])

  const toggle = useCallback((part: Part) => {
    setItems((prev) => {
      if (prev.some((p) => p.id === part.id)) return prev.filter((p) => p.id !== part.id)
      if (prev.length >= MAX_COMPARE_ITEMS) return prev
      return [...prev, part]
    })
  }, [])

  const remove = useCallback((partId: string) => {
    setItems((prev) => prev.filter((p) => p.id !== partId))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const value = useMemo<CompareContextValue>(
    () => ({
      items,
      count: items.length,
      max: MAX_COMPARE_ITEMS,
      isFull: items.length >= MAX_COMPARE_ITEMS,
      has,
      toggle,
      remove,
      clear,
    }),
    [items, has, toggle, remove, clear],
  )

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
}

export function useCompare(): CompareContextValue {
  const context = useContext(CompareContext)
  if (!context) throw new Error('useCompare must be used inside <CompareProvider>')
  return context
}
