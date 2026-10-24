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

/* ------------------------------------------------------------------ */
/* Part 2: search & discovery                                          */
/* ------------------------------------------------------------------ */

export type Availability = 'in_stock' | 'limited' | 'out_of_stock' | 'unknown'

export interface PartSpec {
  label: string
  value: string
}

export interface PartSource {
  /** Human-readable source name. */
  name: string
  /** Source URL, when one is available. */
  url?: string
}

export interface Part {
  id: string
  name: string
  partNumber: string
  manufacturer: string
  domain: DomainId
  category: string
  description: string
  specs: PartSpec[]
  availability: Availability
  source: PartSource
  /** Typical applications. Matched by the optional "model" search field. */
  usedIn: string[]
  /** Extra search terms (synonyms, alternative names). */
  keywords: string[]
  /**
   * True for illustrative sample records. Demo records are invented and must
   * never be presented as verified real-world data.
   */
  isDemo: boolean
}

export interface SearchCriteria {
  query: string
  domain: DomainId | null
  manufacturer: string
  model: string
}

export type SearchField = 'query' | 'manufacturer' | 'model'
export type SearchErrors = Partial<Record<SearchField, string>>

export interface ResultFilters {
  /** Empty string means "all". */
  manufacturer: string
  category: string
  availability: Availability | ''
}

export type SortKey = 'name-asc' | 'name-desc' | 'manufacturer-asc' | 'manufacturer-desc'
