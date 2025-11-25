'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      // Use API route to create user + organization
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed')
      }

      // Sign in with the created user
      const supabase = createSupabaseBrowserClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        throw new Error(signInError.message)
      }

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to create account')
      setLoading(false)
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
          onSubmit={handleSignup}
          className="bg-[#121212]/80 backdrop-blur-sm border border-white/10 rounded-xl p-8"
        >
          <div className="flex items-center justify-center mb-8">
            <RiskMateLogo size="lg" showText={true} />
          </div>

          <h1 className="text-3xl font-bold mb-2 font-display">Create Account</h1>
          <p className="text-[#A1A1A1] mb-8">Start protecting every job before it starts</p>

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
                minLength={6}
              />
              <p className="text-xs text-[#A1A1A1] mt-2">Minimum 6 characters</p>
            </div>

            <div>
              <input
                type="password"
                placeholder="Confirm Password"
                className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder:text-[#A1A1A1] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent transition"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              {loading ? 'Creating...' : 'Sign Up'}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-sm text-[#A1A1A1]">
              Already have an account?{' '}
              <a
                href="/login"
                className="text-[#F97316] hover:text-[#FB923C] font-medium transition-colors"
              >
                Log in
              </a>
            </p>
          </div>

          <p className="mt-6 text-xs text-center text-[#A1A1A1]">
            By signing up, you agree to our{' '}
            <a href="/terms" className="text-[#F97316] hover:underline">
              Terms
            </a>{' '}
            and{' '}
            <a href="/privacy" className="text-[#F97316] hover:underline">
              Privacy Policy
            </a>
          </p>
        </form>
      </motion.div>
    </div>
  )
}
