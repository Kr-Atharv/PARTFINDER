// src/components/vision/PartImageScanner.tsx
import { Camera, CheckCircle2, Image as ImageIcon, Loader2, RefreshCw, ScanLine, Sparkles, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { scanPartImage, VisionOcrResult } from '@/services/visionService'

interface PartImageScannerProps {
  open: boolean
  onClose: () => void
  onApplyResult: (result: VisionOcrResult, mode: 'catalogue' | 'research' | 'fill_only') => void
  onAutoFill?: (result: VisionOcrResult) => void
}

export function PartImageScanner({ open, onClose, onApplyResult, onAutoFill }: PartImageScannerProps) {
  const [mode, setMode] = useState<'camera' | 'upload'>('upload')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [manualText, setManualText] = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VisionOcrResult | null>(null)

  const handleClose = () => {
    if (result) {
      onApplyResult(result, 'fill_only')
    }
    onClose()
  }

  // Camera stream refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!open) {
      stopCamera()
      setImagePreview(null)
      setResult(null)
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (open && mode === 'camera') {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [open, mode])

  const startCamera = async () => {
    setError(null)
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } else {
        setError('Camera access is not supported by your browser. Please upload a photo instead.')
        setMode('upload')
      }
    } catch (err: any) {
      setError('Could not access camera. Please check camera permissions or upload an image.')
      setMode('upload')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  const takeSnapshot = () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      setImagePreview(dataUrl)
      processImage(dataUrl)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setImagePreview(dataUrl)
      processImage(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const processImage = async (dataUrl?: string, textOverride?: string) => {
    setScanning(true)
    setError(null)
    setResult(null)

    try {
      const res = await scanPartImage({
        image: dataUrl || imagePreview || undefined,
        manualText: textOverride !== undefined ? textOverride : manualText,
      })
      setResult(res)
      if (onAutoFill) {
        onAutoFill(res)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze part image')
    } finally {
      setScanning(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl bg-surface border-line shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
              <ScanLine className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-ink-900">AI Part &amp; Nameplate Scanner</h3>
              <p className="text-xs text-ink-500">Capture machine tags, part serials or stamped metal plates</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1.5 text-ink-400 hover:bg-surface-muted hover:text-ink-700"
            aria-label="Close scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Mode Selector */}
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <Button
              variant={mode === 'upload' ? 'primary' : 'ghost'}
              size="sm"
              icon={<Upload className="h-4 w-4" />}
              onClick={() => {
                setMode('upload')
                stopCamera()
              }}
            >
              Upload Photo
            </Button>
            <Button
              variant={mode === 'camera' ? 'primary' : 'ghost'}
              size="sm"
              icon={<Camera className="h-4 w-4" />}
              onClick={() => setMode('camera')}
            >
              Live Camera
            </Button>
          </div>

          {error && (
            <div className="rounded-md bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Camera View */}
          {mode === 'camera' && !imagePreview && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
              <div className="absolute inset-8 border-2 border-dashed border-white/60 rounded-md pointer-events-none flex items-center justify-center">
                <span className="bg-black/50 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur">
                  Align nameplate or part number inside box
                </span>
              </div>
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <Button variant="primary" size="lg" icon={<Camera className="h-5 w-5" />} onClick={takeSnapshot}>
                  Capture Photo
                </Button>
              </div>
            </div>
          )}

          {/* Upload View */}
          {mode === 'upload' && !imagePreview && (
            <div className="space-y-3">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-line-strong hover:border-brand-500 rounded-lg p-6 cursor-pointer bg-surface-subtle transition-colors">
                <ImageIcon className="h-10 w-10 text-ink-400 mb-2" />
                <span className="text-sm font-medium text-ink-800">Click to choose a photo or drag &amp; drop</span>
                <span className="text-xs text-ink-500 mt-1">Supports JPG, PNG, WEBP from phone camera or workbench tag</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-700">Or paste raw nameplate text notes:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Parker D1VW 350 bar 24VDC IP65 S/N 884012"
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    className="flex-1 rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-ink-900 focus:outline-brand-600"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!manualText.trim() || scanning}
                    onClick={() => processImage(undefined, manualText)}
                  >
                    Analyze
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Image Preview & Scanning Status */}
          {imagePreview && (
            <div className="relative aspect-video max-h-56 w-full overflow-hidden rounded-lg bg-surface-muted border border-line flex items-center justify-center">
              <img src={imagePreview} alt="Captured tag preview" className="h-full w-full object-contain" />
              {scanning && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 text-white">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
                  <span className="text-xs font-medium">Extracting part number and ratings via Vision AI...</span>
                </div>
              )}
              {!scanning && (
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null)
                    setResult(null)
                  }}
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                  title="Retake photo"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Recognition Results */}
          {result && (
            <div className="rounded-lg border border-brand-200 bg-brand-50/50 dark:border-brand-900/60 dark:bg-brand-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-800 dark:text-brand-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Nameplate Details Extracted ({Math.round(result.confidence * 100)}% confidence)</span>
                </div>
                <Badge tone="brand">
                  {result.source === 'external_ocr' ? 'Verified Vision API' : 'Industrial OCR Engine'}
                </Badge>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 text-xs">
                <div className="rounded bg-surface p-2 border border-line">
                  <span className="text-ink-400 block text-[10px]">Identified Manufacturer</span>
                  <span className="font-semibold text-ink-900">{result.extracted.manufacturer || 'Auto-detecting...'}</span>
                </div>
                <div className="rounded bg-surface p-2 border border-line">
                  <span className="text-ink-400 block text-[10px]">Identified Part / Model Code</span>
                  <span className="font-mono font-bold text-brand-700 dark:text-brand-400">
                    {result.extracted.partNumber || result.extracted.model || 'Unknown code'}
                  </span>
                </div>
              </div>

              {result.extracted.specs.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-ink-600">Extracted Operating Ratings:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.extracted.specs.map((spec, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded bg-surface px-2 py-0.5 text-xs border border-line text-ink-800 font-mono"
                      >
                        <span className="text-ink-500 font-sans">{spec.label}:</span>
                        <strong>{spec.value}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-brand-200 dark:border-brand-900/40">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onApplyResult(result, 'fill_only')
                    onClose()
                  }}
                >
                  Fill Inboxes Only
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      onApplyResult(result, 'catalogue')
                      onClose()
                    }}
                  >
                    Search in Catalogue
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Sparkles className="h-4 w-4" />}
                    onClick={() => {
                      onApplyResult(result, 'research')
                      onClose()
                    }}
                  >
                    Research Live Web with TinyFish
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
