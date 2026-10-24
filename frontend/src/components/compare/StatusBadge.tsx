import { CircleCheck, CircleHelp, CircleX } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { BadgeTone } from '@/components/ui/Badge'
import type { CompatibilityStatus } from '@/types/compatibility'

const meta: Record<
  CompatibilityStatus,
  { overall: string; field: string; tone: BadgeTone; icon: typeof CircleCheck; iconClass: string }
> = {
  potential_match: { overall: 'Potential Match', field: 'Match', tone: 'success', icon: CircleCheck, iconClass: 'text-emerald-600' },
  mismatch: { overall: 'Mismatch', field: 'Mismatch', tone: 'danger', icon: CircleX, iconClass: 'text-red-600' },
  unverified: { overall: 'Unverified', field: 'Unverified', tone: 'warning', icon: CircleHelp, iconClass: 'text-amber-600' },
}

export function statusLabel(status: CompatibilityStatus, variant: 'overall' | 'field' = 'overall') {
  return meta[status][variant]
}

interface StatusBadgeProps {
  status: CompatibilityStatus
  /** "overall" for a part's status, "field" for a single specification. */
  variant?: 'overall' | 'field'
}

/** Status shown with an icon and text, never colour alone. */
export function StatusBadge({ status, variant = 'overall' }: StatusBadgeProps) {
  const { tone, icon: Icon, iconClass } = meta[status]
  return (
    <Badge tone={tone}>
      <Icon className={`h-3.5 w-3.5 ${iconClass}`} aria-hidden="true" />
      {statusLabel(status, variant)}
    </Badge>
  )
}
