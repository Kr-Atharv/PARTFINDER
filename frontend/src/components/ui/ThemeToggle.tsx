import { Moon, Sun } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'
import { useTheme } from '@/context/ThemeContext'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <Tooltip content={dark ? 'Switch to light theme' : 'Switch to dark theme'} side="bottom">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={dark}
        aria-label="Dark theme"
        className="rounded-md p-2 text-ink-600 hover:bg-surface-subtle hover:text-ink-900"
      >
        {dark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
      </button>
    </Tooltip>
  )
}
