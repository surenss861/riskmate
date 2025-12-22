'use client'

type PageHeaderProps = {
  title: string
  subtitle?: string
  showDivider?: boolean
  className?: string
}

/**
 * PageHeader - Editorial-style page header matching landing page
 * Uses serif font for title, optional orange hairline divider
 */
export function PageHeader({ 
  title, 
  subtitle, 
  showDivider = true,
  className = '' 
}: PageHeaderProps) {
  return (
    <div className={`mb-12 ${className}`}>
      <h1 className="text-4xl md:text-5xl font-bold font-display mb-3">
        {title}
      </h1>
      {showDivider && (
        <div className="h-[1px] w-24 bg-gradient-to-r from-[#F97316] via-[#FFC857] to-transparent mb-4" />
      )}
      {subtitle && (
        <p className="text-lg text-white/70 mt-4">
          {subtitle}
        </p>
      )}
    </div>
  )
}

