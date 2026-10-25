import { CheckCircle, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'
import type { VerificationTier } from '@/types'

export interface AuthenticityBadgeProps {
  tier?: VerificationTier
  supplierName?: string
  className?: string
}

export function AuthenticityBadge({ tier, supplierName, className }: AuthenticityBadgeProps) {
  if (!tier || tier === 'unverified') {
    return (
      <Tooltip content="Source web page has not been confirmed as an authorized distributor or manufacturer.">
        <span tabIndex={0} className={className}>
          <Badge tone="neutral" className="inline-flex items-center gap-1">
            <ShieldAlert className="h-3 w-3 text-ink-400" aria-hidden="true" />
            Unverified Source
          </Badge>
        </span>
      </Tooltip>
    )
  }

  if (tier === 'official_manufacturer') {
    return (
      <Tooltip content={`Verified Official Manufacturer (${supplierName || 'Direct'}). Authentic technical datasheets & specifications.`}>
        <span tabIndex={0} className={className}>
          <Badge tone="success" className="inline-flex items-center gap-1 font-medium bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            Official Manufacturer
          </Badge>
        </span>
      </Tooltip>
    )
  }

  if (tier === 'authorized_distributor') {
    return (
      <Tooltip content={`Verified Authorized Distributor (${supplierName || 'Authorized Network'}). Authentic industrial distributor catalog.`}>
        <span tabIndex={0} className={className}>
          <Badge tone="brand" className="inline-flex items-center gap-1 font-medium bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-700">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            Authorized Distributor
          </Badge>
        </span>
      </Tooltip>
    )
  }

  return (
    <Tooltip content={`Established Industrial Supplier (${supplierName || 'Verified Supplier'}). Technical specifications backed by source.`}>
      <span tabIndex={0} className={className}>
        <Badge tone="info" className="inline-flex items-center gap-1 font-medium bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-700">
          <CheckCircle className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          Verified Supplier
        </Badge>
      </span>
    </Tooltip>
  )
}
