'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

export function DarkModeToggle() {
  const [isDark, setIsDark] = useState(true) // RiskMate is currently always dark

  useEffect(() => {
    // Future: Load from localStorage or system preference
    // For now, always dark mode
    setIsDark(true)
  }, [])

  const toggleTheme = () => {
    // Future: Implement light mode
    // For now, this is a placeholder for future implementation
    console.log('Theme toggle clicked - light mode coming soon!')
  }

  return (
    <button
      onClick={toggleTheme}
      className="relative w-12 h-6 rounded-full bg-white/10 border border-white/20 p-1 transition-colors"
      aria-label="Toggle dark mode"
      title="Dark mode (light mode coming soon)"
    >
      <motion.div
        className="w-4 h-4 rounded-full bg-[#F97316]"
        animate={{ x: isDark ? 0 : 24 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
      <span className="absolute inset-0 flex items-center justify-center text-xs">
        {isDark ? '🌙' : '☀️'}
      </span>
    </button>
  )
}

