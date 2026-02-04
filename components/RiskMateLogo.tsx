'use client'

import { motion } from 'framer-motion'

interface RiskMateLogoProps {
  width?: number
  height?: number
  showText?: boolean
  className?: string
  animated?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function RiskMateLogo({
  width,
  height,
  showText = true,
  className = '',
  animated = false,
  size,
}: RiskMateLogoProps) {
  // Determine text size based on size prop or width
  const getTextSize = () => {
    if (size === 'sm') return 'text-sm'
    if (size === 'lg') return 'text-2xl'
    if (size === 'md') return 'text-lg'
    // Default based on width if provided
    if (width && width < 30) return 'text-sm'
    if (width && width > 50) return 'text-2xl'
    return 'text-base'
  }

  const textSize = getTextSize()

  const LogoText = () => (
    <span
      className={`font-bold tracking-tight text-[#F97316] ${textSize} ${className}`}
      style={{
        background: 'linear-gradient(135deg, #F97316 0%, #FF8A00 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      Riskmate
    </span>
  )

  if (animated) {
    return (
      <motion.div
        className="flex items-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <LogoText />
      </motion.div>
    )
  }

  return <LogoText />
}

