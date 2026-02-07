'use client'

interface RiskmateLogoAltProps {
  width?: number
  height?: number
  showText?: boolean
  className?: string
  variant?: 'shield' | 'badge' | 'minimal'
}

export default function RiskmateLogoAlt({
  width = 28,
  height = 28,
  showText = false,
  className = '',
  variant = 'shield',
}: RiskmateLogoAltProps) {
  const ShieldLogo = () => (
    <svg
      width={width}
      height={height}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F97316" />
          <stop offset="50%" stopColor="#FF8A00" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <path
        d="M20 2L6 8V20C6 28.5 12 35.5 20 38C28 35.5 34 28.5 34 20V8L20 2Z"
        fill="url(#shieldGrad)"
        stroke="rgba(249, 115, 22, 0.4)"
        strokeWidth="0.5"
      />
      <path
        d="M20 6L10 10.5V20C10 26 14.5 31 20 33C25.5 31 30 26 30 20V10.5L20 6Z"
        fill="rgba(255, 255, 255, 0.1)"
      />
      <path
        d="M15 20L18 23L25 16"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )

  const BadgeLogo = () => (
    <svg
      width={width}
      height={height}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <path
        d="M20 2L32 10V20L20 38L8 20V10L20 2Z"
        fill="url(#badgeGrad)"
        stroke="rgba(249, 115, 22, 0.3)"
        strokeWidth="0.5"
      />
      <circle cx="20" cy="20" r="8" fill="rgba(255, 255, 255, 0.15)" />
      <path
        d="M16 20L18.5 22.5L24 17"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )

  const MinimalLogo = () => (
    <svg
      width={width}
      height={height}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="minimalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#FF8A00" />
        </linearGradient>
      </defs>
      <path
        d="M20 4L8 9V19C8 26.5 13.5 33.5 20 36C26.5 33.5 32 26.5 32 19V9L20 4Z"
        fill="none"
        stroke="url(#minimalGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 20L18.5 22.5L24 17"
        stroke="url(#minimalGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )

  const LogoComponent = () => {
    switch (variant) {
      case 'badge':
        return <BadgeLogo />
      case 'minimal':
        return <MinimalLogo />
      default:
        return <ShieldLogo />
    }
  }

  return (
    <div className="flex items-center gap-2">
      <LogoComponent />
      {showText && (
        <span className="text-white/90 font-semibold tracking-tight text-sm">
          Riskmate
        </span>
      )}
    </div>
  )
}
