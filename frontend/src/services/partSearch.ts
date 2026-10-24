import { sampleParts } from '@/data/sampleParts'
import { matchParts } from '@/lib/search'
import type { Part, SearchCriteria } from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

/**
 * Search service boundary.
 *
 * Connects to the backend REST API `/api/parts/search`.
 * Falls back safely to local catalogue if the server is offline or unreachable,
 * guaranteeing zero UI regressions during development or testing.
 */
export async function searchParts(criteria: SearchCriteria): Promise<Part[]> {
  try {
    const params = new URLSearchParams()
    if (criteria.query) params.set('query', criteria.query)
    if (criteria.domain) params.set('domain', criteria.domain)
    if (criteria.manufacturer) params.set('manufacturer', criteria.manufacturer)
    if (criteria.model) params.set('model', criteria.model)

    const url = `${API_BASE_URL}/api/parts/search?${params.toString()}`
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`)
    }

    const json = await res.json()
    if (json.data && Array.isArray(json.data.results)) {
      return json.data.results
    }
  } catch (err) {
    console.warn('Backend search API unavailable, falling back to local demo catalogue:', err)
  }

  // Graceful fallback to preserve offline functionality
  return matchParts(sampleParts, criteria)
}

/**
 * Synchronous part finder preserving immediate synchronous callers.
 */
export function getPartById(id: string): Part | undefined {
  return sampleParts.find((part) => part.id === id)
}

/**
 * Asynchronous part fetcher from backend `/api/parts/:id`.
 */
export async function fetchPartById(id: string): Promise<Part | undefined> {
  try {
    const url = `${API_BASE_URL}/api/parts/${encodeURIComponent(id)}`
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (res.ok) {
      const json = await res.json()
      if (json.data) {
        return json.data
      }
    }
  } catch (err) {
    console.warn(`Backend getPartById(${id}) failed, falling back to local catalogue:`, err)
  }

  return getPartById(id)
}

/**
 * Fetch multiple parts for comparison from `/api/parts/compare?ids=...`
 */
export async function fetchPartsForCompare(ids: string[]): Promise<Part[]> {
  if (ids.length === 0) return []

  try {
    const url = `${API_BASE_URL}/api/parts/compare?ids=${encodeURIComponent(ids.join(','))}`
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (res.ok) {
      const json = await res.json()
      if (Array.isArray(json.data)) {
        return json.data
      }
    }
  } catch (err) {
    console.warn('Backend compare API unavailable, falling back to local catalogue:', err)
  }

  return sampleParts.filter((p) => ids.includes(p.id))
}
