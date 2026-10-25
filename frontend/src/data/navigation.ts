import { Bookmark, GitCompareArrows, History, LayoutDashboard, PackageSearch } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  title: string
  icon: LucideIcon
  /** Match only the exact path (used for the Dashboard route). */
  end?: boolean
}

export const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', title: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/find', label: 'Find Parts', title: 'Find Parts', icon: PackageSearch, end: true },
  { to: '/compare', label: 'Compare Parts', title: 'Compare Parts', icon: GitCompareArrows },
  { to: '/saved', label: 'Saved Parts', title: 'Saved Parts', icon: Bookmark },
  { to: '/history', label: 'Search History', title: 'Search History', icon: History },
]
