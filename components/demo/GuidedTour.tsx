'use client'

import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface TourStep {
  id: string
  title: string
  description: string
  target: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

interface GuidedTourProps {
  step: number | null
  steps: TourStep[]
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
}

export function GuidedTour({ step, steps, onClose, onNext, onPrevious }: GuidedTourProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (step === null) return

    const currentStep = steps[step]
    if (!currentStep) return

    const targetElement = document.querySelector(currentStep.target)
    if (!targetElement) return

    const rect = targetElement.getBoundingClientRect()
    const tooltip = tooltipRef.current
    if (!tooltip) return

    // Position tooltip relative to target
    const position = currentStep.position
    let top = 0
    let left = 0

    switch (position) {
      case 'top':
        top = rect.top - tooltip.offsetHeight - 10
        left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2
        break
      case 'bottom':
        top = rect.bottom + 10
        left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2
        break
      case 'left':
        top = rect.top + rect.height / 2 - tooltip.offsetHeight / 2
        left = rect.left - tooltip.offsetWidth - 10
        break
      case 'right':
        top = rect.top + rect.height / 2 - tooltip.offsetHeight / 2
        left = rect.right + 10
        break
    }

    tooltip.style.top = `${Math.max(10, top)}px`
    tooltip.style.left = `${Math.max(10, left)}px`

    // Scroll target into view
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })

    // Highlight target
    const highlight = document.createElement('div')
    highlight.style.position = 'absolute'
    highlight.style.top = `${rect.top}px`
    highlight.style.left = `${rect.left}px`
    highlight.style.width = `${rect.width}px`
    highlight.style.height = `${rect.height}px`
    highlight.style.border = '2px solid #F97316'
    highlight.style.borderRadius = '4px'
    highlight.style.pointerEvents = 'none'
    highlight.style.zIndex = '9998'
    highlight.className = 'tour-highlight'
    document.body.appendChild(highlight)

    return () => {
      const existing = document.querySelector('.tour-highlight')
      if (existing) existing.remove()
    }
  }, [step, steps])

  if (step === null) return null

  const currentStep = steps[step]
  if (!currentStep) return null

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-[9997]" onClick={onClose} />
      
      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-[9999] bg-[#0B0C14] border-2 border-[#F97316] rounded-lg p-4 max-w-sm shadow-xl"
      >
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-white">{currentStep.title}</h3>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-white/70 mb-4">{currentStep.description}</p>
        <div className="flex items-center justify-between">
          <div className="text-xs text-white/50">
            Step {step + 1} of {steps.length}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={onPrevious}
                className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 border border-white/20 rounded transition-colors"
              >
                Previous
              </button>
            )}
            {step < steps.length - 1 ? (
              <button
                onClick={onNext}
                className="px-3 py-1.5 text-xs bg-[#F97316] hover:bg-[#FB923C] text-black rounded transition-colors font-medium"
              >
                Next
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs bg-[#F97316] hover:bg-[#FB923C] text-black rounded transition-colors font-medium"
              >
                Finish Tour
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

