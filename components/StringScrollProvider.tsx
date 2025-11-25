'use client'

import { useEffect } from 'react'
import { useStringScroll } from '@/lib/useStringScroll'

export default function StringScrollProvider({ children }: { children: React.ReactNode }) {
  useStringScroll()
  return <>{children}</>
}

