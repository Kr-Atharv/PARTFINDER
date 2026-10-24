import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Part } from '@/types'

export const MAX_COMPARE_ITEMS = 4
const STORAGE_KEY = 'partfinder_compare_items'

function loadInitialItems(): Part[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.slice(0, MAX_COMPARE_ITEMS)
    }
  } catch {
    // ignore
  }
  return []
}

interface CompareContextValue {
  items: Part[]
  count: number
  max: number
  isFull: boolean
  has: (partId: string) => boolean
  toggle: (part: Part) => void
  remove: (partId: string) => void
  clear: () => void
  /** Replaces the whole selection (used to reopen a past comparison). */
  replace: (parts: Part[]) => void
}

const CompareContext = createContext<CompareContextValue | null>(null)

export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Part[]>(loadInitialItems)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // ignore
    }
  }, [items])

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

  const clear = useCallback(() => {
    setItems([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  const replace = useCallback((parts: Part[]) => {
    setItems(parts.slice(0, MAX_COMPARE_ITEMS))
  }, [])

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
      replace,
    }),
    [items, has, toggle, remove, clear, replace],
  )

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
}

export function useCompare(): CompareContextValue {
  const context = useContext(CompareContext)
  if (!context) throw new Error('useCompare must be used inside <CompareProvider>')
  return context
}
