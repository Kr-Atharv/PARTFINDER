import { ArrowRight, GitCompareArrows, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useCompare } from '@/context/CompareContext'
import { useToast } from '@/context/ToastContext'
import { domainById } from '@/data/domains'
import { timeAgo } from '@/lib/format'
import { describeSearch, searchLink } from '@/lib/history'
import { userData } from '@/state/userData'
import type { ComparisonRecord, RecentSearch } from '@/state/userData'

interface SearchRowProps {
  entry: RecentSearch
  /** Show a remove button (history page). */
  removable?: boolean
}

export function SearchRow({ entry, removable }: SearchRowProps) {
  const text = describeSearch(entry)
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-surface-muted">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-900" title={text}>
          {text}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
          <Badge tone={entry.kind === 'research' ? 'info' : 'neutral'}>{entry.kind === 'research' ? 'Live research' : 'Catalogue'}</Badge>
          {entry.domain && <span>{domainById[entry.domain].label}</span>}
          {typeof entry.resultCount === 'number' && (
            <span>
              {entry.resultCount} {entry.resultCount === 1 ? 'result' : 'results'}
            </span>
          )}
          <time dateTime={entry.at}>{timeAgo(entry.at)}</time>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          to={searchLink(entry)}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-600"
          aria-label={`Open search: ${text}`}
        >
          Open
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        {removable && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove from history: ${text}`}
            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
            onClick={() => userData.removeSearch(entry.id)}
          >
            Remove
          </Button>
        )}
      </div>
    </li>
  )
}

interface ComparisonRowProps {
  record: ComparisonRecord
  removable?: boolean
}

/** A past comparison. Reopen puts its parts back into the comparison selection and opens the Compare page. */
export function ComparisonRow({ record, removable }: ComparisonRowProps) {
  const { replace } = useCompare()
  const navigate = useNavigate()
  const { notify } = useToast()
  const names = record.parts.map((part) => part.name).join(' vs ')

  const reopen = () => {
    replace(record.parts)
    notify({ tone: 'info', title: 'Comparison reopened', description: `${record.parts.length} parts restored as they were saved on this device.`, duration: 3000 })
    navigate('/compare')
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 hover:bg-surface-muted">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900">{names}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
          <span>{record.parts.length} parts</span>
          {record.parts.some((part) => part.isDemo) && <Badge tone="warning">Includes demo data</Badge>}
          <time dateTime={record.at}>{timeAgo(record.at)}</time>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" icon={<GitCompareArrows className="h-4 w-4" aria-hidden="true" />} onClick={reopen} aria-label={`Reopen comparison: ${names}`}>
          Reopen
        </Button>
        {removable && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Remove comparison: ${names}`}
            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
            onClick={() => userData.removeComparison(record.id)}
          >
            Remove
          </Button>
        )}
      </div>
    </li>
  )
}
