import { ArrowLeft, ExternalLink, MapPin, PackageSearch } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { AuthenticityBadge } from '@/components/parts/AuthenticityBadge'
import { AvailabilityBadge } from '@/components/parts/AvailabilityBadge'
import { CompareButton } from '@/components/parts/CompareButton'
import { CrossReferenceSection } from '@/components/parts/CrossReferenceSection'
import { SaveButton } from '@/components/parts/SaveButton'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { domainById } from '@/data/domains'
import { ApiError, describeError, isAbort } from '@/services/api'
import { fetchPartByIdStrict, getPartById } from '@/services/partSearch'
import { userData } from '@/state/userData'
import type { Part } from '@/types'

type DetailState =
  | { status: 'loading' }
  | { status: 'ready'; part: Part; offlineDemo?: string }
  | { status: 'not_found' }
  | { status: 'error'; title: string; message: string; retryable: boolean }

export default function PartDetailPage() {
  const { partId } = useParams<{ partId: string }>()
  const location = useLocation()
  const backTo = (location.state as { from?: string } | null)?.from ?? '/find'
  const [state, setState] = useState<DetailState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!partId) {
      setState({ status: 'not_found' })
      return
    }
    const controller = new AbortController()
    setState({ status: 'loading' })
    fetchPartByIdStrict(partId, controller.signal)
      .then((fetched) => {
        if (controller.signal.aborted) return
        if (!fetched) {
          setState({ status: 'not_found' })
          return
        }
        userData.recordView(fetched)
        setState({ status: 'ready', part: fetched })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return
        // Only the built-in demo catalogue may stand in, and only when the server is unavailable.
        const demo = error instanceof ApiError && error.isUnavailable ? getPartById(partId) : undefined
        if (demo) {
          userData.recordView(demo)
          setState({ status: 'ready', part: demo, offlineDemo: (error as ApiError).message })
          return
        }
        const described = describeError(error, 'This part could not be loaded')
        setState({ status: 'error', ...described })
      })
    return () => controller.abort()
  }, [partId, attempt])

  const backLink = (
    <Link
      to={backTo}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to results
    </Link>
  )

  if (state.status === 'loading') {
    return (
      <div className="space-y-6">
        {backLink}
        <Card>
          <LoadingState label="Loading part details…" />
        </Card>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="space-y-6">
        {backLink}
        <Alert
          tone="error"
          title={state.title}
          action={
            state.retryable ? (
              <Button variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </Button>
            ) : undefined
          }
        >
          {state.message}
        </Alert>
      </div>
    )
  }

  if (state.status === 'not_found') {
    return (
      <div className="space-y-6">
        {backLink}
        <EmptyState
          icon={PackageSearch}
          title="Part not found"
          description="The server has no part with this id. Parts found by live web research are not stored as catalogue records; open them from the research results instead."
          action={
            <Button to="/find" icon={<PackageSearch className="h-4 w-4" aria-hidden="true" />}>
              Go to Find Parts
            </Button>
          }
        />
      </div>
    )
  }

  const { part } = state

  const domain = domainById[part.domain] || domainById.industrial

  return (
    <div className="space-y-6">
      {backLink}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
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
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink-900">{part.name}</h1>
          <p className="mt-1 text-sm text-ink-500">
            <span className="font-mono text-ink-700">{part.partNumber}</span>
            <span aria-hidden="true"> · </span>
            {part.manufacturer}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <SaveButton part={part} size="md" />
          <CompareButton part={part} size="md" />
        </div>
      </div>

      {state.offlineDemo && (
        <Alert tone="warning" title="Server unavailable: showing the built-in demo record">
          {state.offlineDemo} This is an invented demo record, not data from the server.
        </Alert>
      )}

      {part.isDemo && (
        <Alert tone="warning" title="Demo data">
          This record is illustrative. The manufacturer, part number, specifications and source are
          invented for demonstration and have not been verified against any real product.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card padded={false}>
            <div className="border-b border-line px-5 py-4">
              <CardHeader title="Technical specifications" />
            </div>
            {part.specs.length > 0 ? (
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Technical specifications for {part.name}</caption>
                <tbody className="divide-y divide-line">
                  {part.specs.map((spec) => (
                    <tr key={spec.label}>
                      <th scope="row" className="w-1/2 px-5 py-3 font-normal text-ink-500">
                        {spec.label}
                      </th>
                      <td className="px-5 py-3 font-mono text-ink-900">{spec.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-5 text-sm text-ink-500">
                No technical specifications recorded for this part yet.
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Description" />
            <p className="mt-3 text-sm leading-relaxed text-ink-600">{part.description}</p>

            <h3 className="mt-5 text-sm font-semibold text-ink-900">Typical applications</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {part.usedIn && part.usedIn.length > 0 ? (
                part.usedIn.map((entry) => (
                  <li key={entry}>
                    <Badge>{entry}</Badge>
                  </li>
                ))
              ) : (
                <li className="text-sm text-ink-500">No applications listed.</li>
              )}
            </ul>
          </Card>

          <Card>
            <CrossReferenceSection
              partNumber={part.partNumber}
              manufacturer={part.manufacturer}
              currentPart={part}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Source information" />
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-ink-500">Source</dt>
                <dd className="mt-0.5 font-medium text-ink-900">{part.source.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">URL</dt>
                <dd className="mt-0.5">
                  {part.source.url ? (
                    <a
                      href={part.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 break-all text-brand-700 hover:underline"
                    >
                      {part.source.url.replace(/^https?:\/\//, '')}
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="text-ink-500">No URL available</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Availability</dt>
                <dd className="mt-1">
                  <AvailabilityBadge availability={part.availability} />
                </dd>
              </div>
            </dl>
            {part.isDemo && (
              <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-500">
                Placeholder source. Nothing was retrieved from the web for this record.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
