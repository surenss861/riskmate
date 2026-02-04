'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import Image from 'next/image'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`,
    })

    setLoading(false)

    if (authError) {
      setError(authError.message)
    } else {
      setSent(true)
    }
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
          onSubmit={handleReset}
          className="bg-[#121212]/80 backdrop-blur-sm border border-white/10 rounded-xl p-8"
        >
          <div className="flex items-center justify-center mb-8">
            <Image
              src="/riskmatefinal.png"
              alt="Riskmate"
              width={120}
              height={48}
              className="h-10 w-auto"
            />
          </div>

          <h1 className="text-3xl font-bold mb-2 font-display">Reset Your Password</h1>
          <p className="text-[#A1A1A1] mb-8">
            Enter your email and we&apos;ll send you a reset link
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {sent ? (
            <div className="text-center py-8">
              <div className="mb-4 text-4xl">✓</div>
              <p className="text-white/80 mb-2">Reset link sent!</p>
              <p className="text-sm text-[#A1A1A1] mb-6">
                Check your inbox and click the link to reset your password.
              </p>
              <a
                href="/login"
                className="text-[#F97316] hover:text-[#FB923C] text-sm font-medium transition-colors"
              >
                Back to Login
              </a>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <input
                    type="email"
                    placeholder="Email"
                    className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-[#A1A1A1] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent transition"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#F97316] hover:bg-[#FB923C] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-black font-semibold transition-colors"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
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
            </>
          )}
        </form>
      </motion.div>
    </div>
  )
}

