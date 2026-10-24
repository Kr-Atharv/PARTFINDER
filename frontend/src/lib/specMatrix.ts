import type { Part } from '@/types'
import type { SpecMatrix, SpecMatrixRow, SpecRowStatus } from '@/types/comparison'

const labelKey = (label: string) => label.trim().toLowerCase().replace(/\s+/g, ' ')
const valueKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '')

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
    return { label: labels.get(key) ?? key, status, cells, missingCount }
  })

  const sharedCount = (row: SpecMatrixRow) => row.cells.length - row.missingCount
  const indexed = rows.map((row, index) => ({ row, index }))
  indexed.sort((a, b) => sharedCount(b.row) - sharedCount(a.row) || a.index - b.index)

  return { parts, rows: indexed.map((entry) => entry.row) }
}
