import { ArrowRight, Bookmark, BookmarkCheck, Eye, ExternalLink } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/context/ToastContext'
import { usePartDrawer } from '@/context/PartDrawerContext'
import { domainById } from '@/data/domains'
import { formatPrice } from '@/lib/price'
import { displayUrl, safeExternalUrl } from '@/lib/safeUrl'
import { userData, useIsSaved } from '@/state/userData'
import type { Part } from '@/types'
import { AvailabilityBadge } from './AvailabilityBadge'
import { CompareButton } from './CompareButton'
import { SpecList } from './SpecList'

const KEY_SPEC_COUNT = 4

export function PartCard({ part }: { part: Part }) {
  const location = useLocation()
  const drawer = usePartDrawer()
  const { notify } = useToast()
  const saved = useIsSaved(part.id)
  const domain = domainById[part.domain]
  const detailPath = `/find/${part.id}`
  // Lets the detail page link back to the exact search the user came from.
  const from = `${location.pathname}${location.search}`
  const sourceUrl = safeExternalUrl(part.source.url)

  const onSave = () => {
    const nowSaved = userData.toggleSaved(part)
    notify({
      tone: 'success',
      title: nowSaved ? 'Part saved' : 'Removed from saved parts',
      description: nowSaved ? `${part.name} is saved on this device.` : undefined,
    })
  }

  return (
    <article className="rounded-lg border border-line bg-surface p-5 shadow-card" aria-label={`${part.name}, ${part.partNumber}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{domain.label}</Badge>
            {part.category && <Badge>{part.category}</Badge>}
            <AvailabilityBadge availability={part.availability} />
            {part.isDemo && <Badge tone="warning">Demo data</Badge>}
            {part.origin === 'research' && <Badge tone="info">Live research</Badge>}
            {part.evidenceLevel === 'snippet_only' && <Badge tone="warning">Snippet only</Badge>}
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
            {part.price && (
              <>
                <span aria-hidden="true"> · </span>
                <span className="font-mono text-ink-700">{formatPrice(part.price)}</span>
                <span className="text-xs"> (as listed)</span>
              </>
            )}
          </p>

          <div className="mt-4">
            {part.specs.length > 0 ? (
              <SpecList specs={part.specs.slice(0, KEY_SPEC_COUNT)} />
            ) : (
              <p className="text-sm text-ink-500">No specifications recorded.</p>
            )}
          </div>

          <p className="mt-4 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-500">
            <span>Source:</span>
            <span className="font-medium text-ink-700">{part.source.name}</span>
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 break-all text-brand-700 hover:underline"
              >
                {displayUrl(sourceUrl)}
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-56 lg:flex-col">
          <Button
            variant="secondary"
            size="sm"
            icon={<Eye className="h-4 w-4" aria-hidden="true" />}
            onClick={() => drawer.open(part)}
            aria-label={`Quick view ${part.name}`}
          >
            Quick view
          </Button>
          <Button
            to={detailPath}
            state={{ from }}
            variant="ghost"
            size="sm"
            iconRight={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
          >
            View details
          </Button>
          <CompareButton part={part} />
          <Tooltip content={saved ? 'Remove from saved parts' : 'Save this part on this device'}>
            <Button
              variant={saved ? 'selected' : 'ghost'}
              size="sm"
              onClick={onSave}
              aria-pressed={saved}
              icon={saved ? <BookmarkCheck className="h-4 w-4" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}
            >
              {saved ? 'Saved' : 'Save'}
            </Button>
          </Tooltip>
        </div>
      </div>
    </article>
  )
}
