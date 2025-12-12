'use client'

import { useState, useMemo } from 'react'
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
}: DataGridProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedView, setSelectedView] = useState<string | null>(null)

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

  return (
    <div className="rounded-lg border border-white/10 bg-[#121212]/80 backdrop-blur-sm overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 max-w-md bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
          />
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
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={`px-4 py-3 text-left text-xs font-semibold text-white/70 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:text-white' : ''
                  }`}
                  style={{ width: column.width }}
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
              ))}
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
              filteredData.map((row, index) => {
                const highlight = rowHighlight ? rowHighlight(row) : null
                return (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => onRowClick?.(row)}
                    onMouseEnter={() => onRowHover?.(row)}
                    onMouseLeave={() => onRowHoverEnd?.(row)}
                    className={`hover:bg-white/5 ${motionStyles.hover} ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${highlight ? `border-l-4 border-l-${highlight}` : ''}`}
                    style={{
                      borderLeftColor: highlight || undefined,
                    }}
                  >
                    {columns.map((column) => {
                      const value = column.accessor(row)
                      const isNumeric = typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))
                      return (
                        <td
                          key={column.id}
                          className={`px-4 py-3 text-sm text-white/80 h-12 ${isNumeric ? 'text-right' : 'text-left'}`}
                        >
                          {column.render
                            ? column.render(value, row)
                            : String(value || '')}
                        </td>
                      )
                    })}
                  </motion.tr>
                )
              })
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

