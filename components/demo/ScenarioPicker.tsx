'use client'

import { useDemo } from '@/lib/demo/useDemo'
import type { DemoScenario } from '@/lib/demo/demoData'

const scenarioLabels: Record<DemoScenario, { label: string; description: string }> = {
  normal: {
    label: 'Normal Operations',
    description: 'Standard jobs and team management',
  },
  audit_review: {
    label: 'Audit Review',
    description: 'Audit logs and compliance verification',
  },
  incident: {
    label: 'Incident',
    description: 'Escalation trail and mitigation',
  },
  insurance_packet: {
    label: 'Insurance Packet',
    description: 'Completed jobs and proof packs',
  },
}

export function ScenarioPicker() {
  const { currentScenario, setCurrentScenario } = useDemo()
  const current = scenarioLabels[currentScenario]

  return (
    <div className="relative">
      <label className="block text-xs text-white/60 mb-1.5">Scenario:</label>
      <select
        value={currentScenario}
        onChange={(e) => setCurrentScenario(e.target.value as DemoScenario)}
        className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#F97316] hover:bg-white/10 transition-colors appearance-none cursor-pointer pr-8 min-w-[200px]"
      >
        {Object.entries(scenarioLabels).map(([value, { label }]) => (
          <option key={value} value={value} className="bg-[#121212]">
            {label}
          </option>
        ))}
      </select>
      <div className="absolute right-2 top-8 pointer-events-none">
        <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {current.description && (
        <p className="text-xs text-white/40 mt-1">{current.description}</p>
      )}
    </div>
  )
}

