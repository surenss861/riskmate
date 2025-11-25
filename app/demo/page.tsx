'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import RiskMateLogo from '@/components/RiskMateLogo'

// Demo data - pre-seeded job
const DEMO_JOB = {
    id: 'demo-job-001',
    client_name: 'Downtown Office Complex',
    address: '123 Main St, Suite 400',
    job_type: 'HVAC Installation',
    risk_score: 78,
    risk_level: 'High' as const,
    mitigation_items: [
        { id: '1', text: 'Install guardrails at roof edges', done: true },
        { id: '2', text: 'Verify subcontractor COI is current', done: true },
        { id: '3', text: 'Post warning signs in public access areas', done: false },
        { id: '4', text: 'Lock out electrical panels before work', done: false },
        { id: '5', text: 'Assign safety spotter for height work', done: false },
        { id: '6', text: 'Review emergency evacuation plan with crew', done: false },
    ],
    risk_factors: ['Height work', 'Public access', 'Electrical', 'Subcontractors'],
    created_at: new Date().toISOString(),
}

export default function DemoPage() {
    const router = useRouter()
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 60)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const handleGeneratePDF = () => {
        // Simulate PDF generation
        setPdfUrl('/demo-report.pdf')
        // Track event (if PostHog is available)
        if (typeof window !== 'undefined' && (window as any).posthog) {
            (window as any).posthog.capture('report_generated', {
                job_id: DEMO_JOB.id,
                risk_score: DEMO_JOB.risk_score,
                source: 'demo'
            })
        }
    }

    const handleCopyLink = () => {
        const link = `${window.location.origin}/reports/${DEMO_JOB.id}`
        navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleSendToBroker = () => {
        // Open email client with pre-filled message
        const subject = encodeURIComponent('Risk Snapshot Report - Downtown Office Complex')
        const body = encodeURIComponent(
            `Hi,\n\nPlease find the Risk Snapshot Report for the HVAC installation job at 123 Main St.\n\nView report: ${window.location.origin}/reports/${DEMO_JOB.id}\n\nBest regards`
        )
        window.location.href = `mailto:broker@example.com?subject=${subject}&body=${body}`
    }

    const getScoreColor = (score: number) => {
        if (score >= 71) return 'text-red-400'
        if (score >= 41) return 'text-[#F97316]'
        return 'text-green-400'
    }

    const getScoreBg = (score: number) => {
        if (score >= 71) return 'bg-red-500/10 border-red-500/30'
        if (score >= 41) return 'bg-[#F97316]/10 border-[#F97316]/30'
        return 'bg-green-500/10 border-green-500/30'
    }

    const completedCount = DEMO_JOB.mitigation_items.filter(m => m.done).length
    const totalCount = DEMO_JOB.mitigation_items.length

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white">
            {/* Glass Sticky Navbar */}
            <nav
                className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${scrolled
                    ? 'backdrop-blur-md bg-black/60 border-b border-white/10'
                    : 'backdrop-blur-sm bg-black/40 border-b border-white/5'
                    }`}
            >
                <div className="max-w-6xl mx-auto flex items-center justify-between py-4 px-6">
                    <motion.div
                        className="flex items-center gap-3"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4 }}
                    >
                        <RiskMateLogo size="sm" showText={true} />
                        <span className="text-xs text-white/50 ml-2">Demo</span>
                    </motion.div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/')}
                            className="text-white/70 hover:text-white transition-colors text-sm relative group"
                        >
                            Back to Home
                            <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-white group-hover:w-full transition-all duration-300" />
                        </button>
                        <button
                            onClick={() => router.push('/signup')}
                            className="px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-white rounded-md font-medium text-sm transition-colors btn-primary"
                        >
                            Start Free →
                        </button>
                    </div>
                </div>
            </nav>

            {/* Spacer for fixed nav */}
            <div className="h-16" />

            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Job Header */}
                <motion.div
                    className="mb-12"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <h1 className="text-5xl font-bold mb-3 font-display">{DEMO_JOB.client_name}</h1>
                    <p className="text-xl text-[#A1A1A1] mb-1">{DEMO_JOB.address}</p>
                    <p className="text-sm text-[#A1A1A1]/70">{DEMO_JOB.job_type}</p>
                </motion.div>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Left: Risk Score Gauge */}
                    <motion.div
                        className="lg:col-span-1"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                    >
                        <div className={`p-8 rounded-xl border ${getScoreBg(DEMO_JOB.risk_score)} bg-[#121212]/80 backdrop-blur-sm`}>
                            <div className="text-center mb-8">
                                <div className={`text-8xl font-bold mb-3 ${getScoreColor(DEMO_JOB.risk_score)}`}>
                                    {DEMO_JOB.risk_score}
                                </div>
                                <div className="text-2xl font-semibold mb-2 text-white">
                                    {DEMO_JOB.risk_level} Risk
                                </div>
                                <div className="text-sm text-[#A1A1A1]">
                                    {DEMO_JOB.risk_factors.length} risk factors detected
                                </div>
                            </div>

                            {/* Risk Factors */}
                            <div className="space-y-3 mb-8">
                                {DEMO_JOB.risk_factors.map((factor, i) => (
                                    <div key={i} className="flex items-center gap-3 text-sm">
                                        <div className="w-2 h-2 rounded-full bg-[#F97316]" />
                                        <span className="text-[#A1A1A1]">{factor}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Mitigation Progress */}
                            <div className="pt-6 border-t border-white/10">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm text-[#A1A1A1]">Mitigation Progress</span>
                                    <span className="text-sm font-semibold text-white">
                                        {completedCount}/{totalCount}
                                    </span>
                                </div>
                                <div className="w-full bg-black/40 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="bg-[#F97316] h-2.5 rounded-full transition-all duration-500"
                                        style={{ width: `${(completedCount / totalCount) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Middle: Mitigation Checklist */}
                    <motion.div
                        className="lg:col-span-1"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                    >
                        <div className="p-8 rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm h-full">
                            <h2 className="text-2xl font-semibold mb-6 text-white">Mitigation Checklist</h2>
                            <div className="space-y-2">
                                {DEMO_JOB.mitigation_items.map((item) => (
                                    <label
                                        key={item.id}
                                        className="flex items-start gap-3 p-4 rounded-lg hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={item.done}
                                            readOnly
                                            className="mt-1 w-5 h-5 rounded border-white/20 bg-black/40 text-[#F97316] focus:ring-[#F97316] focus:ring-2"
                                        />
                                        <span className={`flex-1 text-sm ${item.done ? 'line-through text-[#A1A1A1]/50' : 'text-[#A1A1A1]'}`}>
                                            {item.text}
                                        </span>
                                    </label>
                                ))}
                            </div>
                            <p className="text-sm text-[#A1A1A1] mt-6 pt-6 border-t border-white/10">
                                Checking items reduces your risk score. Complete all items before starting work.
                            </p>
                        </div>
                    </motion.div>

                    {/* Right: Actions */}
                    <motion.div
                        className="lg:col-span-1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.3 }}
                    >
                        <div className="p-8 rounded-xl border border-white/10 bg-[#121212]/80 backdrop-blur-sm h-full flex flex-col">
                            <h2 className="text-2xl font-semibold mb-6 text-white">Actions</h2>

                            <div className="space-y-3 flex-1">
                                {/* Generate PDF */}
                                <button
                                    onClick={handleGeneratePDF}
                                    className="w-full px-6 py-4 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg transition-colors font-semibold"
                                >
                                    {pdfUrl ? '✓ PDF Generated' : 'Generate PDF Report'}
                                </button>

                                {pdfUrl && (
                                    <>
                                        <button
                                            onClick={handleCopyLink}
                                            className="w-full px-6 py-3 border border-white/20 text-white rounded-lg hover:bg-white/5 transition-colors"
                                        >
                                            {copied ? '✓ Link Copied' : 'Copy Client Link'}
                                        </button>

                                        <button
                                            onClick={handleSendToBroker}
                                            className="w-full px-6 py-3 border border-[#F97316] text-[#F97316] rounded-lg hover:bg-[#F97316]/10 transition-colors"
                                        >
                                            Send to Broker
                                        </button>
                                    </>
                                )}
                            </div>

                            <div className="pt-6 mt-auto border-t border-white/10">
                                <p className="text-sm text-[#A1A1A1] mb-3">
                                    <strong className="text-white">Starter:</strong> $29/mo — 10 jobs, RiskMate watermark
                                </p>
                                <p className="text-sm text-[#A1A1A1]">
                                    <strong className="text-white">Pro:</strong> $59/mo — Unlimited jobs, branded PDFs, your logo
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Demo Notice */}
                <motion.div
                    className="mt-12 p-6 bg-[#121212]/80 backdrop-blur-sm border border-white/10 rounded-xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                >
                    <p className="text-sm text-[#A1A1A1] text-center">
                        This is a demo. <button
                            onClick={() => router.push('/signup')}
                            className="text-[#F97316] hover:text-[#FB923C] font-medium transition-colors"
                        >
                            Sign up
                        </button> to create real jobs and generate unlimited reports.
                    </p>
                </motion.div>
            </div>
        </div>
    )
}

