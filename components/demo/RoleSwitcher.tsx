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
    <div className="relative">
      <label className="block text-xs text-white/60 mb-1.5">Viewing as:</label>
      <select
        value={currentRole}
        onChange={(e) => setCurrentRole(e.target.value as DemoRole)}
        className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#F97316] hover:bg-white/10 transition-colors appearance-none cursor-pointer pr-8 min-w-[180px]"
      >
        {Object.entries(roleLabels).map(([value, label]) => (
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
      {roleDescriptions[currentRole] && (
        <p className="text-xs text-white/40 mt-1">{roleDescriptions[currentRole]}</p>
      )}
    </div>
  )
}

