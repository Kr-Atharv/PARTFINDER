import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { CompareTray } from '@/components/compare/CompareTray'
import { useCompare } from '@/context/CompareContext'
import { useToast } from '@/context/ToastContext'
import { cn } from '@/lib/cn'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()
  const { count } = useCompare()
  const showTray = count > 0 && pathname !== '/compare'
  const { notify } = useToast()
  const mainRef = useRef<HTMLElement>(null)

  // Tell the person when the browser loses or regains its connection.
  useEffect(() => {
    const onOffline = () =>
      notify({
        tone: 'warning',
        title: 'You are offline',
        description: 'Searches and research need a connection. Saved parts and history on this device still work.',
        duration: 0,
      })
    const onOnline = () => notify({ tone: 'success', title: 'Back online' })
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [notify])

  // Move focus to the page content after route changes so keyboard and screen-reader users start at the top.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    mainRef.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  }, [pathname])

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Close the mobile drawer with Escape.
  useEffect(() => {
    if (!sidebarOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sidebarOpen])

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} menuOpen={sidebarOpen} />
        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          className={cn('flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8', showTray && 'pb-28')}
        >
          <div className="mx-auto w-full max-w-6xl">
            {/* Keyed by path so navigating away from a crashed page recovers. */}
            <ErrorBoundary key={pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
      {showTray && <CompareTray />}
    </div>
  )
}
