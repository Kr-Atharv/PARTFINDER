import { History, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeading } from '@/components/ui/PageHeading'

export default function SearchHistoryPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Search History"
        description="Review and reopen your previous part searches."
      />
      <EmptyState
        icon={History}
        title="No search history yet"
        description="Searches you run will be listed here. History is not stored or implemented yet."
        action={
          <Button to="/find" icon={<Search className="h-4 w-4" aria-hidden="true" />}>
            Find a Part
          </Button>
        }
      />
    </div>
  )
}
