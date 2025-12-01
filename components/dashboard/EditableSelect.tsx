'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface EditableSelectProps {
  value: string
  options: Array<{ value: string; label: string; color?: string }>
  onSave: (newValue: string) => Promise<void>
  className?: string
}

export function EditableSelect({
  value,
  options,
  onSave,
  className = '',
}: EditableSelectProps) {
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setEditing(false)
      }
    }

    if (editing) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [editing])

  const handleSelect = async (newValue: string) => {
    if (newValue === value || loading) {
      setEditing(false)
      return
    }

    setLoading(true)
    try {
      await onSave(newValue)
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setLoading(false)
      setEditing(false)
    }
  }

  const currentOption = options.find((opt) => opt.value === value) || options[0]

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        onClick={() => !loading && setEditing(true)}
        className={`px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2 ${className}`}
        whileHover={{ scale: 1.02 }}
        disabled={loading}
      >
        <span
          className="text-sm font-medium"
          style={{ color: currentOption.color || 'inherit' }}
        >
          {currentOption.label}
        </span>
        {!loading && (
          <svg
            className="w-4 h-4 text-white/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
        {loading && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#F97316]" />
        )}
      </motion.button>

      <AnimatePresence>
        {editing && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setEditing(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-full left-0 mt-2 z-20 bg-[#1A1A1A] border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[200px]"
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors ${
                    option.value === value ? 'bg-[#F97316]/20' : ''
                  }`}
                  style={{ color: option.color || 'inherit' }}
                >
                  {option.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

