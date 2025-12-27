'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/lib/design-system/components/Button'
import { colors } from '@/lib/design-system/tokens'

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
}

export function SignatureCapture({
  onSave,
  onCancel,
  signerName: initialSignerName = '',
  signerTitle: initialSignerTitle = '',
  role,
}: SignatureCaptureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [signerName, setSignerName] = useState(initialSignerName)
  const [signerTitle, setSignerTitle] = useState(initialSignerTitle)
  const [confirmCheckbox, setConfirmCheckbox] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
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
    if (!confirmCheckbox) {
      alert('Please confirm that this report reflects the job conditions observed')
      return
    }

    const svg = exportToSvg()
    onSave({
      signatureSvg: svg,
      signerName: signerName.trim(),
      signerTitle: signerTitle.trim(),
    })
  }

  const roleLabels: Record<string, string> = {
    prepared_by: 'Prepared By',
    reviewed_by: 'Reviewed By',
    approved_by: 'Approved By',
    other: 'Signature',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl p-6 m-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-black">{roleLabels[role]}</h2>

        {/* Signature Canvas */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Sign here
          </label>
          <div className="border-2 border-gray-300 rounded-lg bg-white">
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
          <button
            type="button"
            onClick={clear}
            className="mt-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Clear
          </button>
        </div>

        {/* Signer Information */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Full Legal Name *
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Title / Role *
            </label>
            <input
              type="text"
              value={signerTitle}
              onChange={(e) => setSignerTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Site Supervisor"
              required
            />
          </div>

          <div className="flex items-start">
            <input
              type="checkbox"
              id="confirm"
              checked={confirmCheckbox}
              onChange={(e) => setConfirmCheckbox(e.target.checked)}
              className="mt-1 mr-2"
            />
            <label htmlFor="confirm" className="text-sm text-gray-700">
              I confirm this report reflects the job conditions observed. *
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasSignature || !signerName.trim() || !signerTitle.trim() || !confirmCheckbox}>
            Save Signature
          </Button>
        </div>
      </div>
    </div>
  )
}

