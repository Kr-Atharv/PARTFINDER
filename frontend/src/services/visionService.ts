// src/services/visionService.ts
import { apiFetch } from './api'

export interface ExtractedSpec {
  label: string
  value: string
  unit?: string
  confidence: number
}

export interface VisionOcrResult {
  detectedText: string
  confidence: number
  extracted: {
    partNumber?: string
    manufacturer?: string
    model?: string
    serialNumber?: string
    category?: string
    specs: ExtractedSpec[]
  }
  suggestedSearchQuery: string
  source: 'external_ocr' | 'nameplate_ai_engine'
}

export async function scanPartImage(payload: { image?: string; manualText?: string }): Promise<VisionOcrResult> {
  return apiFetch<VisionOcrResult>('/api/vision/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
