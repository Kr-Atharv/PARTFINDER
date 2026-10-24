import { ArrowRight, ExternalLink } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { domainById } from '@/data/domains'
import type { Part } from '@/types'
import { AvailabilityBadge } from './AvailabilityBadge'
import { CompareButton } from './CompareButton'
import { SpecList } from './SpecList'

const KEY_SPEC_COUNT = 4

export function PartCard({ part }: { part: Part }) {
  const location = useLocation()
  const domain = domainById[part.domain]
  const detailPath = `/find/${part.id}`
  // Lets the detail page link back to the exact search the user came from.
  const from = `${location.pathname}${location.search}`

  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-card">
      <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{domain.label}</Badge>
            <Badge>{part.category}</Badge>
            <AvailabilityBadge availability={part.availability} />
            {part.isDemo && <Badge tone="warning">Demo data</Badge>}
          </div>

          <h3 className="mt-3 text-base font-semibold text-ink-900">
            <Link to={detailPath} state={{ from }} className="hover:text-brand-700">
              {part.name}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-ink-500">
            <span className="font-mono text-ink-700">{part.partNumber}</span>
            <span aria-hidden="true"> · </span>
            {part.manufacturer}
          </p>

          <div className="mt-4">
            <SpecList specs={part.specs.slice(0, KEY_SPEC_COUNT)} />
          </div>

          <p className="mt-4 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-500">
            <span>Source:</span>
            <span className="font-medium text-ink-700">{part.source.name}</span>
            {part.source.url && (
              <a
                href={part.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 break-all text-brand-700 hover:underline"
              >
                {part.source.url.replace(/^https?:\/\//, '')}
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
              </a>
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:w-56 lg:flex-col">
          <Button
            to={detailPath}
            state={{ from }}
            variant="secondary"
            size="sm"
            iconRight={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
          >
            View details
          </Button>
          <CompareButton part={part} />
        </div>
      </div>
    </article>
  )
}
