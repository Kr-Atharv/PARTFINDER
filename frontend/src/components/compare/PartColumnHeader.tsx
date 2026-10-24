import { X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { domainById } from '@/data/domains'
import type { Part } from '@/types'

interface PartColumnHeaderProps {
  part: Part
  onRemove: (partId: string) => void
}

/** Identifying information and remove control for one selected part. */
export function PartColumnHeader({ part, onRemove }: PartColumnHeaderProps) {
  return (
    <div className="space-y-2 font-normal">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="brand">{domainById[part.domain].label}</Badge>
        {part.isDemo && <Badge tone="warning">Demo data</Badge>}
      </div>
      <div>
        <Link
          to={`/find/${part.id}`}
          state={{ from: '/compare' }}
          className="font-semibold text-ink-900 hover:text-brand-700"
        >
          {part.name}
        </Link>
        <p className="mt-0.5 font-mono text-xs text-ink-700">{part.partNumber}</p>
        <p className="text-xs text-ink-500">{part.manufacturer}</p>
        <p className="text-xs text-ink-500">{part.category}</p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        icon={<X className="h-4 w-4" aria-hidden="true" />}
        onClick={() => onRemove(part.id)}
        aria-label={`Remove ${part.name} from comparison`}
      >
        Remove
      </Button>
    </div>
  )
}
