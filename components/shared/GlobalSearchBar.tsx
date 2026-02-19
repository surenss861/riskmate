'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/hooks/useDebounce'
import { jobsApi } from '@/lib/api'

const RECENT_KEY = 'riskmate_global_search_recent'
const MAX_RECENT = 8

const MARK_CLASS = 'bg-[#F97316]/30 text-white rounded px-0.5'

function statusToLabel(s: string): string {
  const map: Record<string, string> = {
    draft: 'Draft',
    active: 'Active',
    in_progress: 'In progress',
    completed: 'Completed',
    'on-hold': 'On hold',
    cancelled: 'Cancelled',
    archived: 'Archived',
  }
  return map[s] ?? s
}

function riskLevelColor(level: string): string {
  switch ((level || '').toLowerCase()) {
    case 'critical':
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    case 'high':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'low':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    default:
      return 'bg-white/10 text-white/60 border-white/10'
  }
}

function statusColor(s: string): string {
  switch ((s || '').toLowerCase()) {
    case 'completed':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'active':
    case 'in_progress':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'on-hold':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'cancelled':
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    case 'archived':
      return 'bg-white/10 text-white/50 border-white/5'
    default:
      return 'bg-white/10 text-white/60 border-white/10'
  }
}

/** Escape HTML so it is safe to render as text; then allow only our highlight markup. */
function sanitizeHighlight(highlight: string): string {
  if (!highlight || typeof highlight !== 'string') return ''
  const escaped = highlight
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return escaped
    .replace(/&lt;b&gt;/gi, `<mark class="${MARK_CLASS}">`)
    .replace(/&lt;\/b&gt;/gi, '</mark>')
}

export type SearchResultItem = {
  type: 'job' | 'hazard' | 'client'
  id: string
  title: string
  subtitle: string
  highlight: string
  score: number
  status?: string
  risk_level?: string
  severity?: string
}

export function GlobalSearchBar() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const debouncedQuery = useDebounce(query.trim(), 300)

  const loadRecent = useCallback(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      const list = raw ? (JSON.parse(raw) as string[]) : []
      setRecentSearches(Array.isArray(list) ? list.slice(0, MAX_RECENT) : [])
    } catch {
      setRecentSearches([])
    }
  }, [])

  const pushRecent = useCallback((q: string) => {
    if (!q.trim()) return
    setRecentSearches((prev) => {
      const next = [q.trim(), ...prev.filter((x) => x.toLowerCase() !== q.trim().toLowerCase())].slice(0, MAX_RECENT)
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  useEffect(() => {
    loadRecent()
  }, [loadRecent])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => {
          if (!o) setTimeout(() => inputRef.current?.focus(), 50)
          return !o
        })
        return
      }
      if (open && e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([])
      setSuggestions([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    jobsApi
      .search({ q: debouncedQuery, type: 'all', limit: 20 })
      .then((res) => {
        if (!cancelled) {
          setResults(res.results || [])
          setSuggestions(res.suggestions ?? [])
          setSelectedIndex(0)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults([])
          setSuggestions([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  const flatItems: SearchResultItem[] = results
  const sectioned = React.useMemo(() => {
    const jobs = flatItems.filter((r) => r.type === 'job')
    const hazards = flatItems.filter((r) => r.type === 'hazard')
    const clients = flatItems.filter((r) => r.type === 'client')
    const out: { section: string; items: typeof flatItems }[] = []
    if (jobs.length) out.push({ section: 'Jobs', items: jobs })
    if (hazards.length) out.push({ section: 'Hazards', items: hazards })
    if (clients.length) out.push({ section: 'Clients', items: clients })
    return out
  }, [results])

  const allItems = React.useMemo(() => sectioned.flatMap((s) => s.items), [sectioned])
  const canNavigate = allItems.length > 0

  useEffect(() => {
    if (!canNavigate) return
    setSelectedIndex((i) => Math.min(Math.max(0, i), allItems.length - 1))
  }, [allItems.length, canNavigate])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const sel = el.querySelector('[data-selected="true"]')
    sel?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, sectioned])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (canNavigate) setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (canNavigate) setSelectedIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (canNavigate && allItems[selectedIndex]) {
        const item = allItems[selectedIndex]
        pushRecent(query.trim())
        setOpen(false)
        setQuery('')
        if (item.type === 'job') router.push(`/operations/jobs/${item.id}`)
        else if (item.type === 'hazard') router.push(`/operations/hazards/${item.id}`)
        else if (item.type === 'client') router.push(`/operations/clients/${item.id}`)
      }
      return
    }
  }

  const handleSelect = (item: (typeof allItems)[0]) => {
    pushRecent(query.trim())
    setOpen(false)
    setQuery('')
    if (item.type === 'job') router.push(`/operations/jobs/${item.id}`)
    else if (item.type === 'hazard') router.push(`/operations/hazards/${item.id}`)
    else if (item.type === 'client') router.push(`/operations/clients/${item.id}`)
  }

  const viewAllHref = query.trim()
    ? `/operations/jobs?q=${encodeURIComponent(query.trim())}`
    : '/operations/jobs'

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setTimeout(() => inputRef.current?.focus(), 50)
        }}
        className="flex items-center gap-2 h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:border-white/20 text-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Search…</span>
        <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-white/10 text-xs">⌘K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          ref={containerRef}
        >
          <div
            className="w-full max-w-xl rounded-xl border border-white/10 bg-[#1A1A1A] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center border-b border-white/10 px-4">
              <svg className="w-5 h-5 text-white/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search jobs, hazards, clients…"
                className="flex-1 h-14 px-3 bg-transparent text-white placeholder:text-white/40 outline-none"
                autoComplete="off"
              />
              {loading && (
                <div className="w-5 h-5 shrink-0 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
              {!query.trim() && recentSearches.length > 0 && (
                <div className="px-4 py-2 border-b border-white/10">
                  <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Recent</div>
                  <ul className="space-y-0.5">
                    {recentSearches.slice(0, 5).map((q, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => {
                            setQuery(q)
                            inputRef.current?.focus()
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/5"
                        >
                          {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {query.trim() && suggestions.length > 0 && (
                <div className="px-4 py-2 border-b border-white/10">
                  <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-2">Suggestions</div>
                  <ul className="space-y-0.5">
                    {suggestions.slice(0, 8).map((s, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => {
                            setQuery(s)
                            inputRef.current?.focus()
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/5"
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sectioned.length > 0 && (
                <>
                  {sectioned.map(({ section, items }) => (
                    <div key={section} className="py-2">
                      <div className="px-4 text-xs font-medium text-white/50 uppercase tracking-wider mb-1">
                        {section}
                      </div>
                      {items.map((item) => {
                        const flatIndex = allItems.indexOf(item)
                        const isSelected = flatIndex === selectedIndex
                        return (
                          <button
                            key={`${item.type}-${item.id}`}
                            type="button"
                            data-selected={isSelected}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(flatIndex)}
                            className={`w-full text-left px-4 py-2.5 flex flex-col gap-0.5 ${isSelected ? 'bg-[#F97316]/20' : 'hover:bg-white/5'}`}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-white truncate">{item.title}</span>
                              {item.type === 'job' && (item.status != null || item.risk_level != null) && (
                                <span className="flex items-center gap-1 shrink-0">
                                  {item.status != null && (
                                    <span className={`px-1.5 py-0.5 rounded text-xs border ${statusColor(item.status)}`}>
                                      {statusToLabel(item.status)}
                                    </span>
                                  )}
                                  {item.risk_level != null && (
                                    <span className={`px-1.5 py-0.5 rounded text-xs border capitalize ${riskLevelColor(item.risk_level)}`}>
                                      {item.risk_level}
                                    </span>
                                  )}
                                </span>
                              )}
                              {item.type === 'hazard' && item.severity != null && (
                                <span className={`px-1.5 py-0.5 rounded text-xs border shrink-0 capitalize ${riskLevelColor(item.severity)}`}>
                                  {item.severity}
                                </span>
                              )}
                            </div>
                            {item.subtitle && (
                              <span className="text-xs text-white/50 truncate">{item.subtitle}</span>
                            )}
                            {item.highlight && (
                              <span
                                className="text-xs text-white/70 truncate"
                                dangerouslySetInnerHTML={{ __html: sanitizeHighlight(item.highlight) }}
                              />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                  <div className="px-4 py-2 border-t border-white/10">
                    <a
                      href={viewAllHref}
                      onClick={(e) => {
                        e.preventDefault()
                        pushRecent(query.trim())
                        setOpen(false)
                        router.push(viewAllHref)
                      }}
                      className="text-sm text-[#F97316] hover:underline"
                    >
                      View all results →
                    </a>
                  </div>
                </>
              )}

              {query.trim() && !loading && results.length === 0 && (
                <div className="px-4 py-8 text-center text-white/50 text-sm">No results for &quot;{query}&quot;</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
