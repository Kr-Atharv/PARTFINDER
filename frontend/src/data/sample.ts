import { FileText, GitCompareArrows, Search, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { RecentSearch, WorkflowStep } from '@/types'

export interface WorkflowStepWithIcon extends WorkflowStep {
  icon: LucideIcon
}

export const workflowSteps: WorkflowStepWithIcon[] = [
  {
    id: 'discover',
    title: 'Discover',
    description: 'Search supplier and catalogue sources across the web for matching parts.',
    icon: Search,
  },
  {
    id: 'extract',
    title: 'Extract Specifications',
    description: 'Pull dimensions, ratings and part numbers into a consistent structure.',
    icon: FileText,
  },
  {
    id: 'compare',
    title: 'Compare',
    description: 'Line up candidate parts side by side against the specs that matter.',
    icon: GitCompareArrows,
  },
  {
    id: 'verify',
    title: 'Verify',
    description: 'Check compatibility against your machine, board or vehicle before you buy.',
    icon: ShieldCheck,
  },
]

/**
 * Illustrative sample data only. These are not real searches and no backend
 * is connected. Replace with real history once persistence exists.
 */
export const sampleRecentSearches: RecentSearch[] = [
  {
    id: 'sample-1',
    query: 'Hydraulic seal kit 80 mm',
    domain: 'industrial',
    status: 'completed',
    when: 'Sample',
  },
  {
    id: 'sample-2',
    query: '3.3 V voltage regulator SOT-223',
    domain: 'electronics',
    status: 'in_progress',
    when: 'Sample',
  },
  {
    id: 'sample-3',
    query: 'Front brake pad ceramic',
    domain: 'automotive',
    status: 'needs_review',
    when: 'Sample',
  },
]
