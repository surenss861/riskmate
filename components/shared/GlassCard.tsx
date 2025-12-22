'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

type GlassCardProps = {
  children: ReactNode
  className?: string
  href?: string
  onClick?: () => void
  initial?: any
  animate?: any
  transition?: any
}

export function GlassCard({
  children,
  className,
  href,
  onClick,
  initial,
  animate,
  transition,
}: GlassCardProps) {
  const cardContent = (
    <motion.div
      initial={initial || { opacity: 0, y: 24 }}
      animate={animate || { opacity: 1, y: 0 }}
      transition={transition || { duration: 0.45 }}
      className={clsx(
        'relative overflow-hidden rounded-3xl border border-white/10',
        'bg-white/[0.03] backdrop-blur-xl',
        'shadow-[0_4px_24px_rgba(0,0,0,0.15)]',
        href || onClick ? 'cursor-pointer transition-transform hover:scale-[1.01]' : '',
        className
      )}
      onClick={onClick}
    >
      {children}
    </motion.div>
  )

  if (href) {
    return <a href={href}>{cardContent}</a>
  }

  return cardContent
}

