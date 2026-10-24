import type { PartSpec } from '@/types'

/** Compact label/value grid used on result cards. */
export function SpecList({ specs }: { specs: PartSpec[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {specs.map((spec) => (
        <div key={spec.label} className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
          <dt className="text-xs text-ink-500">{spec.label}</dt>
          <dd className="text-right font-mono text-xs text-ink-800">{spec.value}</dd>
        </div>
      ))}
    </dl>
  )
}
