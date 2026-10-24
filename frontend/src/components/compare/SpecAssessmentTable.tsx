import { ExternalLink } from 'lucide-react'
import { reasonLabels } from '@/lib/compatibility'
import { cn } from '@/lib/cn'
import type { Part } from '@/types'
import type { AssessmentReport, FieldAssessment } from '@/types/compatibility'
import { StatusBadge } from './StatusBadge'

interface SpecAssessmentTableProps {
  parts: Part[]
  report: AssessmentReport
}

const rowTint = { potential_match: '', mismatch: 'bg-red-50/60', unverified: 'bg-amber-50/60' } as const

/**
 * Required vs discovered values for every entered requirement, one column per
 * part. Rows come only from the assessment report, so what is shown is exactly
 * what was assessed.
 */
export function SpecAssessmentTable({ parts, report }: SpecAssessmentTableProps) {
  const rows: Array<{ fieldId: string; sample: FieldAssessment }> = []
  for (const assessment of report.parts) {
    for (const field of assessment.fields) {
      if (!rows.some((row) => row.fieldId === field.fieldId)) rows.push({ fieldId: field.fieldId, sample: field })
    }
  }

  if (rows.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Required versus discovered specifications. Scroll horizontally on small screens."
      tabIndex={0}
      className="overflow-x-auto rounded-lg border border-line bg-white shadow-card"
    >
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <caption className="sr-only">Required values compared with values found in each part record</caption>
        <thead>
          <tr className="border-b border-line-strong bg-surface-muted align-top text-xs font-medium text-ink-500">
            <th scope="col" className="sticky left-0 z-10 min-w-[9rem] bg-surface-muted px-4 py-3">
              Specification
            </th>
            <th scope="col" className="min-w-[9rem] px-4 py-3">
              Required (entered by you)
            </th>
            {parts.map((part) => (
              <th key={part.id} scope="col" className="min-w-[13rem] px-4 py-3">
                <span className="block text-sm font-semibold text-ink-900">{part.name}</span>
                <span className="block font-mono font-normal text-ink-700">{part.partNumber}</span>
                <span className="block font-normal">Found in record</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(({ fieldId, sample }) => (
            <tr key={fieldId}>
              <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-3 align-top font-normal text-ink-800">
                <span className="block font-medium">{sample.label}</span>
                {sample.unit && <span className="block text-xs text-ink-500">Unit: {sample.unit}</span>}
              </th>
              <td className="px-4 py-3 align-top">
                <span className="block font-mono text-ink-900">{sample.requiredValue}</span>
                <span className="block text-xs text-ink-500">{sample.constraint}</span>
              </td>
              {parts.map((part) => {
                const assessment = report.parts.find((entry) => entry.partId === part.id)
                const field = assessment?.fields.find((entry) => entry.fieldId === fieldId)
                if (!field) {
                  return (
                    <td key={part.id} className="px-4 py-3 align-top text-xs text-ink-500">
                      Not applicable to this part’s domain
                    </td>
                  )
                }
                return (
                  <td key={part.id} className={cn('px-4 py-3 align-top', rowTint[field.status])}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={field.status} variant="field" />
                      {field.reason && <span className="text-xs text-ink-600">{reasonLabels[field.reason]}</span>}
                    </div>
                    <p className="mt-1.5">
                      {field.evidence.valueFound !== undefined ? (
                        <span className="font-mono text-ink-900">{field.evidence.valueFound}</span>
                      ) : (
                        <span className="rounded border border-dashed border-line-strong px-1.5 py-0.5 text-xs text-ink-500">
                          Not found in record
                        </span>
                      )}
                    </p>
                    <p className="mt-1.5 text-xs text-ink-500">
                      {field.evidence.sourceUrl ? (
                        <a
                          href={field.evidence.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                        >
                          {field.evidence.sourceName ?? 'Source'}
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      ) : field.evidence.valueFound !== undefined && field.evidence.sourceName ? (
                        <>Source: {field.evidence.sourceName} (no URL)</>
                      ) : (
                        <>No source evidence available</>
                      )}
                    </p>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
