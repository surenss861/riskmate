'use client'

import { useDemo } from '@/lib/demo/useDemo'
import type { DemoRole } from '@/lib/demo/demoData'

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

export function RoleSwitcher() {
  const { isDemo, currentRole, setCurrentRole } = useDemo()

  if (!isDemo) return null

  return (
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
  )
}

