/**
 * PackCard - Pack ID, filters, contents, hashes, download
 * 
 * Shows proof pack metadata and verification info
 * Used in proof pack generation results and history
 */

'use client'

import React from 'react'
import { Package, Download, CheckCircle2, FileText, Hash, Calendar, Filter } from 'lucide-react'
import { Badge } from './Badge'
import { ActionButton } from './ActionButton'
import { IntegrityBadge, type IntegrityStatus } from './IntegrityBadge'

// Locked type unions (reuse everywhere)
export type PackType = 'proof' | 'insurance' | 'audit' | 'incident' | 'compliance'

export interface PackContents {
  ledger_pdf?: boolean
  controls_csv?: boolean
  attestations_csv?: boolean
  evidence_manifest?: boolean
  manifest_json?: boolean
  attachments?: number
}

export interface PackCardProps {
  packId: string
  packType: PackType
  generatedAt: string | Date // Accept both, normalize internally
  generatedBy?: string
  filters?: Record<string, string | number | boolean | null | undefined> // Render-safe type
  contents?: Partial<PackContents> // Optional + tolerant
  dataHash?: string
  fileSize?: number // in bytes
  eventCount?: number
  integrityStatus?: IntegrityStatus // Reuse from IntegrityBadge
  downloadUrl?: string
  onDownload?: () => void | Promise<void>
  className?: string
}

/**
 * PackCard - Proof pack metadata and verification card
 * 
 * @example
 * ```tsx
 * <PackCard
 *   packId="pack_abc123"
 *   packType="proof"
 *   generatedAt="2025-01-10T12:00:00Z"
 *   generatedBy="John Doe"
 *   filters={{ view: 'insurance-ready', timeRange: '30d' }}
 *   contents={{
 *     ledger_pdf: true,
 *     controls_csv: true,
 *     attestations_csv: true,
 *     evidence_manifest: true,
 *     attachments: 5,
 *   }}
 *   dataHash="sha256:abc123..."
 *   fileSize={1024000}
 *   eventCount={42}
 *   integrityStatus="verified"
 *   onDownload={async () => {}}
 * />
 * ```
 */
export function PackCard({
  packId,
  packType,
  generatedAt,
  generatedBy,
  filters,
  contents,
  dataHash,
  fileSize,
  eventCount,
  integrityStatus = 'unverified',
  downloadUrl,
  onDownload,
  className,
}: PackCardProps) {
  // Normalize generatedAt (accept both string and Date)
  const generatedDate = typeof generatedAt === 'string' ? new Date(generatedAt) : generatedAt
  
  // Default empty filters/contents if not provided
  const packFilters = filters || {}
  const packContents = contents || {}

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getPackTypeLabel = () => {
    switch (packType) {
      case 'proof':
        return 'Proof Pack'
      case 'insurance':
        return 'Insurance Pack'
      case 'audit':
        return 'Audit Pack'
      case 'incident':
        return 'Incident Pack'
      case 'compliance':
        return 'Compliance Pack'
      default:
        return 'Pack'
    }
  }

  type ContentsItem = { name: string; icon: React.ReactElement }
  const contentsList: ContentsItem[] = [
    packContents.ledger_pdf ? { name: 'Ledger PDF', icon: <FileText className="w-3 h-3" /> } : null,
    packContents.controls_csv ? { name: 'Controls CSV', icon: <FileText className="w-3 h-3" /> } : null,
    packContents.attestations_csv ? { name: 'Attestations CSV', icon: <FileText className="w-3 h-3" /> } : null,
    packContents.evidence_manifest ? { name: 'Evidence Manifest', icon: <FileText className="w-3 h-3" /> } : null,
    packContents.manifest_json ? { name: 'Manifest JSON', icon: <FileText className="w-3 h-3" /> } : null,
    packContents.attachments ? { name: `${packContents.attachments} attachments`, icon: <Package className="w-3 h-3" /> } : null,
  ].filter((item): item is ContentsItem => item !== null)

  return (
    <div className={`p-4 bg-white/5 border border-white/10 rounded-lg space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-5 h-5 text-white/80" />
            <h3 className="font-semibold text-white">{getPackTypeLabel()}</h3>
            <Badge variant="neutral" className="text-xs">
              {packType}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <code className="font-mono">{packId.slice(0, 16)}...</code>
            {integrityStatus && (
              <IntegrityBadge 
                status={integrityStatus}
                className="ml-2"
              />
            )}
          </div>
        </div>
        {onDownload && (
          <ActionButton
            onClick={() => onDownload?.()}
            variant="secondary"
            icon={<Download className="w-4 h-4" />}
          >
            Download
          </ActionButton>
        )}
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-center gap-2 text-white/70">
          <Calendar className="w-3 h-3 text-white/50" />
          <div>
            <div className="text-white/50">Generated</div>
            <div className="font-medium">{generatedDate.toLocaleDateString()}</div>
          </div>
        </div>
        {generatedBy && (
          <div className="flex items-center gap-2 text-white/70">
            <FileText className="w-3 h-3 text-white/50" />
            <div>
              <div className="text-white/50">By</div>
              <div className="font-medium">{generatedBy}</div>
            </div>
          </div>
        )}
        {eventCount !== undefined && (
          <div className="flex items-center gap-2 text-white/70">
            <FileText className="w-3 h-3 text-white/50" />
            <div>
              <div className="text-white/50">Events</div>
              <div className="font-medium">{eventCount.toLocaleString()}</div>
            </div>
          </div>
        )}
        {fileSize && (
          <div className="flex items-center gap-2 text-white/70">
            <Package className="w-3 h-3 text-white/50" />
            <div>
              <div className="text-white/50">Size</div>
              <div className="font-medium">{formatFileSize(fileSize)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      {(packFilters.view || packFilters.category || packFilters.timeRange) && (
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-white/60 mb-2">
            <Filter className="w-3 h-3" />
            <span className="font-medium">Filters:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {packFilters.view && (
              <Badge variant="neutral" className="text-xs">
                View: {String(packFilters.view)}
              </Badge>
            )}
            {packFilters.category && (
              <Badge variant="neutral" className="text-xs">
                Category: {String(packFilters.category)}
              </Badge>
            )}
            {packFilters.timeRange && (
              <Badge variant="neutral" className="text-xs">
                Range: {String(packFilters.timeRange)}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Contents */}
      {contentsList.length > 0 && (
        <div className="pt-2 border-t border-white/10">
          <div className="text-xs text-white/60 mb-2 font-medium">Contents:</div>
          <div className="flex flex-wrap gap-2">
            {contentsList.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 text-xs px-2 py-1 bg-white/5 rounded border border-white/10"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-white/80">{item.name}</span>
                {item.icon}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Hash (fingerprint) */}
      {dataHash && (
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-white/60 mb-1">
            <Hash className="w-3 h-3" />
            <span className="font-medium">Fingerprint:</span>
          </div>
          <code className="block text-xs font-mono text-white/70 bg-white/5 px-2 py-1 rounded border border-white/10 break-all">
            {dataHash}
          </code>
        </div>
      )}
    </div>
  )
}

