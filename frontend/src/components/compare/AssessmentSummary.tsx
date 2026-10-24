import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import type { Part } from '@/types'
import type { AssessmentReport } from '@/types/compatibility'
import { StatusBadge } from './StatusBadge'

export const SAFETY_WARNING =
  'A Potential Match is not a guarantee of safe installation. Critical substitutions require qualified human approval.'

interface AssessmentSummaryProps {
  parts: Part[]
  report: AssessmentReport
}

/** Per-part overall status and counts, all derived from the report. */
export function AssessmentSummary({ parts, report }: AssessmentSummaryProps) {
  const { partTotals } = report
  return (
    <div className="space-y-4">
      {report.target && (
        <p className="text-sm text-ink-600">
          Assessed against: <span className="font-medium text-ink-900">{report.target}</span>{' '}
          <span className="text-ink-500">(label you entered; not verified)</span>
        </p>
      )}

      <p className="text-sm text-ink-700" aria-live="polite">
        {parts.length} {parts.length === 1 ? 'part' : 'parts'}: {partTotals.potential_match} Potential Match
        {' · '}
        {partTotals.mismatch} Mismatch{' · '}
        {partTotals.unverified} Unverified
        {partTotals.notAssessed > 0 && <> · {partTotals.notAssessed} not assessed</>}
      </p>

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {parts.map((part) => {
          const assessment = report.parts.find((entry) => entry.partId === part.id)
          if (!assessment) return null
          const { counts } = assessment
          return (
            <li key={part.id}>
              <Card className="h-full space-y-3">
                <div>
                  <p className="font-semibold text-ink-900">{part.name}</p>
                  <p className="font-mono text-xs text-ink-700">{part.partNumber}</p>
                </div>
                {assessment.status ? (
                  <>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={assessment.status} />
                      {part.isDemo && <span className="text-xs text-ink-500">Demo data</span>}
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded border border-line bg-surface-muted px-2 py-1.5">
                        <dd className="text-lg font-semibold text-ink-900">{counts.match}</dd>
                        <dt className="text-xs text-ink-500">Match</dt>
                      </div>
                      <div className="rounded border border-line bg-surface-muted px-2 py-1.5">
                        <dd className="text-lg font-semibold text-ink-900">{counts.mismatch}</dd>
                        <dt className="text-xs text-ink-500">Mismatch</dt>
                      </div>
                      <div className="rounded border border-line bg-surface-muted px-2 py-1.5">
                        <dd className="text-lg font-semibold text-ink-900">{counts.unverified}</dd>
                        <dt className="text-xs text-ink-500">Unverified</dt>
                      </div>
                    </dl>
                    <p className="text-xs text-ink-500">of {counts.total} entered requirements</p>
                  </>
                ) : null}
                <p className="text-sm leading-relaxed text-ink-600">{assessment.summary}</p>
              </Card>
            </li>
          )
        })}
      </ul>

      <Alert tone="warning" title="Not an installation guarantee">
        {SAFETY_WARNING}
      </Alert>
    </div>
  )
}
