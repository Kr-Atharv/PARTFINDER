import { Card } from '@/components/ui/Card'
import { reasonLabels } from '@/lib/compatibility'
import type { Part } from '@/types'
import type { AssessmentReport } from '@/types/compatibility'
import { StatusBadge } from './StatusBadge'

export const SAFETY_WARNING =
  'A PASS is not a guarantee of safe installation or fit. Critical substitutions require qualified human approval.'

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
        {parts.length} {parts.length === 1 ? 'part' : 'parts'}: {partTotals.potential_match} Pass
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
          const nonPass = assessment.fields.filter((field) => field.status !== 'potential_match')
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
                {nonPass.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-ink-700">Reasons</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-ink-600">
                      {nonPass.map((field) => (
                        <li key={field.fieldId}>
                          <span className="font-medium text-ink-800">{field.label}</span>:{' '}
                          {field.status === 'mismatch'
                            ? 'recorded value contradicts the requirement'
                            : field.reason
                              ? reasonLabels[field.reason]
                              : 'could not be verified'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
