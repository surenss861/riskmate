'use client'

import React from 'react'
import clsx from 'clsx'

export interface MentionUser {
  id: string
  full_name: string | null
  email: string
  /** User role for dropdown display (e.g. owner, admin, member). */
  role?: string | null
}

export interface MentionAutocompleteProps {
  candidates: MentionUser[]
  highlightIndex: number
  onSelect: (user: MentionUser) => void
  className?: string
}

function getInitials(user: MentionUser): string {
  const name = user.full_name?.trim()
  if (name && name.length > 0) {
    return name
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  const local = user.email.split('@')[0] ?? ''
  return (local.slice(0, 2) || '?').toUpperCase()
}

/** Avatar/initials glyph for mention option row (spec dropdown content). */
function MentionOptionAvatar({ user }: { user: MentionUser }) {
  const initials = getInitials(user)
  const hue = Array.from(user.id).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div
      className="shrink-0 w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-xs font-semibold"
      style={{ backgroundColor: `hsla(${hue}, 50%, 25%, 1)`, color: `hsl(${hue}, 60%, 75%)` }}
      aria-hidden
    >
      {initials}
    </div>
  )
}

/**
 * Reusable @ mention autocomplete dropdown. Renders a list of users with avatar/initials and role;
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
            'w-full px-4 py-2 text-left text-sm text-white/90 flex items-center gap-3',
            i === highlightIndex ? 'bg-white/10' : 'hover:bg-white/10'
          )}
          onClick={() => onSelect(m)}
        >
          <MentionOptionAvatar user={m} />
          <div className="min-w-0 flex-1 flex flex-col items-start gap-0.5">
            <span className="font-medium">{m.full_name || m.email}</span>
            <div className="flex items-center gap-2 flex-wrap">
              {m.full_name && <span className="text-white/50 text-xs">{m.email}</span>}
              {m.role != null && m.role !== '' && (
                <span className="text-white/40 text-xs capitalize">{m.role}</span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
