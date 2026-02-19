'use client'

import React from 'react'
import type { FilterCondition, FilterGroup } from '@/lib/jobs/filterConfig'
import { FILTER_FIELD_ALLOWLIST } from '@/lib/jobs/filterConfig'

const FIELD_OPTIONS = Array.from(FILTER_FIELD_ALLOWLIST).map((f) => ({
  value: f,
  label: f.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}))

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
}

function getFieldType(field: string): keyof typeof OPERATORS_BY_TYPE {
  if (['has_photos', 'has_signatures', 'needs_signatures'].includes(field)) return 'boolean'
  if (['status'].includes(field)) return 'status'
  if (['risk_level'].includes(field)) return 'risk_level'
  if (['risk_score'].includes(field)) return 'number'
  if (['end_date', 'due_date', 'created_at'].includes(field)) return 'date'
  if (['client_name', 'location', 'job_type'].includes(field)) return 'text'
  if (['assigned_to', 'assigned_to_id'].includes(field)) return 'text'
  return 'default'
}

export interface AdvancedFilterBuilderProps {
  value: FilterGroup | null
  onChange: (value: FilterGroup | null) => void
  className?: string
}

export function AdvancedFilterBuilder({ value, onChange, className = '' }: AdvancedFilterBuilderProps) {
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

    if (fieldType === 'number') {
      if (op === 'between') {
        const arr = Array.isArray(val) ? (val as (number | string)[]) : [val, val]
        return (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={arr[0] ?? ''}
              onChange={(e) => updateCondition(index, { value: [e.target.value === '' ? '' : Number(e.target.value), arr[1] ?? ''] })}
              className="h-9 w-24 px-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:ring-1 focus:ring-[#F97316]/50 outline-none"
              placeholder="Min"
            />
            <span className="text-white/50">–</span>
            <input
              type="number"
              value={arr[1] ?? ''}
              onChange={(e) => updateCondition(index, { value: [arr[0] ?? '', e.target.value === '' ? '' : Number(e.target.value)] })}
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
      <button
        type="button"
        onClick={addRow}
        className="mt-2 text-sm text-[#F97316] hover:text-[#F97316]/80 hover:underline"
      >
        + Add row
      </button>
    </div>
  )
}
