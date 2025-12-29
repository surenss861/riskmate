/**
 * Packet Selector Component
 * Allows users to select which packet type to export
 */

'use client'

import { useState } from 'react'
import type { PacketType } from '@/lib/utils/packets/types'
import { PACKETS } from '@/lib/utils/packets/types'

interface PacketSelectorProps {
  onSelect: (packetType: PacketType) => void
  onCancel: () => void
  isLoading?: boolean
}

export function PacketSelector({ onSelect, onCancel, isLoading }: PacketSelectorProps) {
  const [selectedPacket, setSelectedPacket] = useState<PacketType | null>(null)

  const handleConfirm = () => {
    if (selectedPacket) {
      onSelect(selectedPacket)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Select Report Packet</h2>
        <p className="text-gray-600 mb-6">
          Choose the type of report packet you want to export. Each packet type includes different sections
          tailored for specific use cases.
        </p>

        <div className="space-y-3 mb-6">
          {Object.entries(PACKETS).map(([key, packet]) => {
            const packetType = key as PacketType
            const isSelected = selectedPacket === packetType

            return (
              <button
                key={packetType}
                onClick={() => setSelectedPacket(packetType)}
                disabled={isLoading}
                className={`w-full text-left p-4 border-2 rounded-lg transition-all ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{packet.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Includes: {packet.sections.length} section{packet.sections.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
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

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedPacket || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating...' : 'Export Report'}
          </button>
        </div>
      </div>
    </div>
  )
}

