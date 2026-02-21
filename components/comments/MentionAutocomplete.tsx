'use client'

import React from 'react'
import clsx from 'clsx'

export interface MentionUser {
  id: string
  full_name: string | null
  email: string
}

export interface MentionAutocompleteProps {
  candidates: MentionUser[]
  highlightIndex: number
  onSelect: (user: MentionUser) => void
  className?: string
}

/**
 * Reusable @ mention autocomplete dropdown. Renders a list of users;
 * caller handles keyboard (ArrowUp/Down, Enter, Escape) and positioning.
 */
export function MentionAutocomplete({
  candidates,
  highlightIndex,
  onSelect,
  className,
}: MentionAutocompleteProps) {
  if (candidates.length === 0) return null

  return (
    <div
      className={clsx(
        'absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-white/10 bg-[#1a1a1a] py-1 shadow-lg',
        className
      )}
      role="listbox"
    >
      {candidates.map((m, i) => (
        <button
          key={m.id}
          type="button"
          role="option"
          aria-selected={i === highlightIndex}
          className={clsx(
            'w-full px-4 py-2 text-left text-sm text-white/90 flex items-center gap-2',
            i === highlightIndex ? 'bg-white/10' : 'hover:bg-white/10'
          )}
          onClick={() => onSelect(m)}
        >
          <span className="font-medium">{m.full_name || m.email}</span>
          {m.full_name && <span className="text-white/50 text-xs">{m.email}</span>}
        </button>
      ))}
    </div>
  )
}
