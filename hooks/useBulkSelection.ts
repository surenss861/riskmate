'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'

/**
 * Generic hook for multi-select state on a list of items with string ids.
 * Used for bulk actions (e.g. jobs table).
 * Syncs selectedIds when items change: intersect with current item IDs so
 * selection stays accurate across pagination/filter changes.
 */
export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const currentIds = useMemo(() => new Set(items.map((item) => item.id)), [items])

  // When items change (page/filter), reconcile selection: keep only IDs that still exist in current items
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const next = new Set<string>()
      for (const id of prev) {
        if (currentIds.has(id)) next.add(id)
      }
      return next.size === prev.size ? prev : next
    })
  }, [currentIds])

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
    setSelectedIds((prev) => {
      const everyCurrentSelected = items.length > 0 && items.every((item) => prev.has(item.id))
      return everyCurrentSelected ? new Set() : allIds
    })
  }, [items])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  /** Set selection to exactly these IDs (e.g. keep only failed IDs for retry). IDs not in current items are ignored. */
  const setSelection = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set<string>()
      for (const id of ids) {
        if (currentIds.has(id)) next.add(id)
      }
      return next
    })
  }, [currentIds])

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  )

  // Header "Select All" is checked only when every current item ID is in selectedIds (not just matching count)
  const isAllSelected = useMemo(
    () => items.length > 0 && items.every((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  )

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  )

  return {
    selectedIds,
    selectedItems,
    toggleItem,
    toggleAll,
    clearSelection,
    setSelection,
    isSelected,
    isAllSelected,
  }
}
