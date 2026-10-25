import { Bookmark, BookmarkCheck, ExternalLink, FileText, MapPin, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthenticityBadge } from '@/components/parts/AuthenticityBadge'
import { StatusBadge } from '@/components/compare/StatusBadge'
import { AvailabilityBadge } from '@/components/parts/AvailabilityBadge'
import { CompareButton } from '@/components/parts/CompareButton'
import { CrossReferenceSection } from '@/components/parts/CrossReferenceSection'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Skeleton } from '@/components/ui/Skeleton'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/context/ToastContext'
import { domainById } from '@/data/domains'
import { configuredFields } from '@/lib/compatibility'
import { formatDateTime } from '@/lib/format'
import { formatPrice, priceCaveat } from '@/lib/price'
import { displayUrl, safeExternalUrl } from '@/lib/safeUrl'
import { describeError } from '@/services/api'
import { assessCompatibility } from '@/services/compatibilityService'
import { useRequirements } from '@/state/requirementsStore'
import { userData, useIsSaved } from '@/state/userData'
import type { Part, PartClaim } from '@/types'
import type { AssessmentReport } from '@/types/compatibility'

function ExternalLinkText({ url }: { url: string | undefined }) {
  const safe = safeExternalUrl(url)
  if (!safe) return <span className="text-ink-500">No URL recorded</span>
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 break-all text-brand-700 hover:underline"
    >
      {displayUrl(safe)}
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

const labelKey = (label: string) => label.trim().toLowerCase()

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-500">{title}</h3>
      {children}
    </section>
  )
}

function SpecRow({ label, value, claims }: { label: string; value: string; claims: PartClaim[] }) {
  return (
    <tr className="align-top">
      <th scope="row" className="w-2/5 px-4 py-2.5 text-left font-normal text-ink-500">
        {label}
      </th>
      <td className="px-4 py-2.5">
        <span className="font-mono text-ink-900">{value}</span>
        {claims.length > 0 ? (
          <details className="mt-1 text-xs">
            <summary className="cursor-pointer text-brand-700 hover:underline">
              Evidence ({claims.length})
            </summary>
            <ul className="mt-1.5 space-y-2">
              {claims.map((claim, index) => (
                <li key={index} className="rounded border border-line bg-surface-muted p-2">
                  {claim.evidence ? (
                    <blockquote className="break-words text-ink-700">“{claim.evidence}”</blockquote>
                  ) : (
                    <p className="text-ink-500">No source text recorded for this value.</p>
                  )}
                  <p className="mt-1 text-ink-500">
                    {claim.sourceName ? `${claim.sourceName} · ` : ''}
                    <ExternalLinkText url={claim.sourceUrl} />
                  </p>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <p className="mt-0.5 text-xs text-ink-400">No per-value evidence recorded.</p>
        )}
      </td>
    </tr>
  )
}

/** Compatibility of this one part against the requirements applied on the Compare page. */
function DrawerCompatibility({ part, onNavigate }: { part: Part; onNavigate: () => void }) {
  const { applied } = useRequirements()
  const active = useMemo(() => (applied ? configuredFields(applied, [part.domain]) : []), [applied, part.domain])
  const [report, setReport] = useState<AssessmentReport | null>(null)
  const [error, setError] = useState<ReturnType<typeof describeError> | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!applied || active.length === 0) {
      setReport(null)
      setError(null)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    assessCompatibility([part], applied, controller.signal)
      .then((next) => !controller.signal.aborted && setReport(next))
      .catch((err) => !controller.signal.aborted && setError(describeError(err, 'Compatibility check failed')))
      .finally(() => !controller.signal.aborted && setLoading(false))
    return () => controller.abort()
  }, [part, applied, active.length])

  if (!applied || active.length === 0) {
    return (
      <p className="text-sm text-ink-600">
        No requirements are applied{applied ? ' for this part’s domain' : ''}. Enter them on the{' '}
        <Link to="/compare" onClick={onNavigate} className="font-medium text-brand-700 hover:underline">
          Compare Parts
        </Link>{' '}
        page to see a PASS / MISMATCH / UNVERIFIED result here.
      </p>
    )
  }
  if (loading) return <Skeleton className="h-24 w-full" />
  if (error) return <Alert tone="error" title={error.title}>{error.message}</Alert>
  const assessment = report?.parts[0]
  if (!assessment || !assessment.status) return null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={assessment.status} />
        <span className="text-xs text-ink-500">
          {assessment.engine === 'backend'
            ? 'Checked by the PartFinder server.'
            : 'Checked by the built-in local engine because the server was unavailable.'}
        </span>
      </div>
      <p className="text-sm text-ink-700">{assessment.summary}</p>
      <ul className="divide-y divide-line rounded border border-line">
        {assessment.fields.map((field) => (
          <li key={field.fieldId} className="space-y-1 px-3 py-2.5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-ink-900">
                {field.label}
                <span className="ml-2 font-mono text-xs font-normal text-ink-500">
                  {field.constraint} {field.requiredValue}
                </span>
              </span>
              <StatusBadge status={field.status} variant="field" />
            </div>
            <p className="text-xs leading-relaxed text-ink-600">{field.explanation}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface PartDrawerProps {
  part: Part | null
  onClose: () => void
}

export function PartDrawer({ part, onClose }: PartDrawerProps) {
  const { notify } = useToast()
  const saved = useIsSaved(part?.id ?? '')

  if (!part) return null
  const domain = domainById[part.domain]
  const retrieved = formatDateTime(part.source.retrievedAt)
  const claimsFor = (label: string) => (part.claims ?? []).filter((claim) => labelKey(claim.label) === labelKey(label))

  const onSave = () => {
    const nowSaved = userData.toggleSaved(part)
    notify({
      tone: 'success',
      title: nowSaved ? 'Part saved' : 'Removed from saved parts',
      description: nowSaved ? `${part.name} is saved on this device.` : undefined,
    })
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={part.name}
      description={
        <>
          <span className="font-mono text-ink-700">{part.partNumber}</span>
          <span aria-hidden="true"> · </span>
          {part.manufacturer}
        </>
      }
      actions={
        <Tooltip content={saved ? 'Remove from saved parts (this device)' : 'Save this part (this device only)'} side="bottom">
          <Button
            variant={saved ? 'selected' : 'secondary'}
            size="sm"
            onClick={onSave}
            aria-pressed={saved}
            icon={saved ? <BookmarkCheck className="h-4 w-4" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}
          >
            {saved ? 'Saved' : 'Save'}
          </Button>
        </Tooltip>
      }
    >
      <div className="space-y-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{domain.label}</Badge>
          {part.category && <Badge>{part.category}</Badge>}
          <AvailabilityBadge availability={part.availability} />
          {part.verificationTier && (
            <AuthenticityBadge tier={part.verificationTier} supplierName={part.source.name} />
          )}
          {part.location && (
            <Badge tone="neutral" className="inline-flex items-center gap-1 text-xs">
              <MapPin className="h-3 w-3 text-ink-500" aria-hidden="true" />
              {part.location}
            </Badge>
          )}
          {part.isDemo && <Badge tone="warning">Demo data</Badge>}
          {part.origin === 'research' && !part.verificationTier && <Badge tone="info">Live research</Badge>}
          {part.evidenceLevel === 'snippet_only' && (
            <Tooltip content="The source page could not be fetched, so values were read from the search snippet only. Treat them with extra care.">
              <span tabIndex={0}>
                <Badge tone="warning">Snippet only</Badge>
              </span>
            </Tooltip>
          )}
        </div>

        {part.isDemo && (
          <Alert tone="warning" title="Demo data">
            This record is illustrative. Its manufacturer, specifications and source are invented and have not been
            verified against any real product.
          </Alert>
        )}

        {part.description && <p className="text-sm leading-relaxed text-ink-700">{part.description}</p>}

        <Section title="Supplier & source">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-500">Source</dt>
              <dd className="text-ink-900">{part.source.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Source URL</dt>
              <dd>
                <ExternalLinkText url={part.source.url} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Retrieved</dt>
              <dd className="text-ink-900">{retrieved ?? 'Not recorded'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Availability</dt>
              <dd className="text-ink-900">
                <AvailabilityBadge availability={part.availability} />
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="flex items-center gap-1 text-xs text-ink-500">Listed price</dt>
              <dd className="text-ink-900">
                {part.price ? (
                  <div className="space-y-1">
                    <p className="font-mono text-base font-semibold">{formatPrice(part.price)}</p>
                    <p className="text-xs text-ink-500">{priceCaveat(part.price)}</p>
                    <blockquote className="break-words rounded border border-line bg-surface-muted p-2 text-xs text-ink-700">
                      “{part.price.evidence}”
                    </blockquote>
                    <ExternalLinkText url={part.price.sourceUrl} />
                  </div>
                ) : (
                  <span className="text-ink-600">
                    No price recorded.{' '}
                    {part.origin === 'research'
                      ? 'No price line was found on the source page.'
                      : 'The catalogue does not store prices; run a live supplier search to look for one.'}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </Section>

        <Section title="Specifications">
          {part.specs.length > 0 ? (
            <div className="overflow-hidden rounded border border-line">
              <table className="w-full text-sm">
                <caption className="sr-only">Specifications for {part.name}</caption>
                <tbody className="divide-y divide-line">
                  {part.specs.map((spec, index) => (
                    <SpecRow key={`${spec.label}-${index}`} label={spec.label} value={spec.value} claims={claimsFor(spec.label)} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-ink-500">No specifications recorded for this part.</p>
          )}
        </Section>

        {part.conflictingSpecs && part.conflictingSpecs.length > 0 && (
          <Section title="Conflicting values">
            <Alert tone="warning" title="Sources disagree">
              <ul className="mt-1 space-y-2">
                {part.conflictingSpecs.map((conflict) => (
                  <li key={conflict.label}>
                    <p className="font-medium">{conflict.label}</p>
                    <ul className="ml-4 list-disc">
                      {conflict.claims.map((claim, index) => (
                        <li key={index}>
                          <span className="font-mono">{claim.value}</span> — <ExternalLinkText url={claim.sourceUrl} />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </Alert>
          </Section>
        )}

        <Section title="Compatibility with your requirements">
          <DrawerCompatibility part={part} onNavigate={onClose} />
        </Section>

        <Section title="Cross-Reference & Drop-In Equivalents">
          <CrossReferenceSection
            partNumber={part.partNumber}
            manufacturer={part.manufacturer}
            currentPart={part}
          />
        </Section>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
          <CompareButton part={part} size="md" />
          {part.origin === 'research' ? (
            <p className="flex items-start gap-1.5 text-xs text-ink-500">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Live research result. A full page exists only if it was saved to the catalogue.
            </p>
          ) : (
            <Button to={`/find/${part.id}`} variant="secondary" icon={<FileText className="h-4 w-4" aria-hidden="true" />} onClick={onClose}>
              Open full page
            </Button>
          )}
        </div>
      </div>
    </Drawer>
  )
}
