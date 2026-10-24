import { Minus, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { useCompare } from '@/context/CompareContext'
import { useToast } from '@/context/ToastContext'
import { cn } from '@/lib/cn'
import type { Part } from '@/types'

interface CompareButtonProps {
  part: Part
  size?: 'sm' | 'md'
  className?: string
}

/** Adds or removes a part from the comparison selection and says what happened. */
export function CompareButton({ part, size = 'sm', className }: CompareButtonProps) {
  const { has, toggle, isFull, max, count } = useCompare()
  const { notify } = useToast()
  const navigate = useNavigate()
  const selected = has(part.id)
  const blocked = !selected && isFull
  const tip = blocked
    ? `You can compare up to ${max} parts. Remove one first.`
    : selected
      ? 'Remove this part from the comparison'
      : 'Add this part to the side-by-side comparison'

  const onClick = () => {
    if (blocked) {
      notify({ tone: 'warning', title: `Comparison is full (${max} parts)`, description: 'Remove a part before adding another.' })
      return
    }
    toggle(part)
    if (selected) {
      notify({ tone: 'info', title: 'Removed from comparison', duration: 2500 })
    } else {
      notify({
        tone: 'success',
        title: 'Added to comparison',
        description: `${part.name} (${count + 1} of ${max}).`,
        duration: 3500,
        action: count + 1 >= 2 ? { label: 'Compare now', onClick: () => navigate('/compare') } : undefined,
      })
    }
  }

  // aria-disabled (not `disabled`) keeps the button focusable so keyboard users can read the tooltip.
  return (
    <Tooltip content={tip}>
      <Button
        variant={selected ? 'selected' : 'secondary'}
        size={size}
        className={cn(blocked && 'cursor-not-allowed opacity-60', className)}
        icon={selected ? <Minus className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
        onClick={onClick}
        aria-pressed={selected}
        aria-disabled={blocked || undefined}
      >
        {selected ? 'Remove from comparison' : 'Add to comparison'}
      </Button>
    </Tooltip>
  )
}
