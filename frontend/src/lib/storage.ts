import { useSyncExternalStore } from 'react'

/**
 * Tiny localStorage-backed store with cross-tab sync.
 *
 * Everything it persists lives only in this browser. Reads are validated by a
 * `sanitize` function so corrupted or hand-edited storage can never crash the app.
 */
export interface PersistentStore<T> {
  get: () => T
  set: (next: T | ((prev: T) => T)) => void
  subscribe: (listener: () => void) => () => void
  use: () => T
  /** Test hook: re-read storage and notify. */
  reload: () => void
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readJson<T>(key: string, fallback: T, sanitize: (raw: unknown) => T): T {
  const storage = safeStorage()
  if (!storage) return fallback
  try {
    const raw = storage.getItem(key)
    if (raw === null) return fallback
    return sanitize(JSON.parse(raw))
  } catch {
    return fallback
  }
}

/** Returns false when the value could not be written (quota, private mode). */
export function writeJson(key: string, value: unknown): boolean {
  const storage = safeStorage()
  if (!storage) return false
  try {
    storage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function createPersistentStore<T>(
  key: string,
  initial: T,
  sanitize: (raw: unknown) => T,
): PersistentStore<T> {
  let state = readJson(key, initial, sanitize)
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((listener) => listener())

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === key) {
        state = readJson(key, initial, sanitize)
        emit()
      }
    })
  }

  const store: PersistentStore<T> = {
    get: () => state,
    set(next) {
      state = typeof next === 'function' ? (next as (prev: T) => T)(state) : next
      writeJson(key, state)
      emit()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    use: () => useSyncExternalStore(store.subscribe, store.get, store.get),
    reload() {
      state = readJson(key, initial, sanitize)
      emit()
    },
  }
  return store
}
