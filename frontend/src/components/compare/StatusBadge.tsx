import { CircleCheck, CircleHelp, CircleX } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { BadgeTone } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'
import type { CompatibilityStatus } from '@/types/compatibility'

const meta: Record<
  CompatibilityStatus,
  { label: string; help: string; tone: BadgeTone; icon: typeof CircleCheck; iconClass: string }
> = {
  potential_match: {
    label: 'PASS',
    help: 'Every requirement you entered is met by a value recorded with a source. This is not an installation guarantee.',
    tone: 'success',
    icon: CircleCheck,
    iconClass: 'text-emerald-600',
  },
  mismatch: {
    label: 'MISMATCH',
    help: 'At least one requirement you entered is contradicted by the recorded value.',
    tone: 'danger',
    icon: CircleX,
    iconClass: 'text-red-600',
  },
  unverified: {
    label: 'UNVERIFIED',
    help: 'Nothing fails, but at least one value is missing, conflicting, unreadable or has no source URL. Missing data is never treated as a pass.',
    tone: 'warning',
    icon: CircleHelp,
    iconClass: 'text-amber-600',
  },
}

/** Plain-text label for a status (also used by screen-reader text and exports). */
export function statusLabel(status: CompatibilityStatus, _variant: 'overall' | 'field' = 'overall') {
  return meta[status].label
}

export function statusHelp(status: CompatibilityStatus) {
  return meta[status].help
}

interface StatusBadgeProps {
  status: CompatibilityStatus
  /** Kept for existing callers; PASS / MISMATCH / UNVERIFIED are the same for a part and a single field. */
  variant?: 'overall' | 'field'
}

/** Status shown with an icon and text, never colour alone, with a tooltip explaining what it means. */
export function StatusBadge({ status }: StatusBadgeProps) {
  const { tone, icon: Icon, iconClass, label, help } = meta[status]
  return (
    <Tooltip content={help} side="bottom">
      <span tabIndex={0} className="inline-flex rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
        <Badge tone={tone}>
          <Icon className={`h-3.5 w-3.5 ${iconClass}`} aria-hidden="true" />
          {label}
        </Badge>
      </span>
    </Tooltip>
  )
}
