// src/components/datasheet/DatasheetUploader.tsx
import { FileText, Loader2, RefreshCw, Sparkles, Upload, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DatasheetParseResult, parsePdfDatasheet } from '@/services/datasheetService'

interface DatasheetUploaderProps {
  open: boolean
  onClose: () => void
  onApplySpecs: (result: DatasheetParseResult, mode: 'search' | 'research') => void
}

export function DatasheetUploader({ open, onClose, onApplySpecs }: DatasheetUploaderProps) {
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DatasheetParseResult | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Please select a PDF technical datasheet.')
      return
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('PDF file size exceeds 15MB limit.')
      return
    }

    setFileName(file.name)
    setParsing(true)
    setError(null)
    setResult(null)

    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const base64 = reader.result as string
        const parsed = await parsePdfDatasheet(base64, file.name)
        setResult(parsed)
      } catch (err: any) {
        setError(err.message || 'Failed to parse technical specifications from PDF.')
      } finally {
        setParsing(false)
      }
    }
    reader.onerror = () => {
      setError('Error reading PDF file.')
      setParsing(false)
    }
    reader.readAsDataURL(file)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl bg-surface border-line shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-ink-900">PDF Datasheet &amp; Cut-Sheet Parser</h3>
              <p className="text-xs text-ink-500">Extract technical specs, pressure limits and dimensions automatically</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-400 hover:bg-surface-muted hover:text-ink-700"
            aria-label="Close datasheet parser"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="rounded-md bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}

          {!result && !parsing && (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-line-strong hover:border-brand-500 rounded-lg p-8 cursor-pointer bg-surface-subtle transition-colors">
              <Upload className="h-10 w-10 text-brand-600 mb-2 animate-bounce" />
              <span className="text-sm font-semibold text-ink-800">Upload Manufacturer PDF Datasheet</span>
              <span className="text-xs text-ink-500 mt-1">Drag &amp; drop Parker, Rexroth, SKF, Siemens or any equipment PDF</span>
              <span className="text-[11px] text-ink-400 mt-0.5">Maximum size: 15MB</span>
              <input type="file" accept=".pdf,application/pdf" onChange={handleFileUpload} className="hidden" />
            </label>
          )}

          {parsing && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-9 w-9 animate-spin text-brand-600" />
              <div>
                <p className="text-sm font-semibold text-ink-900">Extracting Technical Specification Matrix...</p>
                <p className="text-xs text-ink-500">Reading dimension tables, electrical ratings &amp; pressure tolerances from {fileName}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              {/* Document Summary Card */}
              <div className="rounded-lg border border-brand-200 bg-brand-50/50 dark:border-brand-900/60 dark:bg-brand-950/20 p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded bg-brand-100 text-brand-700 dark:bg-brand-900/80 dark:text-brand-300">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-ink-900 font-mono">
                      {result.detectedModelCode || result.fileName || 'Extracted Component'}
                    </h4>
                    <p className="text-[11px] text-ink-500">
                      {result.detectedManufacturer || 'Generic Manufacturer'} · {result.detectedCategory} · {result.pageCount} page(s)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null)
                      setFileName(null)
                    }}
                    className="text-xs text-ink-500 hover:text-ink-800 flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Upload another
                  </button>
                </div>
              </div>

              {/* Extracted Specs Table */}
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                <span className="text-xs font-semibold text-ink-700 block">
                  Extracted Specifications ({result.specs.length}):
                </span>
                {result.specs.length === 0 ? (
                  <p className="text-xs text-ink-500 py-3 text-center">
                    No standardized specification tables detected in this document.
                  </p>
                ) : (
                  <div className="rounded-md border border-line divide-y divide-line bg-surface overflow-hidden">
                    {result.specs.map((spec, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-ink-700">{spec.label}</span>
                            {spec.pageNumber && (
                              <span className="text-[10px] bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300 px-1.5 py-0.2 rounded font-mono">
                                p.{spec.pageNumber}
                              </span>
                            )}
                          </div>
                          {spec.evidenceSnippet && (
                            <span className="block text-[10px] text-ink-400 font-mono italic">
                              Found: &quot;{spec.evidenceSnippet}&quot;
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-brand-700 dark:text-brand-300">
                            {spec.value}
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded font-medium">
                            {Math.round(spec.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-line">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onApplySpecs(result, 'search')
                    onClose()
                  }}
                >
                  Apply to Specification Filters
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Sparkles className="h-4 w-4" />}
                  onClick={() => {
                    onApplySpecs(result, 'research')
                    onClose()
                  }}
                >
                  Research Discovered Model Live
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
