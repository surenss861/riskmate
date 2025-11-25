'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createSupabaseBrowserClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (authError) {
      setError(authError.message)
    } else {
      router.push('/dashboard')
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
          onSubmit={handleLogin}
          className="bg-[#121212]/80 backdrop-blur-sm border border-white/10 rounded-xl p-8"
        >
          <div className="flex items-center justify-center mb-8">
            <RiskMateLogo size="lg" showText={true} />
          </div>

          <h1 className="text-3xl font-bold mb-2 font-display">Welcome Back</h1>
          <p className="text-[#A1A1A1] mb-8">Sign in to your RiskMate account</p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

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

            <div>
              <input
                type="password"
                placeholder="Password"
                className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-[#A1A1A1] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent transition"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#F97316] hover:bg-[#FB923C] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-black font-semibold transition-colors"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </div>

          <div className="mt-6 text-center">
            <a
              href="/forgot-password"
              className="text-sm text-[#A1A1A1] hover:text-[#F97316] transition-colors"
            >
              Forgot password?
            </a>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-sm text-[#A1A1A1]">
              Don&apos;t have an account?{' '}
              <a
                href="/signup"
                className="text-[#F97316] hover:text-[#FB923C] font-medium transition-colors"
              >
                Sign up
              </a>
            </p>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
