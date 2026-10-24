import { Link, useLocation } from 'react-router-dom'
import { Menu, LogIn, LogOut } from 'lucide-react'
import { navItems } from '@/data/navigation'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

interface HeaderProps {
  onMenuClick: () => void
  menuOpen: boolean
}

function titleForPath(pathname: string): string {
  if (pathname === '/login') return 'Account Authentication'
  const match = navItems.find((item) =>
    item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`),
  )
  return match?.title ?? 'Page not found'
}

export function Header({ onMenuClick, menuOpen }: HeaderProps) {
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-surface px-4 sm:px-6 lg:px-8">
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

      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        {user ? (
          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-semibold text-ink-900">
                {user.profile?.fullName || user.email.split('@')[0]}
              </p>
              <p className="text-xs text-ink-500 truncate max-w-[180px]">{user.email}</p>
            </div>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full border border-accent-300 bg-accent-50 text-accent-700 font-semibold text-sm"
              aria-label="User profile avatar"
            >
              {(user.profile?.fullName || user.email).charAt(0).toUpperCase()}
            </span>
            <Button
              variant="ghost"
              size="sm"
              icon={<LogOut className="h-4 w-4" />}
              onClick={() => signOut()}
              title="Sign Out"
            >
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-medium text-ink-900">Guest user</p>
              <p className="text-xs text-ink-500">Not signed in</p>
            </div>
            <Link to="/login">
              <Button variant="primary" size="sm" icon={<LogIn className="h-4 w-4" />}>
                Sign In
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
