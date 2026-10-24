import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useCompare } from '@/context/CompareContext'
import type { Part } from '@/types'

interface CompareButtonProps {
  part: Part
  size?: 'sm' | 'md'
  className?: string
}

/** Adds or removes a part from the comparison selection. */
export function CompareButton({ part, size = 'sm', className }: CompareButtonProps) {
  const { has, toggle, isFull, max } = useCompare()
  const selected = has(part.id)
  const blocked = !selected && isFull

  return (
    <Button
      variant={selected ? 'selected' : 'secondary'}
      size={size}
      className={className}
      icon={
        selected ? (
          <Minus className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Plus className="h-4 w-4" aria-hidden="true" />
        )
      }
      onClick={() => toggle(part)}
      disabled={blocked}
      aria-pressed={selected}
      title={blocked ? `You can compare up to ${max} parts. Remove one first.` : undefined}
    >
      {selected ? 'Remove from comparison' : 'Add to comparison'}
    </Button>
  )
}
