'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface EditableTextProps {
  value: string
  onSave: (newValue: string) => Promise<void>
  placeholder?: string
  className?: string
  inputClassName?: string
  multiline?: boolean
  maxLength?: number
}

export function EditableText({
  value,
  onSave,
  placeholder = 'Click to edit',
  className = '',
  inputClassName = '',
  multiline = false,
  maxLength,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select()
      }
    }
  }, [editing])

  const handleSave = async () => {
    if (draft === value || loading) {
      setEditing(false)
      return
    }

    if (draft.trim() === '') {
      setDraft(value)
      setEditing(false)
      return
    }

    setLoading(true)
    try {
      await onSave(draft.trim())
    } catch (error) {
      console.error('Failed to save:', error)
      setDraft(value) // Revert on error
    } finally {
      setLoading(false)
      setEditing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      setDraft(value)
      setEditing(false)
    } else if (e.key === 'Enter' && multiline && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    }
  }

  if (editing) {
    const InputComponent = multiline ? 'textarea' : 'input'
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative"
      >
        <InputComponent
          ref={inputRef as any}
          className={`bg-[#1A1A1A] border border-[#F97316] rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 ${inputClassName}`}
          value={draft}
          onChange={(e) => {
            const newValue = e.target.value
            if (!maxLength || newValue.length <= maxLength) {
              setDraft(newValue)
            }
          }}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          rows={multiline ? 3 : undefined}
          disabled={loading}
        />
        {maxLength && (
          <span className="absolute bottom-1 right-2 text-xs text-white/40">
            {draft.length}/{maxLength}
          </span>
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#F97316]" />
          </div>
        )}
      </motion.div>
    )
  }

  return (
    <motion.span
      className={`cursor-pointer hover:bg-white/5 px-1 py-0.5 rounded transition-colors inline-block ${className}`}
      onClick={() => setEditing(true)}
      whileHover={{ scale: 1.02 }}
      title="Click to edit"
    >
      {value || <span className="text-white/40 italic">{placeholder}</span>}
    </motion.span>
  )
}

