import { ChevronDown, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { formatDateTime } from '@/lib/format'
import { displayUrl } from '@/lib/safeUrl'
import type { Part } from '@/types'
import type { AssessmentReport, EvidenceAvailability, FieldAssessment } from '@/types/compatibility'
import { StatusBadge } from './StatusBadge'

const availabilityText: Record<EvidenceAvailability, string> = {
  source_with_url: 'Source name and URL provided',
  source_name_only: 'Source name only, no URL',
  none: 'No source evidence available',
}

function EvidenceItem({ field }: { field: FieldAssessment }) {
  const { evidence } = field
  return (
    <li className="space-y-3 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink-900">{field.label}</h4>
        <StatusBadge status={field.status} variant="field" />
      </div>
      <p className="text-sm leading-relaxed text-ink-700">{field.explanation}</p>

      {evidence.availability === 'none' && (
        <p className="rounded border border-dashed border-line-strong bg-surface-muted px-3 py-2 text-sm text-ink-700">
          No source evidence available
        </p>
      )}

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-ink-500">Required value (entered by you)</dt>
          <dd className="font-mono text-ink-900">
            {field.constraint} {field.requiredValue}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">Specification extracted</dt>
          <dd className="text-ink-900">{evidence.specLabel ?? 'None found in record'}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">Value found</dt>
          <dd className="font-mono text-ink-900">{evidence.valueFound ?? 'Not found in record'}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">Evidence availability</dt>
          <dd className="text-ink-900">{availabilityText[evidence.availability]}</dd>
        </div>
        {evidence.availability !== 'none' && (
          <>
            <div>
              <dt className="text-xs text-ink-500">Source name</dt>
              <dd className="text-ink-900">{evidence.sourceName ?? 'Not provided'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Source URL</dt>
              <dd>
                {evidence.sourceUrl ? (
                  <a
                    href={evidence.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 break-all text-brand-700 hover:underline"
                  >
                    {displayUrl(evidence.sourceUrl)}
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : (
                  <span className="text-ink-500">No URL available</span>
                )}
              </dd>
            </div>
          </>
        )}
        {evidence.claimEvidence && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-ink-500">Evidence text recorded with the claim</dt>
            <dd className="break-words rounded border border-line bg-surface-muted px-2 py-1 font-mono text-xs text-ink-800">
              {evidence.claimEvidence}
            </dd>
          </div>
        )}
        {evidence.retrievedAt && (
          <div>
            <dt className="text-xs text-ink-500">Source read at</dt>
            <dd className="text-ink-900">{formatDateTime(evidence.retrievedAt)}</dd>
          </div>
        )}
      </dl>

      {evidence.availability !== 'none' && (
        <p className="text-xs text-ink-500">
          Verification: not verified. No live check of this source was performed.
          {evidence.isDemo && ' This is a placeholder demo source (example.com), not a real manufacturer page.'}
        </p>
      )}
    </li>
  )
}

interface EvidencePanelProps {
  parts: Part[]
  report: AssessmentReport
}

/** For each part, the basis of every assessed requirement. */
export function EvidencePanel({ parts, report }: EvidencePanelProps) {
  return (
    <div className="space-y-3">
      {parts.map((part, index) => {
        const assessment = report.parts.find((entry) => entry.partId === part.id)
        if (!assessment) return null
        return (
          <Card key={part.id} padded={false}>
            <details open={index === 0} className="group">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-5 py-4">
                <span className="min-w-0">
                  <span className="block font-semibold text-ink-900">{part.name}</span>
                  <span className="block font-mono text-xs text-ink-700">{part.partNumber}</span>
                </span>
                <span className="flex items-center gap-2">
                  <ChevronDown
                    className="h-4 w-4 text-ink-400 transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                  {part.isDemo && <Badge tone="warning">Demo data</Badge>}
                  {assessment.status ? (
                    <StatusBadge status={assessment.status} />
                  ) : (
                    <Badge>Not assessed</Badge>
                  )}
                </span>
              </summary>
              <div className="border-t border-line px-5">
                {assessment.fields.length === 0 ? (
                  <p className="py-4 text-sm text-ink-500">
                    No requirements were entered for this part’s domain, so there is no evidence to show.
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {assessment.fields.map((field) => (
                      <EvidenceItem key={field.fieldId} field={field} />
                    ))}
                  </ul>
                )}
              </div>
            </details>
          </Card>
        )
      })}
    </div>
  )
}
