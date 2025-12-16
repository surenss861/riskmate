'use client'

import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { spacing, dividerStyles, motion as motionStyles } from '@/lib/styles/design-system'

interface Column<T> {
  id: string
  header: string
  accessor: (row: T) => any
  render?: (value: any, row: T) => React.ReactNode
  sortable?: boolean
  width?: string
}

interface DataGridProps<T> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (row: T) => void
  onRowHover?: (row: T) => void
  onRowHoverEnd?: (row: T) => void
  stickyHeader?: boolean
  rowHighlight?: (row: T) => string | null
  savedViews?: Array<{ id: string; name: string; filters: any }>
  onSaveView?: (name: string, filters: any) => void
  stickyColumns?: string[] // Column IDs to keep sticky on horizontal scroll
  enableKeyboardShortcuts?: boolean // Enable keyboard shortcuts (/, F, Enter, Esc)
}

export function DataGrid<T extends { id: string }>({
  data,
  columns,
  onRowClick,
  onRowHover,
  onRowHoverEnd,
  stickyHeader = true,
  rowHighlight,
  savedViews = [],
  onSaveView,
  stickyColumns = [],
  enableKeyboardShortcuts = false,
}: DataGridProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedView, setSelectedView] = useState<string | null>(null)
  const [filtersVisible, setFiltersVisible] = useState(false)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  const sortedData = useMemo(() => {
    if (!sortColumn) return data

    const column = columns.find((col) => col.id === sortColumn)
    if (!column || !column.sortable) return data

    return [...data].sort((a, b) => {
      const aVal = column.accessor(a)
      const bVal = column.accessor(b)

      if (aVal === bVal) return 0
      const comparison = aVal < bVal ? -1 : 1
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [data, sortColumn, sortDirection, columns])

  const filteredData = useMemo(() => {
    if (!searchTerm) return sortedData

    return sortedData.filter((row) => {
      return columns.some((col) => {
        const value = col.accessor(row)
        return String(value).toLowerCase().includes(searchTerm.toLowerCase())
      })
    })
  }, [sortedData, searchTerm, columns])

  const handleSort = (columnId: string) => {
    const column = columns.find((col) => col.id === columnId)
    if (!column?.sortable) return

    if (sortColumn === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(columnId)
      setSortDirection('asc')
    }
  }

  // Keyboard shortcuts
  React.useEffect(() => {
    if (!enableKeyboardShortcuts) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // / focuses search
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }

      // F opens/closes filters (if filters exist)
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        setFiltersVisible(!filtersVisible)
      }

      // Esc collapses expanded rows (handled in DataGridRows)
      if (e.key === 'Escape') {
        // This will be handled by the parent component if needed
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enableKeyboardShortcuts, filtersVisible])

// Separate component for rows to allow hooks
function DataGridRows<T extends { id: string }>({
  data,
  columns,
  rowHighlight,
  onRowClick,
  onRowHover,
  onRowHoverEnd,
  stickyColumns = [],
  enableKeyboardShortcuts = false,
}: {
  data: T[]
  columns: Column<T>[]
  rowHighlight?: (row: T) => string | null
  onRowClick?: (row: T) => void
  onRowHover?: (row: T) => void
  onRowHoverEnd?: (row: T) => void
  stickyColumns?: string[]
  enableKeyboardShortcuts?: boolean
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  
  const toggleRow = (rowId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(rowId)) {
        next.delete(rowId)
      } else {
        next.add(rowId)
      }
      return next
    })
  }

  // Keyboard shortcuts for row navigation
  React.useEffect(() => {
    if (!enableKeyboardShortcuts) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Enter opens selected row
      if (e.key === 'Enter' && selectedRowIndex !== null) {
        e.preventDefault()
        const row = data[selectedRowIndex]
        if (row) {
          toggleRow(row.id)
          onRowClick?.(row)
        }
      }

      // Esc collapses all expanded rows
      if (e.key === 'Escape') {
        e.preventDefault()
        setExpandedRows(new Set())
        setSelectedRowIndex(null)
      }

      // Arrow keys for row selection (optional, can be added later)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enableKeyboardShortcuts, selectedRowIndex, data, onRowClick])
  
  return (
    <>
      {data.map((row, index) => {
        const highlight = rowHighlight ? rowHighlight(row) : null
        const isExpanded = expandedRows.has(row.id)
        const rowData = row as any // Type assertion for dynamic properties
        
        return (
          <React.Fragment key={row.id}>
            <motion.tr
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              onClick={() => {
                toggleRow(row.id)
                onRowClick?.(row)
              }}
              onMouseEnter={() => onRowHover?.(row)}
              onMouseLeave={() => onRowHoverEnd?.(row)}
              className={`hover:bg-white/5 ${motionStyles.hover} ${
                onRowClick ? 'cursor-pointer' : ''
              } ${highlight ? 'border-l-[3px]' : ''}`}
              style={{
                borderLeftColor: highlight || undefined,
              }}
            >
              {columns.map((column) => {
                const value = column.accessor(row)
                const isNumeric = typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))
                const isSticky = stickyColumns.includes(column.id)
                return (
                  <td
                    key={column.id}
                    className={`px-4 py-3 text-sm text-white/80 h-12 ${isNumeric ? 'text-right' : 'text-left'} ${
                      isSticky ? 'sticky left-0 z-10 bg-[#121212]/80' : ''
                    }`}
                    style={{
                      ...(isSticky && { 
                        left: stickyColumns.slice(0, stickyColumns.indexOf(column.id)).reduce((acc, id) => {
                          const col = columns.find(c => c.id === id)
                          if (!col?.width) return acc + 200
                          // Parse width (handles "200px", "200", etc.)
                          const widthNum = parseInt(String(col.width).replace('px', '')) || 200
                          return acc + widthNum
                        }, 0)
                      })
                    }}
                  >
                    {column.render
                      ? column.render(value, row)
                      : String(value || '')}
                  </td>
                )
              })}
            </motion.tr>
            {isExpanded && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-4 bg-black/20 border-t border-white/5">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-white/50 mb-2 uppercase tracking-wider">Top Hazards</div>
                      <div className="text-white/70">
                        {rowData.risk_score && rowData.risk_score > 0 ? (
                          <div className="space-y-1">
                            <div className="text-white/60">Risk factors identified</div>
                            <div className="text-xs text-white/40">View details for full list</div>
                          </div>
                        ) : (
                          <div className="text-white/40">No hazards identified</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-white/50 mb-2 uppercase tracking-wider">Compliance Status</div>
                      <div className="text-white/70">
                        {rowData.status === 'completed' ? (
                          <span className="text-green-400/80">Compliant</span>
                        ) : rowData.status === 'in_progress' ? (
                          <span className="text-amber-400/80">In Progress</span>
                        ) : (
                          <span className="text-white/60">Draft</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-white/50 mb-2 uppercase tracking-wider">Last Activity</div>
                      <div className="text-white/70">
                        {rowData.updated_at ? (
                          <div>
                            <div className="text-xs">{new Date(rowData.updated_at).toLocaleDateString()}</div>
                            <div className="text-xs text-white/40">{new Date(rowData.updated_at).toLocaleTimeString()}</div>
                          </div>
                        ) : (
                          <div className="text-white/40">No activity</div>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </React.Fragment>
        )
      })}
    </>
  )
}

  return (
    <div className="rounded-lg border border-white/10 bg-[#121212]/80 backdrop-blur-sm overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={enableKeyboardShortcuts ? "Search... (Press / to focus)" : "Search..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
            {enableKeyboardShortcuts && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white/30 pointer-events-none">
                /
              </div>
            )}
          </div>
          {savedViews.length > 0 && (
            <select
              value={selectedView || ''}
              onChange={(e) => setSelectedView(e.target.value || null)}
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            >
              <option value="">All</option>
              {savedViews.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {onSaveView && (
          <button
            onClick={() => {
              const name = prompt('View name:')
              if (name) onSaveView(name, { searchTerm, sortColumn, sortDirection })
            }}
            className="px-4 py-2 text-sm text-white/70 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
          >
            Save View
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead
            className={`bg-black/20 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}
          >
            <tr>
              {columns.map((column) => {
                const isSticky = stickyColumns.includes(column.id)
                return (
                  <th
                    key={column.id}
                    className={`px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider ${
                      column.sortable ? 'cursor-pointer hover:text-white' : ''
                    } ${isSticky ? 'sticky left-0 z-20 bg-black/20' : ''}`}
                    style={{ 
                      width: column.width,
                      ...(isSticky && { 
                        left: stickyColumns.slice(0, stickyColumns.indexOf(column.id)).reduce((acc, id) => {
                          const col = columns.find(c => c.id === id)
                          if (!col?.width) return acc + 200
                          // Parse width (handles "200px", "200", etc.)
                          const widthNum = parseInt(String(col.width).replace('px', '')) || 200
                          return acc + widthNum
                        }, 0)
                      })
                    }}
                    onClick={() => column.sortable && handleSort(column.id)}
                  >
                    <div className="flex items-center gap-2">
                      {column.header}
                      {column.sortable && sortColumn === column.id && (
                        <span className="text-[#F97316]">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm font-medium text-white">No data found</p>
                    <p className="text-xs text-white/50 max-w-md">
                      {searchTerm 
                        ? 'Try adjusting your search terms'
                        : 'This table will show data when available'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              <DataGridRows 
                data={filteredData}
                columns={columns}
                rowHighlight={rowHighlight}
                onRowClick={onRowClick}
                onRowHover={onRowHover}
                onRowHoverEnd={onRowHoverEnd}
                stickyColumns={stickyColumns}
                enableKeyboardShortcuts={enableKeyboardShortcuts}
              />
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 text-sm text-white/50">
        Showing {filteredData.length} of {data.length} items
      </div>
    </div>
  )
}

