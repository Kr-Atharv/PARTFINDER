import { Clock, Factory, Flame, Package, Search, Tag } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { isAbort } from '@/services/api'
import { fetchPopular, fetchSuggestions } from '@/services/catalogService'
import type { PopularSearches, Suggestions } from '@/services/catalogService'
import { useRecentSearches } from '@/state/userData'

export const SUGGEST_DEBOUNCE_MS = 250
export const SUGGEST_MIN_CHARS = 2

type OptionKind = 'recent' | 'popular' | 'part' | 'manufacturer' | 'category'

interface SearchOption {
  id: string
  kind: OptionKind
  /** What gets written into the box and searched. */
  value: string
  label: string
  detail?: string
}

const GROUP_LABEL: Record<OptionKind, string> = {
  recent: 'Recent searches (this device)',
  popular: 'Popular searches',
  part: 'Parts',
  manufacturer: 'Manufacturers',
  category: 'Categories',
}

const GROUP_ICON: Record<OptionKind, ReactNode> = {
  recent: <Clock className="h-4 w-4" aria-hidden="true" />,
  popular: <Flame className="h-4 w-4" aria-hidden="true" />,
  part: <Package className="h-4 w-4" aria-hidden="true" />,
  manufacturer: <Factory className="h-4 w-4" aria-hidden="true" />,
  category: <Tag className="h-4 w-4" aria-hidden="true" />,
}

/** Builds the flat option list for the listbox. Exported for tests. */
export function buildOptions(args: {
  typed: string
  recents: Array<{ query: string; kind: string }>
  popular: PopularSearches | null
  suggestions: Suggestions | null
}): SearchOption[] {
  const { typed, recents, popular, suggestions } = args
  const options: SearchOption[] = []
  const seen = new Set<string>()
  const push = (option: SearchOption) => {
    const key = `${option.kind}:${option.value.toLowerCase()}`
    if (!option.value.trim() || seen.has(key)) return
    seen.add(key)
    options.push(option)
  }

  if (typed.trim().length < SUGGEST_MIN_CHARS) {
    recents
      .filter((entry) => entry.query.trim())
      .slice(0, 5)
      .forEach((entry, i) => push({ id: `recent-${i}`, kind: 'recent', value: entry.query, label: entry.query, detail: entry.kind === 'research' ? 'live research' : undefined }))
    if (popular?.available) {
      popular.searches.slice(0, 5).forEach((entry, i) =>
        push({ id: `popular-${i}`, kind: 'popular', value: entry.query, label: entry.query, detail: `${entry.count} ${entry.count === 1 ? 'search' : 'searches'}` }),
      )
    }
    return options
  }

  suggestions?.parts.forEach((part, i) =>
    push({ id: `part-${i}`, kind: 'part', value: part.partNumber || part.name, label: part.name, detail: `${part.partNumber} · ${part.manufacturer}` }),
  )
  suggestions?.manufacturers.forEach((name, i) => push({ id: `mfr-${i}`, kind: 'manufacturer', value: name, label: name }))
  suggestions?.categories.forEach((name, i) => push({ id: `cat-${i}`, kind: 'category', value: name, label: name }))
  return options
}

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  /** Called when a suggestion is chosen; the caller normally runs the search. */
  onSelect: (value: string) => void
  label?: string
  placeholder?: string
  error?: string
  maxLength?: number
}

/**
 * Search input with an ARIA combobox listbox: recent and popular searches when empty, real
 * catalogue suggestions (debounced, cancellable) while typing. Arrow keys move, Enter picks,
 * Escape closes. If the suggestion service is unavailable the box still works as a plain input.
 */
export function SearchBox({ value, onChange, onSelect, label = 'Search', placeholder, error, maxLength }: SearchBoxProps) {
  const baseId = useId()
  const listId = `${baseId}-list`
  const recents = useRecentSearches()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [popular, setPopular] = useState<PopularSearches | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null)
  const [suggestState, setSuggestState] = useState<'idle' | 'loading' | 'unavailable'>('idle')
  const wrapRef = useRef<HTMLDivElement>(null)

  const typed = value.trim()
  const typing = typed.length >= SUGGEST_MIN_CHARS

  // Popular searches are loaded once, the first time the list is opened.
  const popularRequested = useRef(false)
  useEffect(() => {
    if (!open || popularRequested.current) return
    popularRequested.current = true
    fetchPopular()
      .then((result) => setPopular(result.status === 'ok' ? result.data : null))
      .catch(() => undefined)
  }, [open])

  // Debounced, cancellable suggestions.
  useEffect(() => {
    if (!typing) {
      setSuggestions(null)
      setSuggestState('idle')
      return
    }
    const controller = new AbortController()
    setSuggestState('loading')
    const timer = window.setTimeout(() => {
      fetchSuggestions(typed, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return
          if (result.status === 'ok') {
            setSuggestions(result.data)
            setSuggestState('idle')
          } else {
            setSuggestions(null)
            setSuggestState('unavailable')
          }
        })
        .catch((err) => {
          if (!isAbort(err)) setSuggestState('unavailable')
        })
    }, SUGGEST_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [typed, typing])

  const options = useMemo(() => buildOptions({ typed, recents, popular, suggestions }), [typed, recents, popular, suggestions])

  useEffect(() => setActive(-1), [options])

  // Close when focus leaves the whole widget.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const choose = (option: SearchOption) => {
    onChange(option.value)
    setOpen(false)
    setActive(-1)
    onSelect(option.value)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) setOpen(true)
      if (options.length > 0) setActive((i) => (i + 1) % options.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) setOpen(true)
      if (options.length > 0) setActive((i) => (i <= 0 ? options.length - 1 : i - 1))
    } else if (event.key === 'Enter') {
      if (open && active >= 0 && options[active]) {
        event.preventDefault() // pick the option instead of submitting the typed text
        choose(options[active])
      }
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault()
        setOpen(false)
        setActive(-1)
      }
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  const showList = open && (options.length > 0 || typing)
  const grouped: Array<{ kind: OptionKind; items: Array<SearchOption & { index: number }> }> = []
  options.forEach((option, index) => {
    const last = grouped[grouped.length - 1]
    if (last && last.kind === option.kind) last.items.push({ ...option, index })
    else grouped.push({ kind: option.kind, items: [{ ...option, index }] })
  })

  return (
    <div ref={wrapRef} className="relative">
      <Input
        label={label}
        placeholder={placeholder}
        icon={<Search className="h-4 w-4" aria-hidden="true" />}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        error={error}
        maxLength={maxLength}
        autoComplete="off"
        enterKeyHint="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${baseId}-opt-${active}` : undefined}
      />

      {/* Announced politely so screen-reader users know suggestions appeared. */}
      <p className="sr-only" role="status" aria-live="polite">
        {showList
          ? options.length > 0
            ? `${options.length} suggestion${options.length === 1 ? '' : 's'} available. Use up and down arrows to review.`
            : suggestState === 'loading'
              ? 'Loading suggestions'
              : ''
          : ''}
      </p>

      <div
        className={cn(
          'absolute left-0 right-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-md border border-line-strong bg-surface shadow-pop',
          !showList && 'hidden',
        )}
      >
        <ul id={listId} role="listbox" aria-label={`${label} suggestions`}>
          {grouped.map((group) => (
            <li key={group.kind} role="presentation">
              <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-500" role="presentation">
                {GROUP_LABEL[group.kind]}
              </p>
              <ul role="presentation">
                {group.items.map((option) => (
                  <li
                    key={option.id}
                    id={`${baseId}-opt-${option.index}`}
                    role="option"
                    aria-selected={option.index === active}
                    onPointerDown={(event) => event.preventDefault() /* keep input focus */}
                    onClick={() => choose(option)}
                    onMouseMove={() => setActive(option.index)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-ink-800',
                      option.index === active && 'bg-brand-50 text-brand-700',
                    )}
                  >
                    <span className="text-ink-400">{GROUP_ICON[option.kind]}</span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.detail && <span className="shrink-0 truncate text-xs text-ink-500">{option.detail}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {typing && suggestState === 'loading' && options.length === 0 && (
          <p className="px-3 py-2.5 text-sm text-ink-500">Looking for suggestions…</p>
        )}
        {typing && suggestState === 'unavailable' && (
          <p className="px-3 py-2.5 text-sm text-ink-500">Suggestions are unavailable right now. You can still press Enter to search.</p>
        )}
        {typing && suggestState === 'idle' && options.length === 0 && (
          <p className="px-3 py-2.5 text-sm text-ink-500">No catalogue suggestions. Press Enter to search anyway.</p>
        )}
      </div>
    </div>
  )
}
