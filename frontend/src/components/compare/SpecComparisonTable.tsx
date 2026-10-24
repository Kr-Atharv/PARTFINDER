import { ExternalLink } from 'lucide-react'
import { AvailabilityBadge } from '@/components/parts/AvailabilityBadge'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { displayUrl, safeExternalUrl } from '@/lib/safeUrl'
import type { Part } from '@/types'
import type { SpecMatrixRow, SpecRowStatus } from '@/types/comparison'
import { PartColumnHeader } from './PartColumnHeader'

interface SpecComparisonTableProps {
  parts: Part[]
  rows: SpecMatrixRow[]
  onRemove: (partId: string) => void
}

const rowMeta: Record<SpecRowStatus, { label: string; tone: 'success' | 'warning' | 'neutral'; row: string; sticky: string }> = {
  same: { label: 'Same', tone: 'success', row: 'bg-white', sticky: 'bg-white' },
  differs: { label: 'Differs', tone: 'warning', row: 'bg-amber-50/60', sticky: 'bg-amber-50' },
  gap: { label: 'Not in every part', tone: 'neutral', row: 'bg-white', sticky: 'bg-white' },
}

/**
 * Side-by-side specification matrix. The same label is always on the same row,
 * differing rows are highlighted (and labelled in text, not colour alone), and
 * a part that does not list a spec shows an explicit "Not provided" message.
 */
export function SpecComparisonTable({ parts, rows, onRemove }: SpecComparisonTableProps) {
  return (
    <div
      role="region"
      aria-label="Specification comparison table. Scroll horizontally on small screens."
      tabIndex={0}
      className="overflow-x-auto rounded-lg border border-line bg-white shadow-card"
    >
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <caption className="sr-only">
          Side-by-side specifications for {parts.map((part) => part.name).join(', ')}
        </caption>
        <thead>
          <tr className="border-b border-line-strong bg-surface-muted align-top">
            <th
              scope="col"
              className="sticky left-0 z-10 w-40 min-w-[9rem] bg-surface-muted px-4 py-3 text-xs font-medium text-ink-500"
            >
              Specification
            </th>
            {parts.map((part) => (
              <th key={part.id} scope="col" className="min-w-[13rem] px-4 py-3">
                <PartColumnHeader part={part} onRemove={onRemove} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.length === 0 && (
            <tr>
              <td colSpan={parts.length + 1} className="px-4 py-6 text-center text-ink-500">
                No specifications to show.
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const meta = rowMeta[row.status]
            return (
              <tr key={row.label} className={meta.row}>
                <th
                  scope="row"
                  className={cn('sticky left-0 z-10 px-4 py-3 font-normal text-ink-700', meta.sticky)}
                >
                  <span className="block">{row.label}</span>
                  {parts.length > 1 && (
                    <span className="mt-1 block">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </span>
                  )}
                </th>
                {row.cells.map((cell) => (
                  <td key={cell.partId} className="px-4 py-3 align-top">
                    {cell.value !== null ? (
                      <span className="font-mono text-ink-900">{cell.value}</span>
                    ) : (
                      <span className="text-ink-500">
                        <span className="rounded border border-dashed border-line-strong px-1.5 py-0.5 text-xs">
                          Not provided
                        </span>
                        <span className="sr-only"> This part does not list this specification.</span>
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
        <tfoot className="border-t border-line-strong bg-surface-muted">
          <tr>
            <th scope="row" className="sticky left-0 z-10 bg-surface-muted px-4 py-3 text-xs font-medium text-ink-500">
              Availability
            </th>
            {parts.map((part) => (
              <td key={part.id} className="px-4 py-3 align-top">
                <AvailabilityBadge availability={part.availability} />
              </td>
            ))}
          </tr>
          <tr className="border-t border-line">
            <th scope="row" className="sticky left-0 z-10 bg-surface-muted px-4 py-3 text-xs font-medium text-ink-500">
              Source
            </th>
            {parts.map((part) => {
              const url = safeExternalUrl(part.source.url)
              return (
                <td key={part.id} className="px-4 py-3 align-top text-xs">
                  <p className="text-ink-800">{part.source.name}</p>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 break-all text-brand-700 hover:underline"
                    >
                      {displayUrl(url)}
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : (
                    <p className="mt-0.5 text-ink-500">No URL available</p>
                  )}
                  {part.isDemo && <p className="mt-0.5 text-ink-500">Placeholder, not verified</p>}
                </td>
              )
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
