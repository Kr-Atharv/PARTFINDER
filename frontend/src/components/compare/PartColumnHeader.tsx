import { X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { domainById } from '@/data/domains'
import { usePartDrawer } from '@/context/PartDrawerContext'
import type { Part } from '@/types'

interface PartColumnHeaderProps {
  part: Part
  onRemove: (partId: string) => void
}

/** Identifying information and remove control for one selected part. */
export function PartColumnHeader({ part, onRemove }: PartColumnHeaderProps) {
  const drawer = usePartDrawer()
  return (
    <div className="space-y-2 font-normal">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="brand">{domainById[part.domain].label}</Badge>
        {part.isDemo && <Badge tone="warning">Demo data</Badge>}
        {part.origin === 'research' && <Badge tone="info">Web research</Badge>}
      </div>
      <div>
        <button
          type="button"
          onClick={() => drawer.open(part)}
          className="text-left font-semibold text-ink-900 hover:text-brand-700 hover:underline"
          aria-label={`Open details for ${part.name}`}
        >
          {part.name}
        </button>
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
