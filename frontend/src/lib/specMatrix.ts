import { isKnownUnit, nearlyEqual, parseQuantity, toBase } from '@/lib/quantity'
import type { Part } from '@/types'
import type { KeyDifference, SpecMatrix, SpecMatrixRow, SpecRowStatus } from '@/types/comparison'

const labelKey = (label: string) => label.trim().toLowerCase().replace(/\s+/g, ' ')
const valueKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '')

/**
 * Finds the highest and lowest value of a row when, and only when, they can be compared
 * safely: every listed value is a single number, all share one unit family (converted via the
 * known unit table) or are all unitless, and they are not all equal. Otherwise returns undefined
 * and no highlight is shown - nothing is guessed.
 */
export function numericExtremes(
  cells: Array<{ partId: string; value: string }>,
): { highest: string[]; lowest: string[] } | undefined {
  if (cells.length < 2) return undefined
  const parsed = cells.map((cell) => ({ cell, quantity: parseQuantity(cell.value) }))
  if (parsed.some((entry) => !entry.quantity || entry.quantity.isRange)) return undefined

  const units = parsed.map((entry) => entry.quantity!.unit)
  const unitless = units.every((unit) => unit === '')
  if (!unitless && units.some((unit) => unit === '' || !isKnownUnit(unit))) return undefined

  const reference = units[0]
  const values: Array<{ partId: string; value: number }> = []
  for (const entry of parsed) {
    const q = entry.quantity!
    const base = unitless ? q.min : toBase(q.min, q.unit, reference)
    if (base === null) return undefined
    values.push({ partId: entry.cell.partId, value: base })
  }
  const max = Math.max(...values.map((v) => v.value))
  const min = Math.min(...values.map((v) => v.value))
  if (nearlyEqual(max, min)) return undefined
  return {
    highest: values.filter((v) => nearlyEqual(v.value, max)).map((v) => v.partId),
    lowest: values.filter((v) => nearlyEqual(v.value, min)).map((v) => v.partId),
  }
}

/** The rows where listed values genuinely differ, for a short "what's different" summary. */
export function keyDifferences(matrix: SpecMatrix, limit = 6): KeyDifference[] {
  return matrix.rows
    .filter((row) => row.status === 'differs')
    .slice(0, limit)
    .map((row) => ({
      label: row.label,
      values: row.cells.filter((cell) => cell.value !== null).map((cell) => ({ partId: cell.partId, value: cell.value as string })),
    }))
}

/**
 * Lines up the specifications of the selected parts by label.
 *
 * Deterministic and purely derived from the parts passed in: rows are ordered
 * by how many parts list the spec (most shared first), then by first
 * appearance. Labels are matched case-insensitively on exact text only; no
 * synonym guessing happens here.
 */
export function buildSpecMatrix(parts: Part[]): SpecMatrix {
  const order: string[] = []
  const labels = new Map<string, string>()
  const byPart = new Map<string, Map<string, string>>()

  for (const part of parts) {
    const values = new Map<string, string>()
    for (const spec of part.specs) {
      const key = labelKey(spec.label)
      if (!labels.has(key)) {
        labels.set(key, spec.label)
        order.push(key)
      }
      // If a part repeats a label, the first value wins; the engine in the
      // compatibility step reports repeated, conflicting labels separately.
      if (!values.has(key)) values.set(key, spec.value)
    }
    byPart.set(part.id, values)
  }

  const rows: SpecMatrixRow[] = order.map((key) => {
    const cells = parts.map((part) => ({
      partId: part.id,
      value: byPart.get(part.id)?.get(key) ?? null,
    }))
    const present = cells.filter((cell) => cell.value !== null) as Array<{ partId: string; value: string }>
    const missingCount = cells.length - present.length
    const distinct = new Set(present.map((cell) => valueKey(cell.value)))
    let status: SpecRowStatus
    if (distinct.size > 1) status = 'differs'
    else if (missingCount > 0) status = 'gap'
    else status = 'same'
    const extremes = status === 'differs' ? numericExtremes(present) : undefined
    return { label: labels.get(key) ?? key, status, cells, missingCount, extremes }
  })

  const sharedCount = (row: SpecMatrixRow) => row.cells.length - row.missingCount
  const indexed = rows.map((row, index) => ({ row, index }))
  indexed.sort((a, b) => sharedCount(b.row) - sharedCount(a.row) || a.index - b.index)

  return { parts, rows: indexed.map((entry) => entry.row) }
}
