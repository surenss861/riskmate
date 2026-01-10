'use client'

import { X, Package, Download, ExternalLink, Clock } from 'lucide-react'
import { useState } from 'react'
import { PackCard } from '@/components/shared'
import { buttonStyles } from '@/lib/styles/design-system'

interface PackHistoryItem {
  packId: string
  packType: 'proof' | 'audit' | 'incident' | 'permit'
  generatedAt: string | Date
  generatedBy: string
  filters?: Record<string, string | number | boolean | null | undefined>
  contents?: {
    ledger_pdf?: boolean
    controls_csv?: boolean
    attestations_csv?: boolean
    evidence_manifest?: boolean
    manifest_json?: boolean
  }
  dataHash?: string
  fileSize?: number
  eventCount?: number
  integrityStatus?: 'verified' | 'unverified' | 'mismatch' | 'pending'
}

interface PackHistoryDrawerProps {
  isOpen: boolean
  onClose: () => void
  packs?: PackHistoryItem[] // Optional: pass packs from parent if available
}

export function PackHistoryDrawer({ isOpen, onClose, packs = [] }: PackHistoryDrawerProps) {
  if (!isOpen) return null

  // TODO: Replace with actual pack history API call when backend is ready
  // For now, this is a placeholder that shows the UI structure
  const packHistory: PackHistoryItem[] = packs.length > 0 
    ? packs 
    : [] // Empty for now until backend implements pack history

  const handleDownload = (packId: string) => {
    // TODO: Implement download functionality when backend is ready
    console.log('Download pack:', packId)
  }

  const handleViewLedger = (packId: string) => {
    // TODO: Navigate to ledger event or highlight it in the audit page
    console.log('View ledger for pack:', packId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1A1A] border border-white/10 rounded-t-lg sm:rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-[#F97316]" />
            <h2 className="text-xl font-semibold text-white">Pack History</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {packHistory.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Package className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Pack History</h3>
              <p className="text-white/60 mb-1">
                Proof packs that have been generated will appear here.
              </p>
              <p className="text-white/40 text-sm">
                Generate a proof pack from the Advanced / Integrations menu to create your first pack.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {packHistory.map((pack) => (
                <PackCard
                  key={pack.packId}
                  packId={pack.packId}
                  packType={pack.packType}
                  generatedAt={pack.generatedAt}
                  generatedBy={pack.generatedBy}
                  filters={pack.filters}
                  contents={pack.contents}
                  dataHash={pack.dataHash}
                  fileSize={pack.fileSize}
                  eventCount={pack.eventCount}
                  integrityStatus={pack.integrityStatus || 'unverified'}
                  onDownload={() => handleDownload(pack.packId)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className={buttonStyles.primary}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

