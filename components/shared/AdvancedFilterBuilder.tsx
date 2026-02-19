'use client'

import React, { useState, useEffect } from 'react'
import type { FilterCondition, FilterGroup } from '@/lib/jobs/filterConfig'
import { FILTER_FIELD_ALLOWLIST } from '@/lib/jobs/filterConfig'
import { teamApi } from '@/lib/api'

const FIELD_OPTIONS = Array.from(FILTER_FIELD_ALLOWLIST).map((f) => ({
  value: f,
  label: f.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}))

/** Job type enum values (match API validation). */
const JOB_TYPE_OPTIONS = [
  'repair',
  'maintenance',
  'installation',
  'inspection',
  'renovation',
  'new_construction',
  'remodel',
  'other',
]

const OPERATORS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  default: [
    { value: 'eq', label: 'equals' },
    { value: 'ilike', label: 'contains' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'between', label: 'between' },
    { value: 'in', label: 'in list' },
  ],
  text: [
    { value: 'eq', label: 'equals' },
    { value: 'ilike', label: 'contains' },
  ],
  number: [
    { value: 'eq', label: 'equals' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'between', label: 'between' },
  ],
  date: [
    { value: 'eq', label: 'equals' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'between', label: 'between' },
  ],
  boolean: [{ value: 'eq', label: 'equals' }],
  status: [
    { value: 'eq', label: 'equals' },
    { value: 'in', label: 'in list' },
  ],
  risk_level: [
    { value: 'eq', label: 'equals' },
    { value: 'in', label: 'in list' },
  ],
  job_type_enum: [
    { value: 'eq', label: 'equals' },
    { value: 'in', label: 'in list' },
  ],
  user: [
    { value: 'eq', label: 'equals' },
    { value: 'in', label: 'in list' },
  ],
}

function getFieldType(field: string): keyof typeof OPERATORS_BY_TYPE {
  if (['has_photos', 'has_signatures', 'needs_signatures'].includes(field)) return 'boolean'
  if (['status'].includes(field)) return 'status'
  if (['risk_level'].includes(field)) return 'risk_level'
  if (['risk_score'].includes(field)) return 'number'
  if (['end_date', 'due_date', 'created_at'].includes(field)) return 'date'
  if (['job_type'].includes(field)) return 'job_type_enum'
  if (['assigned_to', 'assigned_to_id'].includes(field)) return 'user'
  if (['client_name', 'location'].includes(field)) return 'text'
  return 'default'
}

export interface AdvancedFilterBuilderProps {
  value: FilterGroup | null
  onChange: (value: FilterGroup | null) => void
  /** When provided, shows "Save as Filter" control; called with name and optional is_shared after user confirms in modal */
  onSaveAsFilter?: (name: string, is_shared?: boolean) => void | Promise<void>
  className?: string
}

type TeamMember = { id: string; full_name: string | null; email: string }

export function AdvancedFilterBuilder({ value, onChange, onSaveAsFilter, className = '' }: AdvancedFilterBuilderProps) {
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveShared, setSaveShared] = useState(false)
  const [saveSubmitting, setSaveSubmitting] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

  useEffect(() => {
    teamApi
      .get()
      .then((res) => setTeamMembers(res.members ?? []))
      .catch(() => setTeamMembers([]))
  }, [])

  const group: FilterGroup = value ?? { operator: 'AND', conditions: [] }
  const conditions = Array.isArray(group.conditions) ? (group.conditions as FilterCondition[]) : []
  const operator = (group.operator || 'AND').toUpperCase()

  const updateCondition = (index: number, patch: Partial<FilterCondition>) => {
    const next = [...conditions]
    next[index] = { ...next[index], ...patch }
    onChange({ ...group, conditions: next })
  }

  const addRow = () => {
    onChange({
      ...group,
      conditions: [...conditions, { field: 'status', operator: 'eq', value: '' }],
    })
  }

  const removeRow = (index: number) => {
    const next = conditions.filter((_, i) => i !== index)
    onChange(next.length === 0 ? null : { ...group, conditions: next })
  }

  const toggleOperator = () => {
    onChange({ ...group, operator: operator === 'AND' ? 'OR' : 'AND' })
  }

  const fieldOperators = (field: string) => {
    const t = getFieldType(field || '')
    return OPERATORS_BY_TYPE[t] || OPERATORS_BY_TYPE.default
  }

  const renderValueInput = (condition: FilterCondition, index: number) => {
    const field = (condition.field || '') as string
    const fieldType = getFieldType(field)
    const op = (condition.operator || 'eq') as string
    const val = condition.value

    if (fieldType === 'boolean') {
      return (
        <select
          value={val === true ? 'true' : val === false ? 'false' : ''}
          onChange={(e) => updateCondition(index, { value: e.target.value === 'true' ? true : e.target.value === 'false' ? false : undefined })}
          className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:ring-1 focus:ring-[#F97316]/50 focus:border-[#F97316]/50 outline-none min-w-[100px]"
        >
          <option value="">—</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      )
    }

    if (field === 'status') {
      const options = ['draft', 'active', 'in_progress', 'completed', 'on-hold', 'cancelled', 'archived']
      if (op === 'in') {
        const arr = Array.isArray(val) ? (val as string[]) : typeof val === 'string' && val ? val.split(',').map((s) => s.trim()) : []
        return (
          <div className="flex flex-wrap gap-1">
            {options.map((opt) => {
              const selected = arr.includes(opt)
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const next = selected ? arr.filter((x) => x !== opt) : [...arr, opt]
                    updateCondition(index, { value: next })
                  }}
                  className={`px-2 py-1 rounded text-xs border ${selected ? 'bg-[#F97316]/30 border-[#F97316]/50 text-white' : 'bg-white/5 border-white/10 text-white/70'}`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        )
      }
      return (
        <select
          value={typeof val === 'string' ? val : ''}
          onChange={(e) => updateCondition(index, { value: e.target.value || undefined })}
          className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:ring-1 focus:ring-[#F97316]/50 outline-none min-w-[120px]"
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    }

    if (field === 'risk_level') {
      const options = ['low', 'medium', 'high', 'critical']
      if (op === 'in') {
        const arr = Array.isArray(val) ? (val as string[]) : typeof val === 'string' && val ? val.split(',').map((s) => s.trim()) : []
        return (
          <div className="flex flex-wrap gap-1">
            {options.map((opt) => {
              const selected = arr.includes(opt)
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const next = selected ? arr.filter((x) => x !== opt) : [...arr, opt]
                    updateCondition(index, { value: next })
                  }}
                  className={`px-2 py-1 rounded text-xs border ${selected ? 'bg-[#F97316]/30 border-[#F97316]/50 text-white' : 'bg-white/5 border-white/10 text-white/70'}`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        )
      }
      return (
        <select
          value={typeof val === 'string' ? val : ''}
          onChange={(e) => updateCondition(index, { value: e.target.value || undefined })}
          className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:ring-1 focus:ring-[#F97316]/50 outline-none min-w-[100px]"
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )
    }

    if (field === 'job_type') {
      const options = JOB_TYPE_OPTIONS
      if (op === 'in') {
        const arr = Array.isArray(val) ? (val as string[]) : typeof val === 'string' && val ? val.split(',').map((s) => s.trim()) : []
        return (
          <div className="flex flex-wrap gap-1">
            {options.map((opt) => {
              const selected = arr.includes(opt)
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const next = selected ? arr.filter((x) => x !== opt) : [...arr, opt]
                    updateCondition(index, { value: next })
                  }}
                  className={`px-2 py-1 rounded text-xs border ${selected ? 'bg-[#F97316]/30 border-[#F97316]/50 text-white' : 'bg-white/5 border-white/10 text-white/70'}`}
                >
                  {opt.replace(/_/g, ' ')}
                </button>
              )
            })}
          </div>
        )
      }
      return (
        <select
          value={typeof val === 'string' ? val : ''}
          onChange={(e) => updateCondition(index, { value: e.target.value || undefined })}
          className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:ring-1 focus:ring-[#F97316]/50 outline-none min-w-[140px]"
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      )
    }

    if (field === 'assigned_to' || field === 'assigned_to_id') {
      const members = teamMembers
      const selectedId = typeof val === 'string' ? val : val != null ? String(val) : ''
      if (op === 'in') {
        const arr = Array.isArray(val) ? (val as string[]) : typeof val === 'string' && val ? val.split(',').map((s) => s.trim()) : []
        return (
          <div className="flex flex-wrap gap-1 max-w-[280px]">
            {members.map((m) => {
              const selected = arr.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    const next = selected ? arr.filter((x) => x !== m.id) : [...arr, m.id]
                    updateCondition(index, { value: next })
                  }}
                  className={`px-2 py-1 rounded text-xs border truncate max-w-full ${selected ? 'bg-[#F97316]/30 border-[#F97316]/50 text-white' : 'bg-white/5 border-white/10 text-white/70'}`}
                  title={m.full_name || m.email}
                >
                  {m.full_name || m.email}
                </button>
              )
            })}
            {members.length === 0 && (
              <span className="text-xs text-white/50">Loading members…</span>
            )}
          </div>
        )
      }
      return (
        <select
          value={selectedId}
          onChange={(e) => updateCondition(index, { value: e.target.value || undefined })}
          className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:ring-1 focus:ring-[#F97316]/50 outline-none min-w-[160px]"
        >
          <option value="">—</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name || m.email}
            </option>
          ))}
          {members.length === 0 && (
            <option value="" disabled>Loading…</option>
          )}
        </select>
      )
    }

    if (fieldType === 'number') {
      if (op === 'between') {
        const arr = Array.isArray(val) ? (val as unknown[]) : [val, val]
        const toNumStr = (v: unknown): string =>
          typeof v === 'number' && Number.isFinite(v) ? String(v) : typeof v === 'string' ? v : ''
        const minStr = toNumStr(arr[0])
        const maxStr = toNumStr(arr[1])
        return (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={minStr}
              onChange={(e) => updateCondition(index, { value: [e.target.value === '' ? '' : Number(e.target.value), arr[1]] })}
              className="h-9 w-24 px-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:ring-1 focus:ring-[#F97316]/50 outline-none"
              placeholder="Min"
            />
            <span className="text-white/50">–</span>
            <input
              type="number"
              value={maxStr}
              onChange={(e) => updateCondition(index, { value: [arr[0], e.target.value === '' ? '' : Number(e.target.value)] })}
              className="h-9 w-24 px-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:ring-1 focus:ring-[#F97316]/50 outline-none"
              placeholder="Max"
            />
          </div>
        )
      }
      return (
        <input
          type="number"
          value={val !== undefined && val !== null ? String(val) : ''}
          onChange={(e) => updateCondition(index, { value: e.target.value === '' ? undefined : Number(e.target.value) })}
          className="h-9 w-28 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:ring-1 focus:ring-[#F97316]/50 outline-none"
        />
      )
    }

    if (fieldType === 'date') {
      if (op === 'between') {
        const arr = Array.isArray(val) ? (val as string[]) : [val, val].filter(Boolean) as string[]
        const toDateStr = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 10) : '')
        return (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={toDateStr(arr[0])}
              onChange={(e) => updateCondition(index, { value: [e.target.value, arr[1] ?? ''] })}
              className="h-9 px-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:ring-1 focus:ring-[#F97316]/50 outline-none"
            />
            <span className="text-white/50">–</span>
            <input
              type="date"
              value={toDateStr(arr[1])}
              onChange={(e) => updateCondition(index, { value: [arr[0] ?? '', e.target.value] })}
              className="h-9 px-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:ring-1 focus:ring-[#F97316]/50 outline-none"
            />
          </div>
        )
      }
      return (
        <input
          type="date"
          value={typeof val === 'string' ? val.slice(0, 10) : val instanceof Date ? val.toISOString().slice(0, 10) : ''}
          onChange={(e) => updateCondition(index, { value: e.target.value || undefined })}
          className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:ring-1 focus:ring-[#F97316]/50 outline-none min-w-[140px]"
        />
      )
    }

    return (
      <input
        type="text"
        value={typeof val === 'string' ? val : Array.isArray(val) ? (val as string[]).join(', ') : val != null ? String(val) : ''}
        onChange={(e) => updateCondition(index, { value: e.target.value || undefined })}
        placeholder={op === 'in' ? 'Comma-separated' : 'Value'}
        className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/40 focus:ring-1 focus:ring-[#F97316]/50 outline-none min-w-[140px]"
      />
    )
  }

  return (
    <div className={`rounded-lg border border-white/10 bg-white/5 p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-sm text-white/60">Match</span>
        <button
          type="button"
          onClick={toggleOperator}
          className="px-3 py-1.5 rounded-lg border border-white/20 text-sm font-medium bg-white/5 text-white hover:bg-white/10"
        >
          {operator}
        </button>
        <span className="text-sm text-white/60">of the following:</span>
      </div>
      <div className="space-y-2">
        {conditions.map((condition, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <select
              value={condition.field || ''}
              onChange={(e) => updateCondition(index, { field: e.target.value || undefined, operator: 'eq', value: undefined })}
              className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:ring-1 focus:ring-[#F97316]/50 outline-none min-w-[140px]"
            >
              <option value="">Select field</option>
              {FIELD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={condition.operator || 'eq'}
              onChange={(e) => updateCondition(index, { operator: e.target.value as FilterCondition['operator'] })}
              className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:ring-1 focus:ring-[#F97316]/50 outline-none min-w-[100px]"
            >
              {fieldOperators(condition.field || '').map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {renderValueInput(condition, index)}
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="p-2 text-white/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Remove row"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="text-sm text-[#F97316] hover:text-[#F97316]/80 hover:underline"
        >
          + Add row
        </button>
        {onSaveAsFilter && (
          <button
            type="button"
            onClick={() => {
              setSaveName('')
              setSaveShared(false)
              setSaveModalOpen(true)
            }}
            className="text-sm text-[#F97316] hover:text-[#F97316]/80 hover:underline"
          >
            Save as Filter
          </button>
        )}
      </div>

      {saveModalOpen && onSaveAsFilter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !saveSubmitting && setSaveModalOpen(false)}>
          <div
            className="w-full max-w-sm rounded-xl border border-white/10 bg-[#1A1A1A] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 text-sm font-medium text-white">Save as Filter</div>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Filter name"
              className="mb-3 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 focus:ring-1 focus:ring-[#F97316]/50 outline-none"
              autoFocus
            />
            <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={saveShared}
                onChange={(e) => setSaveShared(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#F97316] focus:ring-[#F97316]/50"
              />
              Share with team
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                disabled={saveSubmitting}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/70 hover:bg-white/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!saveName.trim() || saveSubmitting}
                onClick={async () => {
                  if (!saveName.trim()) return
                  setSaveSubmitting(true)
                  try {
                    await onSaveAsFilter(saveName.trim(), saveShared)
                    setSaveModalOpen(false)
                  } finally {
                    setSaveSubmitting(false)
                  }
                }}
                className="rounded-lg bg-[#F97316] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#F97316]/90 disabled:opacity-50"
              >
                {saveSubmitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
