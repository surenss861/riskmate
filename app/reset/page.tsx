'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { teamApi } from '@/lib/api'
import { motion } from 'framer-motion'
import Image from 'next/image'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Check if user has a valid session (from the reset link)
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push('/login')
      }
    })
  }, [router])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.updateUser({
      password: password,
    })

    setLoading(false)

    if (authError) {
      setError(authError.message)
    } else {
      try {
        await teamApi.acknowledgeReset()
      } catch (ackErr) {
        console.warn('Failed to acknowledge password reset', ackErr)
      }
      setSuccess(true)
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="mb-4 text-4xl">✓</div>
          <p className="text-xl font-semibold mb-2">Password updated successfully!</p>
          <p className="text-[#A1A1A1]">Redirecting to login...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[400px]"
      >
        <form
          onSubmit={handleUpdate}
          className="bg-[#121212]/80 backdrop-blur-sm border border-white/10 rounded-xl p-8"
        >
          <div className="flex items-center justify-center mb-8">
            <Image
              src="/riskmatefinal.png"
              alt="RiskMate"
              width={120}
              height={48}
              className="h-10 w-auto"
            />
          </div>

          <h1 className="text-3xl font-bold mb-2 font-display">Set New Password</h1>
          <p className="text-[#A1A1A1] mb-8">Enter your new password below</p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="New Password"
                className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-[#A1A1A1] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent transition"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            <div>
              <input
                type="password"
                placeholder="Confirm Password"
                className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-[#A1A1A1] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent transition"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#F97316] hover:bg-[#FB923C] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-black font-semibold transition-colors"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>

          <div className="mt-6 text-center">
            <a
              href="/login"
              className="text-sm text-[#A1A1A1] hover:text-[#F97316] transition-colors"
            >
              Back to Login
            </a>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

