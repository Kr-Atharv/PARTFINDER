import { GitCompareArrows, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeading } from '@/components/ui/PageHeading'

export default function ComparePartsPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Compare Parts"
        description="Line up candidate parts side by side on their extracted specifications."
      />
      <EmptyState
        icon={GitCompareArrows}
        title="No parts selected for comparison"
        description="Once part search is available, you will be able to add parts here and compare them. Comparison is not implemented yet."
        action={
          <Button to="/find" icon={<Search className="h-4 w-4" aria-hidden="true" />}>
            Go to Find Parts
          </Button>
        }
      />
    </div>
  )
}
