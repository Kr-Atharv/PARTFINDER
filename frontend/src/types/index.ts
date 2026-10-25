export type DomainId = 'industrial' | 'electronics' | 'automotive'

export interface Domain {
  id: DomainId
  label: string
  description: string
  examples: string[]
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
  /** ISO timestamp of when the source was read, when the backend recorded it. */
  retrievedAt?: string
}

/** One specification value as claimed by one source, with the text it was read from. */
export interface PartClaim {
  label: string
  value: string
  unit?: string
  /** The line or snippet the value was extracted from, when recorded. */
  evidence?: string
  sourceName?: string
  sourceUrl?: string
}

/** A price exactly as printed on a source page. Never estimated or converted. */
export interface PartPrice {
  amount: number
  /** ISO code, or the bare symbol (e.g. "$") when the page does not say which currency. */
  currencyKey: string
  raw: string
  evidence: string
  sourceUrl: string
}

export interface ConflictingSpec {
  label: string
  claims: Array<{ value: string; sourceUrl: string }>
}

export type VerificationTier = 'official_manufacturer' | 'authorized_distributor' | 'verified_supplier' | 'unverified'

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
  /** `research` for records discovered live by TinyFish; absent/`catalogue` for database records. */
  origin?: 'catalogue' | 'research'
  /** Per-specification evidence, when the backend recorded it. */
  claims?: PartClaim[]
  /** Listed price (live research only; the catalogue stores no prices). */
  price?: PartPrice
  /** `snippet_only` means the page itself could not be fetched, only the search snippet was read. */
  evidenceLevel?: 'full_page' | 'snippet_only'
  conflictingSpecs?: ConflictingSpec[]
  /** Provenance verification tier */
  verificationTier?: VerificationTier
  /** Location or warehouse origin if detected */
  location?: string
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

/* ------------------------------------------------------------------ */
/* Advanced search                                                     */
/* ------------------------------------------------------------------ */

export interface NumericRangeSpec {
  min?: string | number
  max?: string | number
  unit?: string
}

export interface DetailedSpecFilters {
  manufacturer?: string
  partNumber?: string
  category?: string
  material?: string
  threadSize?: string
  portSize?: string
  tolerance?: string
  compatibleModel?: string
  location?: string

  // Dynamic Numeric Ranges
  diameter?: NumericRangeSpec
  length?: NumericRangeSpec
  width?: NumericRangeSpec
  height?: NumericRangeSpec
  weight?: NumericRangeSpec
  pressure?: NumericRangeSpec
  temperature?: NumericRangeSpec
  voltage?: NumericRangeSpec
  current?: NumericRangeSpec
  power?: NumericRangeSpec
  flowRate?: NumericRangeSpec
  speed?: NumericRangeSpec
  price?: NumericRangeSpec
}

/** Refinements applied on top of the core search. All server-side for catalogue results. */
export interface SearchRefinements {
  category: string
  availability: Availability | ''
  specLabel: string
  specValue: string
  specs?: DetailedSpecFilters
}

export interface SearchPaging {
  page: number
  pageSize: number
  sort: SortKey
}

export interface FacetValue {
  value: string
  count: number
}

export interface Facets {
  totalParts: number
  manufacturers: FacetValue[]
  categories: FacetValue[]
  domains: FacetValue[]
  availability: FacetValue[]
  specLabels: FacetValue[]
}

/** Where a page of results came from. `demo` means the backend could not be used. */
export type DataSource = 'backend' | 'demo'

export interface SearchPage {
  results: Part[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  source: DataSource
  /** Why the demo catalogue was used, when `source` is `demo`. */
  demoReason?: string
  /** True when a spec filter hit the server's scan limit, so the total may be incomplete. */
  truncated?: boolean
}
