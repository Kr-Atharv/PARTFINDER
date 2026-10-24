import { useCallback, useEffect, useState } from 'react'
import { fetchHealth } from '@/services/catalogService'

export type HealthState =
  | { status: 'checking' }
  | { status: 'online'; uptime?: number }
  | { status: 'offline'; message: string }

const POLL_MS = 60_000

/** Real backend reachability from GET /api/health, re-checked every minute and when the browser goes online. */
export function useHealth(): HealthState & { recheck: () => void } {
  const [state, setState] = useState<HealthState>({ status: 'checking' })
  const [nonce, setNonce] = useState(0)
  const recheck = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    const run = async () => {
      try {
        const result = await fetchHealth(controller.signal)
        if (controller.signal.aborted) return
        setState(
          result.status === 'ok' && result.data.status === 'ok'
            ? { status: 'online', uptime: result.data.uptime }
            : { status: 'offline', message: result.status === 'unavailable' ? result.message : 'The server reported a problem.' },
        )
      } catch {
        // aborted on unmount
      }
    }
    run()
    const timer = window.setInterval(run, POLL_MS)
    const onOnline = () => run()
    window.addEventListener('online', onOnline)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      window.removeEventListener('online', onOnline)
    }
  }, [nonce])

  return { ...state, recheck }
}
