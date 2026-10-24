import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LinkProps } from 'react-router-dom'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'selected'
type Size = 'sm' | 'md' | 'lg'

interface BaseProps {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  iconRight?: ReactNode
  /** Shows a spinner and disables the button. Ignored for link buttons. */
  loading?: boolean
  className?: string
  children: ReactNode
}

type ButtonAsButton = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> & { to?: undefined }

type ButtonAsLink = BaseProps & Omit<LinkProps, keyof BaseProps | 'to'> & { to: string }

export type ButtonProps = ButtonAsButton | ButtonAsLink

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white shadow-card hover:bg-brand-700 active:bg-brand-700 disabled:bg-ink-400',
  secondary:
    'border border-line-strong bg-white text-ink-800 shadow-card hover:bg-surface-muted disabled:text-ink-400',
  ghost: 'text-ink-600 hover:bg-surface-subtle hover:text-ink-900 disabled:text-ink-400',
  selected:
    'border border-brand-500 bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:text-ink-400',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-6 text-base',
}

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors',
    'disabled:cursor-not-allowed',
    variants[variant],
    sizes[size],
    className,
  )
}

export function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    size = 'md',
    icon,
    iconRight,
    loading = false,
    className,
    children,
  } = props
  const classes = buttonClasses(variant, size, className)
  const content = (
    <>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
      {iconRight}
    </>
  )

  if (props.to !== undefined) {
    const {
      to,
      variant: _v,
      size: _s,
      icon: _i,
      iconRight: _ir,
      loading: _l,
      className: _c,
      children: _ch,
      ...linkRest
    } = props
    return (
      <Link to={to} className={classes} {...linkRest}>
        {content}
      </Link>
    )
  }

  const {
    to: _to,
    variant: _v,
    size: _s,
    icon: _i,
    iconRight: _ir,
    loading: _l,
    className: _c,
    children: _ch,
    type = 'button',
    disabled,
    ...buttonRest
  } = props
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...buttonRest}
    >
      {content}
    </button>
  )
}
