// src/components/parts/CrossReferenceSection.tsx
import { ArrowLeftRight, Check, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CrossReferenceResult, EquivalentPartMatch, lookupEquivalents } from '@/services/crossReferenceService'
import type { Part } from '@/types'

interface CrossReferenceSectionProps {
  partNumber: string
  manufacturer?: string
  currentPart?: Part
  onSelectEquivalent?: (eq: EquivalentPartMatch) => void
}

export function CrossReferenceSection({ partNumber, manufacturer, onSelectEquivalent }: CrossReferenceSectionProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CrossReferenceResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!partNumber) return
    let active = true
    setLoading(true)
    setError(null)

    lookupEquivalents({ partNumber, manufacturer })
      .then((res) => {
        if (active) setData(res)
      })
      .catch((err) => {
        if (active) setError(err.message || 'Could not load cross-references')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [partNumber, manufacturer])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 text-ink-500 gap-2 text-xs">
        <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
        <span>Searching cross-reference standards and manufacturer interchanges...</span>
      </div>
    )
  }

  if (error || !data || data.equivalents.length === 0) {
    return null
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
            <ArrowLeftRight className="h-4 w-4" />
          </span>
          <div>
            <h4 className="text-xs font-semibold text-ink-900 uppercase tracking-wider">
              Cross-Reference &amp; Drop-In Equivalents ({data.equivalentsCount})
            </h4>
            <p className="text-[11px] text-ink-500">
              Interchangeable alternatives verified against standard mounting &amp; duty ratings
            </p>
          </div>
        </div>
        {data.sourcePart.standardSeries && (
          <Badge tone="brand">
            {data.sourcePart.standardSeries}
          </Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.equivalents.map((eq) => {
          const isDirect = eq.interchangeType === 'direct_drop_in'
          const isFunctional = eq.interchangeType === 'functional_alternative'

          return (
            <Card key={eq.id} className="p-3.5 space-y-2.5 border-line bg-surface hover:border-brand-300 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-medium text-ink-500 uppercase">{eq.manufacturer}</span>
                  <h5 className="font-mono text-sm font-bold text-ink-900">{eq.partNumber}</h5>
                  <p className="text-xs text-ink-600 line-clamp-1">{eq.name}</p>
                </div>
                <Badge tone={isDirect ? 'success' : isFunctional ? 'info' : 'warning'}>
                  {isDirect ? 'Direct Drop-in' : isFunctional ? 'Functional Alternative' : 'Adapted'}
                </Badge>
              </div>

              {/* FFF Score */}
              <div className="flex items-center gap-3 text-[11px] bg-surface-subtle px-2.5 py-1.5 rounded border border-line">
                <span className="font-medium text-ink-700">Fit/Form/Function:</span>
                <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3 w-3" />
                  {eq.fffScore.overallScore}% match
                </span>
                <span className="text-ink-400">·</span>
                <span className="text-ink-500 capitalize">{eq.fffScore.fit} fit</span>
              </div>

              {/* Key differences */}
              {eq.keyDifferences.length > 0 && (
                <ul className="text-[11px] text-ink-600 space-y-1">
                  {eq.keyDifferences.slice(0, 2).map((diff, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-brand-600 font-bold">›</span>
                      <span>{diff}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line">
                <Link
                  to={`/find?tab=research&q=${encodeURIComponent(`${eq.manufacturer} ${eq.partNumber}`)}`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:text-brand-600"
                >
                  <Sparkles className="h-3 w-3" />
                  Research Suppliers
                </Link>
                {onSelectEquivalent && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSelectEquivalent(eq)}
                  >
                    View Specs
                  </Button>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
