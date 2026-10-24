export type DomainId = 'industrial' | 'electronics' | 'automotive'

export interface Domain {
  id: DomainId
  label: string
  description: string
  examples: string[]
}

export type SearchStatus = 'completed' | 'in_progress' | 'needs_review'

export interface RecentSearch {
  id: string
  query: string
  domain: DomainId
  status: SearchStatus
  /** Display-only label; sample data uses fixed text, not real timestamps. */
  when: string
}

export interface WorkflowStep {
  id: string
  title: string
  description: string
}
