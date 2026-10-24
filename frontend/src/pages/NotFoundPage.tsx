import { LayoutDashboard, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={SearchX}
      title="Page not found"
      description="The page you are looking for does not exist or has moved."
      action={
        <Button to="/" icon={<LayoutDashboard className="h-4 w-4" aria-hidden="true" />}>
          Back to Overview
        </Button>
      }
    />
  )
}
