import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  hint?: string
  icon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, icon, className, id, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hintId = hint ? `${inputId}-hint` : undefined

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink-800">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-400">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-describedby={hintId}
          className={cn(
            'h-10 w-full rounded-md border border-line-strong bg-white px-3 text-sm text-ink-900',
            'placeholder:text-ink-400 focus:border-brand-500',
            'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-500',
            Boolean(icon) && 'pl-10',
          )}
          {...rest}
        />
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-ink-500">
          {hint}
        </p>
      )}
    </div>
  )
})
