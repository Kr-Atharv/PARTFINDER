// src/services/datasheetService.ts
import { apiFetch } from './api'

export interface ParsedDatasheetSpec {
  label: string
  value: string
  unit?: string
  confidence: number
  evidenceSnippet?: string
  pageNumber?: number
}

export interface DatasheetParseResult {
  fileName?: string
  pageCount: number
  detectedTitle?: string
  detectedManufacturer?: string
  detectedModelCode?: string
  detectedCategory?: string
  specs: ParsedDatasheetSpec[]
  rawTextPreview: string
  suggestedSearchQuery: string
}

export async function parsePdfDatasheet(fileBase64: string, fileName?: string): Promise<DatasheetParseResult> {
  return apiFetch<DatasheetParseResult>('/api/datasheets/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64, fileName }),
  })
}
