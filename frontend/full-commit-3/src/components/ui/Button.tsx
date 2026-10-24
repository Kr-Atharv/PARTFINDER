import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LinkProps } from 'react-router-dom'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface BaseProps {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  iconRight?: ReactNode
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
  const { variant = 'primary', size = 'md', icon, iconRight, className, children } = props
  const classes = buttonClasses(variant, size, className)
  const content = (
    <>
      {icon}
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
    className: _c,
    children: _ch,
    type = 'button',
    ...buttonRest
  } = props
  return (
    <button type={type} className={classes} {...buttonRest}>
      {content}
    </button>
  )
}
