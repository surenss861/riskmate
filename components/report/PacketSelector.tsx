/**
 * Packet Selector Component
 * Allows users to select which packet type to export
 */

'use client'

import { useState, useEffect } from 'react'
import type { PacketType } from '@/lib/utils/packets/types'
import { PACKETS } from '@/lib/utils/packets/types'

interface PacketSelectorProps {
  onSelect: (packetType: PacketType) => void
  onCancel: () => void
  isLoading?: boolean
}

// Default to Client Compliance Report (most comprehensive)
const DEFAULT_PACKET: PacketType = 'client_compliance'

export function PacketSelector({ onSelect, onCancel, isLoading }: PacketSelectorProps) {
  const [selectedPacket, setSelectedPacket] = useState<PacketType | null>(DEFAULT_PACKET)

  const handleConfirm = () => {
    if (selectedPacket) {
      onSelect(selectedPacket)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      } else if (e.key === 'Enter' && selectedPacket && !isLoading) {
        handleConfirm()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedPacket, isLoading, onCancel, onSelect])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-lg shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-white mb-2">Select Report Packet</h2>
            <p className="text-sm text-white/60">
              Choose the type of report packet you want to export. Each packet type includes different sections
              tailored for specific use cases.
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="text-white/60 hover:text-white transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 mb-6">
          {Object.entries(PACKETS).map(([key, packet]) => {
            const packetType = key as PacketType
            const isSelected = selectedPacket === packetType

            return (
              <button
                key={packetType}
                onClick={() => setSelectedPacket(packetType)}
                disabled={isLoading}
                className={`w-full text-left p-4 rounded-lg transition-all border-2 ${
                  isSelected
                    ? 'border-[#F97316] bg-[#F97316]/10'
                    : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg text-white">{packet.title}</h3>
                    <p className="text-sm text-white/60 mt-1">
                      Includes: {packet.sections.length} section{packet.sections.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 bg-[#F97316] rounded-full flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-3 h-3 text-black"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 border border-white/10 rounded-lg hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed text-white/70 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedPacket || isLoading}
            className="px-4 py-2 bg-[#F97316] text-black font-semibold rounded-lg hover:bg-[#FB923C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading && (
              <svg
                className="animate-spin h-4 w-4 text-black"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {isLoading ? 'Generating...' : 'Generate Proof Pack'}
          </button>
        </div>
      </div>
    </div>
  )
}

