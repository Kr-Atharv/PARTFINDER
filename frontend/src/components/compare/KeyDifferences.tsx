import { Card } from '@/components/ui/Card'
import type { Part } from '@/types'
import type { KeyDifference } from '@/types/comparison'

interface KeyDifferencesProps {
  parts: Part[]
  differences: KeyDifference[]
}

/** Short strip of the rows where the listed values genuinely differ. Nothing is inferred. */
export function KeyDifferences({ parts, differences }: KeyDifferencesProps) {
  if (parts.length < 2) return null
  const nameOf = (id: string) => parts.find((part) => part.id === id)?.name ?? id
  return (
    <Card className="space-y-2">
      <h3 className="text-sm font-semibold text-ink-900">Key differences</h3>
      {differences.length === 0 ? (
        <p className="text-sm text-ink-600">
          No listed specification has different values across the selected parts. Specifications a part does
          not list are shown as “Not provided” in the table, not as differences.
        </p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {differences.map((diff) => (
            <li key={diff.label} className="rounded border border-line bg-surface-muted px-3 py-2 text-sm">
              <p className="font-medium text-ink-900">{diff.label}</p>
              <ul className="mt-0.5 space-y-0.5 text-xs text-ink-700">
                {diff.values.map((entry) => (
                  <li key={entry.partId}>
                    <span className="text-ink-500">{nameOf(entry.partId)}:</span>{' '}
                    <span className="font-mono text-ink-900">{entry.value}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
