'use client'

import { useState, useCallback } from 'react'

/**
 * Generic hook for multi-select state on a list of items with string ids.
 * Used for bulk actions (e.g. jobs table).
 */
export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    const allIds = new Set(items.map((item) => item.id))
    setSelectedIds((prev) => (prev.size === items.length ? new Set() : allIds))
  }, [items])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  )

  const isAllSelected =
    items.length > 0 && selectedIds.size === items.length

  const selectedItems = items.filter((item) => selectedIds.has(item.id))

  return {
    selectedIds,
    selectedItems,
    toggleItem,
    toggleAll,
    clearSelection,
    isSelected,
    isAllSelected,
  }
}
