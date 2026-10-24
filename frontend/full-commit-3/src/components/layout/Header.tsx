import { useLocation } from 'react-router-dom'
import { Menu, User } from 'lucide-react'
import { navItems } from '@/data/navigation'

interface HeaderProps {
  onMenuClick: () => void
  menuOpen: boolean
}

function titleForPath(pathname: string): string {
  const match = navItems.find((item) =>
    item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`),
  )
  return match?.title ?? 'Page not found'
}

export function Header({ onMenuClick, menuOpen }: HeaderProps) {
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-md p-2 text-ink-600 hover:bg-surface-subtle lg:hidden"
          aria-label="Open navigation"
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <p className="text-sm font-semibold text-ink-900">{titleForPath(pathname)}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right leading-tight sm:block">
          <p className="text-sm font-medium text-ink-900">Guest user</p>
          <p className="text-xs text-ink-500">Sign-in not configured</p>
        </div>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line-strong bg-surface-subtle text-ink-600"
          role="img"
          aria-label="User profile placeholder"
        >
          <User className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </header>
  )
}
