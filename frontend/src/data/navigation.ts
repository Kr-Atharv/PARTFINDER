import { GitCompareArrows, History, LayoutDashboard, PackageSearch } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  title: string
  icon: LucideIcon
  /** Match only the exact path (used for the Overview route). */
  end?: boolean
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Overview', title: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/find', label: 'Find Parts', title: 'Find Parts', icon: PackageSearch },
  { to: '/compare', label: 'Compare Parts', title: 'Compare Parts', icon: GitCompareArrows },
  { to: '/history', label: 'Search History', title: 'Search History', icon: History },
]
