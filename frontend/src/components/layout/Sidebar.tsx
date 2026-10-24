import { NavLink } from 'react-router-dom'
import { PackageSearch, X } from 'lucide-react'
import { useCompare } from '@/context/CompareContext'
import { navItems } from '@/data/navigation'
import { cn } from '@/lib/cn'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { count } = useCompare()

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-ink-900/40 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        id="app-sidebar"
        aria-label="Primary"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-white transition-transform duration-200',
          'lg:static lg:z-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-5">
          <NavLink to="/" onClick={onClose} className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600 text-white">
              <PackageSearch className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-semibold text-ink-900">PartFinder</span>
              <span className="block text-xs text-ink-500">Find. Compare. Verify.</span>
            </span>
          </NavLink>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-500 hover:bg-surface-subtle hover:text-ink-900 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wider text-ink-400">
            Workspace
          </p>
          <ul className="space-y-1">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-ink-600 hover:bg-surface-muted hover:text-ink-900',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={cn('h-[18px] w-[18px]', isActive ? 'text-brand-600' : 'text-ink-400')}
                        aria-hidden="true"
                      />
                      {label}
                      {to === '/compare' && count > 0 && (
                        <span
                          className="ml-auto rounded bg-brand-600 px-1.5 py-0.5 font-mono text-xs font-medium text-white"
                          aria-label={`${count} selected`}
                        >
                          {count}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-line px-5 py-4">
          <p className="text-xs leading-relaxed text-ink-500">
            Frontend foundation build. Live-web search is not connected yet.
          </p>
        </div>
      </aside>
    </>
  )
}
