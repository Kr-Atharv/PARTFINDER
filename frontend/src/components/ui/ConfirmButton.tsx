import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

interface ConfirmButtonProps {
  /** Label of the first step, e.g. "Clear all". */
  label: string
  /** Question shown in the second step. */
  confirmLabel: string
  onConfirm: () => void
  icon?: ReactNode
  disabled?: boolean
}

/** Destructive action in two steps: the first click only asks, the second one does it. Escape or Cancel backs out. */
export function ConfirmButton({ label, confirmLabel, onConfirm, icon, disabled }: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (asking) confirmRef.current?.focus()
  }, [asking])

  if (!asking) {
    return (
      <Button variant="secondary" size="sm" icon={icon} onClick={() => setAsking(true)} disabled={disabled}>
        {label}
      </Button>
    )
  }
  return (
    <span
      role="group"
      aria-label={confirmLabel}
      className="inline-flex flex-wrap items-center gap-2"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setAsking(false)
      }}
    >
      <span className="text-sm font-medium text-ink-800">{confirmLabel}</span>
      <button
        ref={confirmRef}
        type="button"
        onClick={() => {
          setAsking(false)
          onConfirm()
        }}
        className="inline-flex h-8 items-center rounded-md bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700"
      >
        Yes, clear
      </button>
      <Button variant="secondary" size="sm" onClick={() => setAsking(false)}>
        Cancel
      </Button>
    </span>
  )
}
