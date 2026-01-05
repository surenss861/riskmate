'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/shared'
import { colors } from '@/lib/design-system/tokens'
import { formatPdfTimestamp } from '@/lib/utils/pdfFormatUtils'
import { X, Copy, Check } from 'lucide-react'

export interface SignatureData {
  signatureSvg: string
  signerName: string
  signerTitle: string
}

interface SignatureCaptureProps {
  onSave: (data: SignatureData) => void
  onCancel: () => void
  signerName?: string
  signerTitle?: string
  role: 'prepared_by' | 'reviewed_by' | 'approved_by' | 'other'
  reportRunId?: string | null
  reportRunHash?: string | null
  reportRunCreatedAt?: string | null
}

const ROLE_LABELS: Record<string, string> = {
  prepared_by: 'Prepared By',
  reviewed_by: 'Reviewed By',
  approved_by: 'Approved By',
  other: 'Signature',
}

export function SignatureCapture({
  onSave,
  onCancel,
  signerName: initialSignerName = '',
  signerTitle: initialSignerTitle = '',
  role,
  reportRunId,
  reportRunHash,
  reportRunCreatedAt,
}: SignatureCaptureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [signerName, setSignerName] = useState(initialSignerName)
  const [signerTitle, setSignerTitle] = useState(initialSignerTitle)
  const [attestationAccepted, setAttestationAccepted] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [copiedHash, setCopiedHash] = useState(false)
  const pathsRef = useRef<Array<Array<{ x: number; y: number }>>>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set up canvas
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = colors.black
    ctx.lineWidth = 2

    // Redraw all paths
    const redraw = () => {
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
      pathsRef.current.forEach((path) => {
        if (path.length === 0) return
        ctx.beginPath()
        ctx.moveTo(path[0].x, path[0].y)
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].x, path[i].y)
        }
        ctx.stroke()
      })
    }

    redraw()
  }, [])

  const getPoint = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0]
      return {
        x: (touch.clientX - rect.left) * dpr,
        y: (touch.clientY - rect.top) * dpr,
      }
    } else {
      return {
        x: (e.clientX - rect.left) * dpr,
        y: (e.clientY - rect.top) * dpr,
      }
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setIsDrawing(true)
    const point = getPoint(e)
    if (point) {
      pathsRef.current.push([point])
      setHasSignature(true)
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    e.preventDefault()

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const point = getPoint(e)
    if (!point) return

    const currentPath = pathsRef.current[pathsRef.current.length - 1]
    if (!currentPath) return

    currentPath.push(point)

    // Draw line
    const dpr = window.devicePixelRatio || 1
    if (currentPath.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(currentPath[currentPath.length - 2].x / dpr, currentPath[currentPath.length - 2].y / dpr)
      ctx.lineTo(currentPath[currentPath.length - 1].x / dpr, currentPath[currentPath.length - 1].y / dpr)
      ctx.stroke()
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    pathsRef.current = []
    setHasSignature(false)
  }

  const exportToSvg = (): string => {
    const canvas = canvasRef.current
    if (!canvas || pathsRef.current.length === 0) return ''

    const dpr = window.devicePixelRatio || 1
    const width = canvas.width / dpr
    const height = canvas.height / dpr

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    
    pathsRef.current.forEach((path) => {
      if (path.length === 0) return
      let pathData = `M ${path[0].x / dpr} ${path[0].y / dpr}`
      for (let i = 1; i < path.length; i++) {
        pathData += ` L ${path[i].x / dpr} ${path[i].y / dpr}`
      }
      svg += `<path d="${pathData}" fill="none" stroke="${colors.black}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    })
    
    svg += '</svg>'
    return svg
  }

  const handleCopyHash = async () => {
    if (!reportRunHash) return
    try {
      await navigator.clipboard.writeText(reportRunHash)
      setCopiedHash(true)
      setTimeout(() => setCopiedHash(false), 2000)
    } catch (err) {
      console.error('Failed to copy hash:', err)
    }
  }

  const handleSave = () => {
    if (!hasSignature) {
      alert('Please provide a signature')
      return
    }
    if (!signerName.trim()) {
      alert('Please enter your full legal name')
      return
    }
    if (!signerTitle.trim()) {
      alert('Please enter your title/role')
      return
    }
    if (!attestationAccepted) {
      alert('Please accept the attestation statement')
      return
    }

    const svg = exportToSvg()
    onSave({
      signatureSvg: svg,
      signerName: signerName.trim(),
      signerTitle: signerTitle.trim(),
    })
  }

  const shortHash = reportRunHash 
    ? `${reportRunHash.substring(0, 8)}…${reportRunHash.substring(reportRunHash.length - 6)}`
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-bold text-white">Sign as {ROLE_LABELS[role]}</h2>
            {reportRunId && (
              <p className="text-sm text-white/60 mt-1">Report Run #{reportRunId.substring(0, 8)}</p>
            )}
          </div>
          <button
            onClick={onCancel}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Run Information */}
          {reportRunId && (reportRunHash || reportRunCreatedAt) && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
              <div className="text-sm text-white/80 font-medium">Run Information</div>
              {reportRunCreatedAt && (
                <div className="text-xs text-white/60">
                  Created: {formatPdfTimestamp(reportRunCreatedAt)}
                </div>
              )}
              {reportRunHash && (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="text-xs text-white/60 mb-1">Integrity Hash (SHA-256)</div>
                    <div className="font-mono text-sm text-white/90">{shortHash}</div>
                  </div>
                  <button
                    onClick={handleCopyHash}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white/80 text-xs flex items-center gap-1.5 transition-colors"
                    title="Copy full hash"
                  >
                    {copiedHash ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              )}
              <div className="text-xs text-white/50 border-t border-white/10 pt-3">
                This signature applies only to this run. The run data is frozen and immutable.
              </div>
            </div>
          )}

          {/* Attestation Statement */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="attestation"
                checked={attestationAccepted}
                onChange={(e) => setAttestationAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-[#F97316] focus:ring-[#F97316] focus:ring-2"
                required
              />
              <label htmlFor="attestation" className="text-sm text-white/90 flex-1">
                <span className="font-medium">I attest this report is accurate to the best of my knowledge.</span>
                <span className="text-white/60 block mt-1">
                  By signing, you confirm the information in this report run reflects the conditions observed and documented.
                </span>
              </label>
            </div>
          </div>

          {/* Signature Canvas */}
          <div>
            <label className="block text-sm font-medium mb-2 text-white/80">
              Signature <span className="text-white/50">(draw or type name below)</span>
            </label>
            <div className="border-2 border-white/20 rounded-lg bg-white">
              <canvas
                ref={canvasRef}
                className="w-full h-48 cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            {hasSignature && (
              <button
                type="button"
                onClick={clear}
                className="mt-2 text-sm text-white/60 hover:text-white/90 transition-colors"
              >
                Clear signature
              </button>
            )}
          </div>

          {/* Signer Information */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">
                Full Legal Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-white/80">
                Title / Role <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={signerTitle}
                onChange={(e) => setSignerTitle(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]"
                placeholder="Site Supervisor"
                required
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 justify-end p-6 border-t border-white/10">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSave} 
            disabled={!hasSignature || !signerName.trim() || !signerTitle.trim() || !attestationAccepted}
          >
            Sign & Lock
          </Button>
        </div>
      </div>
    </div>
  )
}
