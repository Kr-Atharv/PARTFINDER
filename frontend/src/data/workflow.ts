import { FileText, GitCompareArrows, Search, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { WorkflowStep } from '@/types'

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
