import { CircleAlert, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type AlertTone = 'info' | 'warning' | 'error'

interface AlertProps {
  tone?: AlertTone
  title?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}

const tones = {
  info: { wrap: 'border-sky-200 bg-sky-50 text-sky-900', icon: Info, iconColor: 'text-sky-600' },
  warning: {
    wrap: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: TriangleAlert,
    iconColor: 'text-amber-600',
  },
  error: { wrap: 'border-red-200 bg-red-50 text-red-900', icon: CircleAlert, iconColor: 'text-red-600' },
} as const

export function Alert({ tone = 'info', title, action, className, children }: AlertProps) {
  const { wrap, icon: Icon, iconColor } = tones[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'note'}
      className={cn('flex gap-3 rounded-lg border p-4 text-sm', wrap, className)}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconColor)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className={cn('leading-relaxed', title && 'mt-0.5')}>{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
