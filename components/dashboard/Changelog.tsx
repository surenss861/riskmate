'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'

interface ChangelogEntry {
  id: string
  date: string
  version: string
  title: string
  description: string
  type: 'feature' | 'improvement' | 'fix'
}

const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    id: '1',
    date: '2024-11-28',
    version: '2.0.0',
    title: 'Enhanced Dashboard & Inline Editing',
    description: 'Added mission control dashboard overview, inline editing for job names and status, and comprehensive microcopy throughout the app.',
    type: 'feature',
  },
  {
    id: '2',
    date: '2024-11-27',
    version: '1.9.0',
    title: 'Permit Pack Generator',
    description: 'Business plan users can now generate comprehensive ZIP bundles containing all job documents, photos, and compliance materials.',
    type: 'feature',
  },
  {
    id: '3',
    date: '2024-11-26',
    version: '1.8.0',
    title: 'Plan Management & Tracking',
    description: 'Added plan switching, upgrade/downgrade flows, and comprehensive plan tracking for analytics.',
    type: 'feature',
  },
  {
    id: '4',
    date: '2024-11-25',
    version: '1.7.0',
    title: 'Multi-Tenant Data Isolation',
    description: 'Implemented true multi-tenant architecture with Row Level Security, ensuring complete data isolation between organizations.',
    type: 'improvement',
  },
  {
    id: '5',
    date: '2024-11-24',
    version: '1.6.0',
    title: 'PDF Generation Improvements',
    description: 'Enhanced PDF reports with better layout, photo grids, and comprehensive job documentation.',
    type: 'improvement',
  },
]

export function Changelog() {
  const [expanded, setExpanded] = useState(false)

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'feature':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'improvement':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'fix':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      default:
        return 'bg-white/10 text-white/70 border-white/10'
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">What&apos;s New</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Recent updates and improvements to Riskmate
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-[#F97316] hover:text-[#FB923C] transition-colors"
        >
          {expanded ? 'Show Less' : 'Show All'}
        </button>
      </div>

      <div className="space-y-4">
        {(expanded ? CHANGELOG_ENTRIES : CHANGELOG_ENTRIES.slice(0, 3)).map((entry, index) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="border-l-2 border-white/10 pl-4 py-2"
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded border ${getTypeColor(entry.type)}`}>
                    {entry.type}
                  </span>
                  <span className="text-xs text-white/50">{entry.version}</span>
                </div>
                <h4 className="text-sm font-semibold text-white">{entry.title}</h4>
              </div>
              <span className="text-xs text-white/40 whitespace-nowrap">
                {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <p className="text-xs text-white/60">{entry.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

