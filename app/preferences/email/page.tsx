'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import RiskmateLogo from '@/components/RiskmateLogo'

type NotificationPreferences = {
  email_enabled: boolean
  job_assigned: boolean
  signature_requested: boolean
  mention: boolean
  email_deadline_reminder: boolean
  email_weekly_digest: boolean
  report_ready: boolean
  job_comment: boolean
  comment_resolved: boolean
  task_completed: boolean
}

const EMAIL_PREF_LABELS: Record<keyof NotificationPreferences, string> = {
  email_enabled: 'Email notifications',
  job_assigned: 'Job assigned',
  signature_requested: 'Signature requested',
  mention: 'Mentions',
  email_deadline_reminder: 'Deadline reminders',
  email_weekly_digest: 'Weekly digest',
  report_ready: 'Report ready',
  job_comment: 'Job comments',
  comment_resolved: 'Comment resolved',
  task_completed: 'Task completed',
}

function PreferencesEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/notifications/preferences/email?token=${encodeURIComponent(token)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? 'Failed to load preferences')
        setPrefs(null)
        return
      }
      setPrefs({
        email_enabled: data.email_enabled ?? true,
        job_assigned: data.job_assigned ?? true,
        signature_requested: data.signature_requested ?? true,
        mention: data.mention ?? true,
        email_deadline_reminder: data.email_deadline_reminder ?? true,
        email_weekly_digest: data.email_weekly_digest ?? true,
        report_ready: data.report_ready ?? true,
        job_comment: data.job_comment ?? true,
        comment_resolved: data.comment_resolved ?? true,
        task_completed: data.task_completed ?? true,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setPrefs(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const updatePref = (key: keyof NotificationPreferences, value: boolean) => {
    setPrefs((p) => (p ? { ...p, [key]: value } : null))
    setSaved(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !prefs) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/notifications/preferences/email', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...prefs }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? 'Failed to save')
        return
      }
      setSaved(true)
      setPrefs({
        email_enabled: data.email_enabled ?? true,
        job_assigned: data.job_assigned ?? true,
        signature_requested: data.signature_requested ?? true,
        mention: data.mention ?? true,
        email_deadline_reminder: data.email_deadline_reminder ?? true,
        email_weekly_digest: data.email_weekly_digest ?? true,
        report_ready: data.report_ready ?? true,
        job_comment: data.job_comment ?? true,
        comment_resolved: data.comment_resolved ?? true,
        task_completed: data.task_completed ?? true,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-6">
        <div className="w-full max-w-[400px] text-center">
          <div className="flex justify-center mb-6">
            <RiskmateLogo size="lg" showText={true} />
          </div>
          <h1 className="text-xl font-semibold mb-2">Invalid or missing link</h1>
          <p className="text-[#A1A1A1] mb-6">
            This link may have expired or is invalid. Use the link from your email, or sign in to manage notification settings.
          </p>
          <Link
            href="/login"
            className="inline-block px-4 py-2 rounded-lg bg-[#F97316] text-white font-medium hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-6">
        <div className="text-[#A1A1A1]">Loading preferences…</div>
      </div>
    )
  }

  if (error && !prefs) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-6">
        <div className="w-full max-w-[400px] text-center">
          <div className="flex justify-center mb-6">
            <RiskmateLogo size="lg" showText={true} />
          </div>
          <h1 className="text-xl font-semibold mb-2">Unable to load preferences</h1>
          <p className="text-[#A1A1A1] mb-6">{error}</p>
          <button
            type="button"
            onClick={() => load()}
            className="inline-block px-4 py-2 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[480px]">
        <div className="flex justify-center mb-6">
          <RiskmateLogo size="lg" showText={true} />
        </div>
        <h1 className="text-2xl font-bold mb-1">Email preferences</h1>
        <p className="text-[#A1A1A1] mb-8">
          Choose which emails you want to receive from RiskMate.
        </p>
        <form onSubmit={handleSave} className="bg-[#121212]/80 backdrop-blur-sm border border-white/10 rounded-xl p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          {saved && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
              Preferences saved.
            </div>
          )}
          <div className="space-y-4">
            {(Object.keys(EMAIL_PREF_LABELS) as (keyof NotificationPreferences)[]).map((key) => (
              <label
                key={key}
                className="flex items-center justify-between gap-4 cursor-pointer"
              >
                <span className="text-sm text-[#E5E5E5]">{EMAIL_PREF_LABELS[key]}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs?.[key]}
                  onClick={() => prefs && updatePref(key, !prefs[key])}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    prefs?.[key] ? 'bg-[#F97316]' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      prefs?.[key] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>
          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#F97316] text-white font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        </form>
        <p className="mt-6 text-center text-sm text-[#A1A1A1]">
          <Link href="/login" className="text-[#F97316] hover:underline">
            Sign in
          </Link>
          {' '}to access full account settings.
        </p>
      </div>
    </div>
  )
}

function PreferencesEmailFallback() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-6">
      <div className="text-[#A1A1A1]">Loading…</div>
    </div>
  )
}

export default function PreferencesEmailPage() {
  return (
    <Suspense fallback={<PreferencesEmailFallback />}>
      <PreferencesEmailContent />
    </Suspense>
  )
}
