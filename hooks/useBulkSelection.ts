'use client'

import { useState, useCallback, useMemo } from 'react'

export interface UseBulkSelectionOptions {
  /** Maximum number of IDs that can be selected. When adding (toggleItem/toggleAll), selection is capped at this size. */
  maxSelectionSize?: number
}

/**
 * Generic hook for multi-select state on a list of items with string ids.
 * Used for bulk actions (e.g. jobs table).
 * Selection is tracked by job ID independent of the current page items so it
 * persists across pagination/filter changes. Selection is only cleared or
 * shrunk when the user explicitly clears it or after a bulk action completes.
 */
export function useBulkSelection<T extends { id: string }>(
  items: T[],
  options: UseBulkSelectionOptions = {}
) {
  const { maxSelectionSize } = options
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleItem = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          if (maxSelectionSize != null && prev.size >= maxSelectionSize) return prev
          next.add(id)
        }
        return next
      })
    },
    [maxSelectionSize]
  )

  const toggleAll = useCallback(() => {
    const currentIds = items.map((item) => item.id)
    setSelectedIds((prev) => {
      const everyCurrentSelected =
        currentIds.length > 0 && currentIds.every((id) => prev.has(id))
      if (everyCurrentSelected) {
        const next = new Set(prev)
        currentIds.forEach((id) => next.delete(id))
        return next
      }
      const next = new Set(prev)
      const cap = maxSelectionSize != null ? maxSelectionSize - next.size : currentIds.length
      let added = 0
      for (const id of currentIds) {
        if (!next.has(id) && added < cap) {
          next.add(id)
          added++
        }
      }
      return next
    })
  }, [items, maxSelectionSize])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  /** Set selection to exactly these IDs (e.g. keep only failed IDs for retry). */
  const setSelection = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids))
  }, [])

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  )

  const isAllSelected = useMemo(
    () =>
      items.length > 0 && items.every((item) => selectedIds.has(item.id)),
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
