// src/services/crossReferenceService.ts
import { apiFetch } from './api'

export type InterchangeType = 'direct_drop_in' | 'functional_alternative' | 'requires_adaptation'

export interface FFFScore {
  fit: 'exact' | 'compatible' | 'adapter_required'
  form: 'exact' | 'similar' | 'different'
  function: 'identical' | 'exceeds' | 'limited'
  overallScore: number
}

export interface EquivalentPartMatch {
  id: string
  partNumber: string
  name: string
  manufacturer: string
  category: string
  domain: 'industrial' | 'electronics' | 'automotive'
  interchangeType: InterchangeType
  fffScore: FFFScore
  standardInterface?: string
  keyDifferences: string[]
  safetyNotes?: string
  specs: Array<{ label: string; value: string }>
  availability: 'in_stock' | 'limited' | 'out_of_stock'
  sourceName?: string
  sourceUrl?: string
}

export interface CrossReferenceResult {
  sourcePart: {
    partNumber: string
    manufacturer?: string
    category?: string
    standardSeries?: string
  }
  equivalentsCount: number
  equivalents: EquivalentPartMatch[]
  interchangeStandardNotes?: string
}

export async function lookupEquivalents(query: { partNumber?: string; manufacturer?: string }): Promise<CrossReferenceResult> {
  return apiFetch<CrossReferenceResult>('/api/cross-reference/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  })
}

export async function getEquivalentsForPart(partId: string): Promise<CrossReferenceResult> {
  return apiFetch<CrossReferenceResult>(`/api/cross-reference/${encodeURIComponent(partId)}`)
}
