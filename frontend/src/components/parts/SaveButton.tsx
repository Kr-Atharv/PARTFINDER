import { Bookmark, BookmarkCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/context/ToastContext'
import { userData, useIsSaved } from '@/state/userData'
import type { Part } from '@/types'

/** Saves or unsaves a part on this device. */
export function SaveButton({ part, size = 'sm' }: { part: Part; size?: 'sm' | 'md' }) {
  const saved = useIsSaved(part.id)
  const { notify } = useToast()
  const onClick = () => {
    const nowSaved = userData.toggleSaved(part)
    notify({
      tone: 'success',
      title: nowSaved ? 'Part saved' : 'Removed from saved parts',
      description: nowSaved ? `${part.name} is saved on this device.` : undefined,
    })
  }
  return (
    <Tooltip content={saved ? 'Remove from saved parts' : 'Save this part on this device'}>
      <Button
        variant={saved ? 'selected' : 'secondary'}
        size={size}
        onClick={onClick}
        aria-pressed={saved}
        icon={saved ? <BookmarkCheck className="h-4 w-4" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}
      >
        {saved ? 'Saved' : 'Save'}
      </Button>
    </Tooltip>
  )
}
