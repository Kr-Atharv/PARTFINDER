import { sampleParts } from '@/data/sampleParts'
import { matchParts } from '@/lib/search'
import type { Part, SearchCriteria } from '@/types'

/**
 * Search service boundary.
 *
 * Today this searches the local demo catalogue. It is async on purpose, so a
 * backend implementation can replace the body without changing any caller.
 * There is no artificial delay: it resolves as soon as the local search ends.
 */
export async function searchParts(criteria: SearchCriteria): Promise<Part[]> {
  return matchParts(sampleParts, criteria)
}

export function getPartById(id: string): Part | undefined {
  return sampleParts.find((part) => part.id === id)
}
