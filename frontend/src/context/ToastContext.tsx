import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type ToastTone = 'success' | 'info' | 'warning' | 'error'

export interface ToastInput {
  tone?: ToastTone
  title: string
  description?: string
  /** Optional single action, e.g. Undo or Retry. */
  action?: { label: string; onClick: () => void }
  /** Milliseconds. Errors default to a longer time; 0 keeps the toast until dismissed. */
  duration?: number
}

interface ToastItem extends ToastInput {
  id: number
  tone: ToastTone
}

interface ToastContextValue {
  notify: (toast: ToastInput) => number
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toneMeta = {
  success: { icon: CircleCheck, color: 'text-emerald-600', ring: 'border-emerald-100' },
  info: { icon: Info, color: 'text-sky-600', ring: 'border-sky-100' },
  warning: { icon: TriangleAlert, color: 'text-amber-600', ring: 'border-amber-100' },
  error: { icon: CircleAlert, color: 'text-red-600', ring: 'border-red-100' },
} as const

const MAX_VISIBLE = 4

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const { icon: Icon, color, ring } = toneMeta[toast.tone]
  const [paused, setPaused] = useState(false)
  const duration = toast.duration ?? (toast.tone === 'error' ? 8000 : 4500)

  useEffect(() => {
    if (paused || duration === 0) return
    const timer = window.setTimeout(() => onDismiss(toast.id), duration)
    return () => window.clearTimeout(timer)
  }, [paused, duration, toast.id, onDismiss])

  return (
    <li
      className={cn(
        'pointer-events-auto flex w-full animate-slide-up items-start gap-3 rounded-lg border bg-surface p-3.5 shadow-pop',
        ring,
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', color)} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-ink-900">{toast.title}</p>
        {toast.description && <p className="mt-0.5 leading-relaxed text-ink-600">{toast.description}</p>}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick()
              onDismiss(toast.id)
            }}
            className="mt-1.5 rounded text-sm font-medium text-brand-700 hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="rounded p-1 text-ink-400 hover:bg-surface-subtle hover:text-ink-900"
        aria-label={`Dismiss notification: ${toast.title}`}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback((input: ToastInput) => {
    const id = nextId.current++
    const item: ToastItem = { ...input, id, tone: input.tone ?? 'info' }
    setToasts((prev) => [...prev.filter((t) => !(t.title === item.title && t.description === item.description)), item].slice(-MAX_VISIBLE))
    return id
  }, [])

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss])
  const errors = toasts.filter((t) => t.tone === 'error' || t.tone === 'warning')
  const others = toasts.filter((t) => t.tone !== 'error' && t.tone !== 'warning')

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4 sm:justify-end sm:px-6 sm:pb-6">
        <div className="w-full max-w-sm space-y-2">
          {/* Errors are announced assertively, everything else politely. */}
          <ul role="alert" aria-live="assertive" className="space-y-2">
            {errors.map((toast) => (
              <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
            ))}
          </ul>
          <ul role="status" aria-live="polite" className="space-y-2">
            {others.map((toast) => (
              <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
            ))}
          </ul>
        </div>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
