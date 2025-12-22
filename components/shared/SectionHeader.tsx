'use client'

type SectionHeaderProps = {
  title: string
  subtitle?: string
  className?: string
}

export function SectionHeader({ title, subtitle, className = '' }: SectionHeaderProps) {
  return (
    <div className={className}>
      <h2 className="text-3xl font-bold font-display mb-2">{title}</h2>
      {/* Thin orange hairline divider - signature landing page element */}
      <div className="h-[1px] w-24 bg-gradient-to-r from-[#F97316] via-[#FFC857] to-transparent mb-4" />
      {subtitle && (
        <p className="text-base text-white/70 mt-4">{subtitle}</p>
      )}
    </div>
  )
}

