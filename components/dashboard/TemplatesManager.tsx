'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

interface Template {
  id: string
  name: string
  type: 'hazard' | 'mitigation' | 'job'
  data: any
  created_at: string
}

interface TemplatesManagerProps {
  organizationId: string
}

export function TemplatesManager({ organizationId }: TemplatesManagerProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [activeTab, setActiveTab] = useState<'hazard' | 'mitigation' | 'job'>('hazard')
  const [showCreateModal, setShowCreateModal] = useState(false)

  return (
    <div className="rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Templates</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Create reusable presets for hazards, mitigations, and job types to speed up your workflow.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold text-sm transition-colors"
        >
          + New Template
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/10">
        {(['hazard', 'mitigation', 'job'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-[#F97316] border-b-2 border-[#F97316]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)} Templates
          </button>
        ))}
      </div>

      {/* Templates List */}
      <div className="space-y-3">
        {templates.filter((t) => t.type === activeTab).length === 0 ? (
          <div className="text-center py-8 border border-white/10 rounded-lg bg-black/20">
            <p className="text-sm text-white/50 mb-2">No templates yet</p>
            <p className="text-xs text-white/40">
              Create your first {activeTab} template to get started
            </p>
          </div>
        ) : (
          templates
            .filter((t) => t.type === activeTab)
            .map((template) => (
              <div
                key={template.id}
                className="p-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{template.name}</h4>
                    <p className="text-xs text-white/50 mt-1">
                      Created {new Date(template.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1 text-xs text-white/70 hover:text-white border border-white/10 rounded hover:bg-white/5 transition-colors">
                      Use
                    </button>
                    <button className="px-3 py-1 text-xs text-white/70 hover:text-white border border-white/10 rounded hover:bg-white/5 transition-colors">
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  )
}

