import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { PartDrawer } from '@/components/parts/PartDrawer'
import { userData } from '@/state/userData'
import type { Part } from '@/types'

interface PartDrawerContextValue {
  open: (part: Part) => void
  close: () => void
  part: Part | null
}

const PartDrawerContext = createContext<PartDrawerContextValue | null>(null)

/** One global "quick view" drawer, opened from cards, the compare table, saved parts and the dashboard. */
export function PartDrawerProvider({ children }: { children: ReactNode }) {
  const [part, setPart] = useState<Part | null>(null)

  const open = useCallback((next: Part) => {
    userData.recordView(next)
    setPart(next)
  }, [])
  const close = useCallback(() => setPart(null), [])

  const value = useMemo(() => ({ open, close, part }), [open, close, part])
  return (
    <PartDrawerContext.Provider value={value}>
      {children}
      <PartDrawer part={part} onClose={close} />
    </PartDrawerContext.Provider>
  )
}

export function usePartDrawer(): PartDrawerContextValue {
  const ctx = useContext(PartDrawerContext)
  if (!ctx) throw new Error('usePartDrawer must be used inside <PartDrawerProvider>')
  return ctx
}
