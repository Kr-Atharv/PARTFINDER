import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'partfinder.theme'

function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function initialTheme(): { theme: Theme; explicit: boolean } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return { theme: saved, explicit: true }
  } catch {
    // ignore
  }
  return { theme: systemTheme(), explicit: false }
}

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark')
  }, [state.theme])

  // Follow the operating-system setting until the person makes an explicit choice.
  useEffect(() => {
    if (state.explicit || !window.matchMedia) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setState({ theme: media.matches ? 'dark' : 'light', explicit: false })
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [state.explicit])

  const toggle = useCallback(() => {
    setState((prev) => {
      const next: Theme = prev.theme === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Theme still changes for this session.
      }
      return { theme: next, explicit: true }
    })
  }, [])

  const value = useMemo(() => ({ theme: state.theme, toggle }), [state.theme, toggle])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
