'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/operations')
  }, [router])

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-white/60">Redirecting to Operations Dashboard...</p>
      </div>
    </div>
  )
}

