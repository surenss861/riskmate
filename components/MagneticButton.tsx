'use client'

import { useRef, useEffect } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

interface MagneticButtonProps {
  children: React.ReactNode
  href?: string
  onClick?: () => void
  className?: string
}

export default function MagneticButton({ 
  children, 
  href, 
  onClick,
  className = '' 
}: MagneticButtonProps) {
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 300, damping: 30 })
  const springY = useSpring(y, { stiffness: 300, damping: 30 })

  useEffect(() => {
    const handleMouseMove = (e: Event) => {
      if (!ref.current) return
      
      const mouseEvent = e as MouseEvent
      const rect = ref.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      
      const distanceX = mouseEvent.clientX - centerX
      const distanceY = mouseEvent.clientY - centerY
      
      const strength = 0.3
      x.set(distanceX * strength)
      y.set(distanceY * strength)
    }

    const handleMouseLeave = () => {
      x.set(0)
      y.set(0)
    }

    const element = ref.current
    if (element) {
      element.addEventListener('mousemove', handleMouseMove)
      element.addEventListener('mouseleave', handleMouseLeave)
    }

    return () => {
      if (element) {
        element.removeEventListener('mousemove', handleMouseMove)
        element.removeEventListener('mouseleave', handleMouseLeave)
      }
    }
  }, [x, y])

  const Component = href ? 'a' : 'button'
  const baseClasses = 'px-8 py-3 border border-cyan-400 rounded-full hover:bg-cyan-400 hover:text-black transition-all relative inline-block'

  return (
    <motion.div
      style={{
        x: springX,
        y: springY,
      }}
    >
      <Component
        ref={ref as any}
        href={href}
        onClick={onClick}
        className={`${baseClasses} ${className}`}
      >
        {children}
      </Component>
    </motion.div>
  )
}

