'use client'

import { useDemo } from '@/lib/demo/useDemo'
import type { DemoRole, DemoScenario } from '@/lib/demo/demoData'

const roleLabels: Record<DemoRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  safety_lead: 'Safety Lead',
  executive: 'Executive',
  member: 'Member',
}

const roleDescriptions: Record<DemoRole, string> = {
  owner: 'Full system access, billing, org settings',
  admin: 'Team management, no org-level authority',
  safety_lead: 'Owns operational risk, sees all flagged jobs',
  executive: 'Read-only visibility into risk & trends',
  member: 'Can create/update jobs, no governance authority',
}

const scenarioLabels: Record<DemoScenario, string> = {
  normal: 'Normal Operations',
  audit_review: 'Audit Review',
  incident: 'Incident Response',
  insurance_packet: 'Insurance Packet',
}

const scenarioDescriptions: Record<DemoScenario, string> = {
  normal: 'Standard jobs and team management',
  audit_review: 'Audit logs and security events highlighted',
  incident: 'Flagged job with escalation trail',
  insurance_packet: 'Completed jobs with full audit trail',
}

export function RoleSwitcher() {
  const { isDemo, currentRole, setCurrentRole, currentScenario, setCurrentScenario } = useDemo()

  if (!isDemo) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-lg">
        <span className="text-sm text-white/70">Viewing as:</span>
        <select
          value={currentRole}
          onChange={(e) => setCurrentRole(e.target.value as DemoRole)}
          className="px-3 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm font-medium focus:outline-none focus:border-[#F97316] cursor-pointer"
        >
          {Object.entries(roleLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div className="text-xs text-white/50 max-w-xs">
          {roleDescriptions[currentRole]}
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-lg">
        <span className="text-sm text-white/70">Scenario:</span>
        <select
          value={currentScenario}
          onChange={(e) => setCurrentScenario(e.target.value as DemoScenario)}
          className="px-3 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm font-medium focus:outline-none focus:border-[#F97316] cursor-pointer"
        >
          {Object.entries(scenarioLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div className="text-xs text-white/50 max-w-xs">
          {scenarioDescriptions[currentScenario]}
        </div>
      </div>
    </div>
  )
}

