import { Badge } from '@/components/ui/Badge'
import type { BadgeTone } from '@/components/ui/Badge'
import type { Availability } from '@/types'

export const availabilityMeta: Record<Availability, { label: string; tone: BadgeTone }> = {
  in_stock: { label: 'In stock', tone: 'success' },
  limited: { label: 'Limited stock', tone: 'warning' },
  out_of_stock: { label: 'Out of stock', tone: 'danger' },
  unknown: { label: 'Availability unknown', tone: 'neutral' },
}

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  const { label, tone } = availabilityMeta[availability]
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  )
}
