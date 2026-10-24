import type { Part } from '@/types'

/**
 * How one specification row relates across the selected parts.
 * - same: every part lists the spec and the values are identical
 * - differs: at least two parts list the spec with different values
 * - gap: some parts do not list the spec (and the listed values do not conflict)
 */
export type SpecRowStatus = 'same' | 'differs' | 'gap'

export interface SpecMatrixCell {
  partId: string
  /** Value exactly as recorded for the part, or null when the part does not list it. */
  value: string | null
}

export interface SpecMatrixRow {
  /** Label shown to the user (first spelling encountered). */
  label: string
  status: SpecRowStatus
  cells: SpecMatrixCell[]
  /** Number of parts that do not list this specification. */
  missingCount: number
}

export interface SpecMatrix {
  parts: Part[]
  rows: SpecMatrixRow[]
}
