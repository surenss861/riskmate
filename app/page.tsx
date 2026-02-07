'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import ScrollToTop from '@/components/ScrollToTop'
import RiskmateLogo from '@/components/RiskmateLogo'
import { SampleReportModal } from '@/components/marketing'
import { 
  EventChip, 
  TrustReceiptStrip, 
  IntegrityBadge, 
  EnforcementBanner, 
  PackCard 
} from '@/components/shared'

export default function HomePage() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [navOpacity, setNavOpacity] = useState(0.4)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sampleReportOpen, setSampleReportOpen] = useState(false)

  useEffect(() => {
    const handleOpenSampleReport = () => setSampleReportOpen(true)
    window.addEventListener('openSampleReport', handleOpenSampleReport as EventListener)
    return () => window.removeEventListener('openSampleReport', handleOpenSampleReport as EventListener)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      setScrolled(scrollY > 50)
      // Dynamic opacity based on scroll
      if (scrollY > 50) {
        setNavOpacity(Math.min(0.6 + (scrollY - 50) / 200, 0.8))
      } else {
        setNavOpacity(0.4)
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('nav')) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [mobileMenuOpen])

  return (
      <motion.main 
        className="min-h-screen bg-[#0A0A0A] text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        {/* Glass Sticky Navbar */}
        <nav 
          className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
            scrolled 
              ? 'backdrop-blur-xl border-b border-white/10' 
              : 'backdrop-blur-md border-b border-white/5'
          }`}
          style={{ backgroundColor: `rgba(0, 0, 0, ${navOpacity})` }}
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between py-5 px-6 min-w-0">
            <motion.div 
              className="flex items-center gap-3 flex-shrink-0 min-w-0"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <RiskmateLogo size="sm" showText={true} />
            </motion.div>
            <div className="hidden md:flex items-center gap-6 min-w-0 flex-wrap justify-end">
              <button
                onClick={() => router.push('/industries')}
                className="text-white/70 hover:text-white transition-colors text-sm"
              >
                Industries
              </button>
              <button
                onClick={() => {
                  const element = document.getElementById('how-it-works')
                  element?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="text-white/70 hover:text-white transition-colors text-sm"
              >
                Process
              </button>
              <button
                onClick={() => {
                  const element = document.getElementById('proof')
                  element?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="text-white/70 hover:text-white transition-colors text-sm"
              >
                Verification
              </button>
              <button
                onClick={() => {
                  const element = document.getElementById('pricing')
                  element?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="text-white/70 hover:text-white transition-colors text-sm"
              >
                Pricing
              </button>
              <button
                onClick={() => router.push('/demo')}
                className="text-white/70 hover:text-white transition-colors text-sm relative group flex items-center gap-1.5"
              >
                Demo
                <span className="px-1.5 py-0.5 text-xs bg-[#F97316]/20 text-[#F97316] border border-[#F97316]/30 rounded">
                  Interactive
                </span>
                <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-white group-hover:w-full transition-all duration-300" />
              </button>
              <button
                onClick={() => router.push('/login')}
                className="px-4 py-2 border border-white/20 hover:border-white/40 rounded-md font-medium text-sm transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => router.push('/login')}
                className="px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-md font-medium text-sm transition-colors"
              >
                Get Started
              </button>
            </div>
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white/70 hover:text-white transition-colors"
              aria-label="Menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Menu Drawer */}
          {mobileMenuOpen && (
            <motion.div
              className="md:hidden absolute top-full left-0 right-0 bg-black/95 backdrop-blur-xl border-b border-white/10"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="px-6 py-4 space-y-3">
                <button
                  onClick={() => {
                    router.push('/industries')
                    setMobileMenuOpen(false)
                  }}
                  className="block w-full text-left text-white/70 hover:text-white transition-colors py-2"
                >
                  Industries
                </button>
                <button
                  onClick={() => {
                    const element = document.getElementById('how-it-works')
                    element?.scrollIntoView({ behavior: 'smooth' })
                    setMobileMenuOpen(false)
                  }}
                  className="block w-full text-left text-white/70 hover:text-white transition-colors py-2"
                >
                  Process
                </button>
                <button
                  onClick={() => {
                    const element = document.getElementById('proof')
                    element?.scrollIntoView({ behavior: 'smooth' })
                    setMobileMenuOpen(false)
                  }}
                  className="block w-full text-left text-white/70 hover:text-white transition-colors py-2"
                >
                  Verification
                </button>
                <button
                  onClick={() => {
                    const element = document.getElementById('pricing')
                    element?.scrollIntoView({ behavior: 'smooth' })
                    setMobileMenuOpen(false)
                  }}
                  className="block w-full text-left text-white/70 hover:text-white transition-colors py-2"
                >
                  Pricing
                </button>
                <button
                  onClick={() => {
                    router.push('/demo')
                    setMobileMenuOpen(false)
                  }}
                  className="block w-full text-left text-white/70 hover:text-white transition-colors py-2 flex items-center gap-1.5"
                >
                  Demo
                  <span className="px-1.5 py-0.5 text-xs bg-[#F97316]/20 text-[#F97316] border border-[#F97316]/30 rounded">
                    Interactive
                  </span>
                </button>
                <button
                  onClick={() => {
                    router.push('/login')
                    setMobileMenuOpen(false)
                  }}
                  className="w-full px-4 py-2 border border-white/20 hover:border-white/40 rounded-md font-medium text-sm transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    router.push('/login')
                    setMobileMenuOpen(false)
                  }}
                  className="w-full px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-md font-medium text-sm transition-colors"
                >
                  Get Started
                </button>
              </div>
            </motion.div>
          )}
        </nav>

        {/* Spacer for fixed nav */}
        <div className="h-20" />

        {/* Hero — minimal, authority */}
        <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-[#0A0A0A]" />
          <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
            <div className="mb-6 text-[11px] text-white/50 tracking-wide uppercase">
              Riskmate
            </div>
            <div className="mb-2 text-sm text-white/40">
              Ledger-anchored records
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 font-display text-white">
              Audit-ready proof packs from everyday field work
            </h1>
            <p className="text-xl text-[#A1A1A1] mb-10 max-w-2xl mx-auto">
              Turn photos, logs, and site activity into evidence regulators accept.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.push('/signup')}
                className="px-8 py-4 bg-[#F97316] text-black rounded-lg hover:bg-[#FB923C] transition-colors font-semibold text-lg"
              >
                Start Free
              </button>
              <button
                onClick={() => setSampleReportOpen(true)}
                className="px-8 py-4 text-white/60 hover:text-white/90 transition-colors font-medium text-lg"
              >
                View Sample Audit
              </button>
            </div>
          </div>
        </section>

        {/* Process — Capture → Review → Anchor → Defend */}
        <section id="how-it-works" className="max-w-4xl mx-auto px-6 py-20 border-t border-white/5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6">
            <div>
              <div className="text-[#F97316] font-semibold text-sm mb-2">Capture</div>
              <p className="text-[#A1A1A1] text-sm leading-relaxed">
                Field evidence recorded as work happens.
              </p>
            </div>
            <div>
              <div className="text-[#F97316] font-semibold text-sm mb-2">Review</div>
              <p className="text-[#A1A1A1] text-sm leading-relaxed">
                Risks flagged before they compound.
              </p>
            </div>
            <div>
              <div className="text-[#F97316] font-semibold text-sm mb-2">Anchor</div>
              <p className="text-[#A1A1A1] text-sm leading-relaxed">
                Records frozen into the ledger.
              </p>
            </div>
            <div>
              <div className="text-[#F97316] font-semibold text-sm mb-2">Defend</div>
              <p className="text-[#A1A1A1] text-sm leading-relaxed">
                Proof packs exported for audits and claims.
              </p>
            </div>
          </div>
        </section>

        {/* Proof — real PDF packets */}
        <section id="proof" className="max-w-6xl mx-auto px-6 py-20 border-t border-white/5">
          <h2 className="text-2xl font-semibold text-white mb-8 text-center">Proof packs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Compliance Packet', pdf: '/Test-compliance-packet.pdf' },
              { name: 'Incident Packet', pdf: '/Test-incident-packet.pdf' },
              { name: 'Insurance Packet', pdf: '/Test-insurance-packet.pdf' },
              { name: 'Audit Packet', pdf: '/Test-audit-packet.pdf' },
            ].map((pack) => (
              <a
                key={pack.name}
                href={pack.pdf}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-6 bg-[#121212] border border-white/10 rounded-lg hover:border-white/20 transition-colors text-left group"
              >
                <div className="aspect-[3/4] mb-4 bg-white/5 rounded border border-white/5 overflow-hidden">
                  <object
                    data={`${pack.pdf}#page=1&view=FitH`}
                    type="application/pdf"
                    className="w-full h-full pointer-events-none"
                    aria-hidden
                  >
                    <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">
                      PDF
                    </div>
                  </object>
                </div>
                <div className="font-medium text-white mb-1 group-hover:text-[#F97316] transition-colors">{pack.name}</div>
                <div className="text-xs text-white/40">Generated Feb 7, 2026</div>
                <div className="text-[10px] text-white/30 mt-2">Immutable • Timestamped • Exported</div>
              </a>
            ))}
          </div>
        </section>

        {/* Enhanced Trust Signals Section */}
        <section className="max-w-6xl mx-auto px-6 py-16 border-t border-white/5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <p className="text-sm text-[#A1A1A1] mb-6">Used by general contractors and compliance teams across Canada</p>
            <div className="flex flex-wrap justify-center items-center gap-8 mb-8 opacity-60">
              {/* Placeholder company type logos */}
              <div className="px-6 py-3 bg-[#121212] rounded-lg border border-white/5 text-sm">Electrical Contractors</div>
              <div className="px-6 py-3 bg-[#121212] rounded-lg border border-white/5 text-sm">Roofing Companies</div>
              <div className="px-6 py-3 bg-[#121212] rounded-lg border border-white/5 text-sm">HVAC Services</div>
              <div className="px-6 py-3 bg-[#121212] rounded-lg border border-white/5 text-sm">General Contractors</div>
            </div>
            <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-[#A1A1A1]">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span>iPhone, iPad</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Android</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Web, PWA</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Industry compliance built-in</span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Proof Moments Section */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <motion.h2
            className="text-4xl font-bold text-center mb-4 font-display"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Proof Moments: Defensibility in Action
          </motion.h2>
          <motion.p
            className="text-[#A1A1A1] text-center mb-12 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Every action creates an immutable ledger event. Every evidence file is fingerprinted. Every pack is verifiable.
          </motion.p>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Proof Moment 1: Incident Closed */}
            <motion.div
              className="p-6 bg-[#121212] rounded-xl border border-white/5 space-y-4 min-w-0"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="text-2xl font-semibold text-white mb-4 truncate min-w-0">Incident Closed</div>
              <div className="min-w-0">
                <EventChip 
                  eventType="incident.closed"
                  severity="material"
                  outcome="success"
                  showOutcome
                />
              </div>
              <div className="min-w-0">
                <TrustReceiptStrip
                  actorName="Safety Lead"
                  actorRole="safety_lead"
                  occurredAt="2025-02-05T11:00:00.000Z"
                  eventType="incident.closed"
                  category="operations"
                  summary="Incident #INC-2025-001 closed with corrective actions"
                  reason="All hazards mitigated, attestation created"
                  compact
                />
              </div>
              <div className="flex-shrink-0">
                <IntegrityBadge
                  status="verified"
                  verifiedThrough="ledger_hash"
                  lastVerified="2025-02-05T12:00:00.000Z"
                />
              </div>
            </motion.div>

            {/* Proof Moment 2: Access Revoked */}
            <motion.div
              className="p-6 bg-[#121212] rounded-xl border border-white/5 space-y-4 min-w-0"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="text-2xl font-semibold text-white mb-4 truncate min-w-0">Access Revoked</div>
              <div className="min-w-0">
                <EventChip
                  eventType="access.revoked"
                  severity="material"
                  outcome="allowed"
                  showOutcome
                />
              </div>
              <div className="min-w-0">
                <TrustReceiptStrip
                  actorName="Admin"
                  actorRole="admin"
                  occurredAt="2025-02-05T10:00:00.000Z"
                  eventType="access.revoked"
                  category="access"
                  summary="Access revoked for former employee"
                  reason="Termination policy enforcement"
                  compact
                />
              </div>
              <div className="min-w-0">
                <EnforcementBanner
                  action="Revoke access"
                  blocked={false}
                  eventId="evt_access_revoked_001"
                  policyStatement="Access revoked per HR termination policy"
                  actorRole="admin"
                  severity="material"
                />
              </div>
            </motion.div>

            {/* Proof Moment 3: Proof Pack Generated */}
            <motion.div
              className="p-6 bg-[#121212] rounded-xl border border-white/5 space-y-4 min-w-0"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <div className="text-2xl font-semibold text-white mb-4 truncate min-w-0">Proof Pack Generated</div>
              <div className="min-w-0">
                <PackCard
                  packId="pack_abc123"
                  packType="proof"
                  generatedAt="2025-02-04T12:00:00.000Z"
                  generatedBy="Admin"
                  filters={{ job_id: 'job_xyz789', time_range: '30d' }}
                  contents={{
                    ledger_pdf: true,
                    controls_csv: true,
                    attestations_csv: true,
                    evidence_manifest: true,
                  }}
                  dataHash="sha256:abc123def456..."
                  fileSize={2048000}
                  eventCount={42}
                  integrityStatus="verified"
                  className="bg-black/20 border-white/10"
                />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Why We Win Section */}
        <section className="max-w-6xl mx-auto px-6 py-20 bg-gradient-to-b from-[#121212] to-transparent rounded-3xl border border-white/5">
          <motion.h2
            className="text-4xl font-bold text-center mb-4 font-display"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Why We Win
          </motion.h2>
          <motion.p
            className="text-[#A1A1A1] text-center mb-12 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            One simple comparison that shows why Riskmate is different
          </motion.p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <motion.div
              className="p-8 bg-red-500/10 border border-red-500/30 rounded-xl"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h3 className="text-2xl font-semibold text-red-400 mb-4">Checklists</h3>
              <div className="space-y-3 text-white/70">
                <div className="flex items-start gap-2">
                  <span className="text-red-400 text-xl">→</span>
                  <p>Capture data</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-400 text-xl">→</span>
                  <p>Generate proof packs</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-400 text-xl">→</span>
                  <p>Chain of custody</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-400 text-xl">→</span>
                  <p>No proof chain</p>
                </div>
              </div>
            </motion.div>
            <motion.div
              className="p-8 bg-green-500/10 border border-green-500/30 rounded-xl"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <h3 className="text-2xl font-semibold text-green-400 mb-4">Riskmate</h3>
              <div className="space-y-3 text-white/70">
                <div className="flex items-start gap-2">
                  <span className="text-green-400 text-xl">→</span>
                  <p>Enforcement logged</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400 text-xl">→</span>
                  <p>Ledger immutable</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400 text-xl">→</span>
                  <p>Proof pack generated</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400 text-xl">→</span>
                  <p>Verification badge</p>
                </div>
              </div>
            </motion.div>
          </div>
          <motion.p
            className="text-center mt-12 text-white/80 font-semibold max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Checklists capture data. Riskmate produces defensible proof.
          </motion.p>
        </section>

        {/* What Riskmate Is (and Is Not) Section */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <motion.h2
            className="text-4xl font-bold text-center mb-4 font-display"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            What Riskmate Is
          </motion.h2>
          <motion.p
            className="text-[#A1A1A1] text-center mb-8 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Riskmate is a <strong className="text-white">system of record for operational risk</strong> in high-liability field operations.
          </motion.p>
          <motion.div
            className="grid md:grid-cols-2 gap-6 mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl">
              <h3 className="text-lg font-semibold text-red-400 mb-4">Not:</h3>
              <ul className="space-y-2 text-white/70">
                <li>✗ A task manager</li>
                <li>✗ A safety checklist app</li>
                <li>✗ A &ldquo;construction SaaS&rdquo;</li>
                <li>✗ A document dumping tool</li>
              </ul>
            </div>
            <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-xl">
              <h3 className="text-lg font-semibold text-green-400 mb-4">Is:</h3>
              <ul className="space-y-2 text-white/70">
                <li>✓ A risk ledger (immutable records)</li>
                <li>✓ Governance enforcement (server-side)</li>
                <li>✓ Audit-ready proof packs (4 types)</li>
                <li>✓ Institutional memory (not workflow)</li>
              </ul>
            </div>
          </motion.div>
          <motion.h3
            className="text-2xl font-bold text-center mb-4 font-display"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            What Riskmate Replaces
          </motion.h3>
          <motion.p
            className="text-[#A1A1A1] text-center mb-12 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Stop juggling multiple tools and messy workflows. Here&apos;s what disappears when you use Riskmate.
          </motion.p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { old: 'Paper hazard forms', new: 'Digital checklists with auto-scoring' },
              { old: 'Photo albums in iMessage', new: 'Organized evidence gallery with timestamps' },
              { old: 'Google Drive folders', new: 'Centralized job dashboard' },
              { old: 'Manual PDF reports', new: 'One-click branded PDF generation' },
              { old: 'No audit trail', new: 'Complete chain of custody & compliance ledger' },
              { old: 'Lost signatures', new: 'Digital attestations with GPS verification' },
            ].map((item, index) => (
              <motion.div
                key={index}
                className="p-6 bg-[#121212] rounded-xl border border-white/5"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -3, borderColor: 'rgba(249, 115, 22, 0.3)' }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-red-400 text-xl">✗</div>
                  <div className="flex-1">
                    <p className="text-white/60 line-through text-sm">{item.old}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-green-400 text-xl">✓</div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{item.new}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Mobile App Promo Section */}
        <section className="max-w-6xl mx-auto px-6 py-20 bg-gradient-to-b from-[#121212] to-transparent rounded-3xl border border-white/5">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl font-bold mb-4 font-display">Capture evidence on-site</h2>
              <p className="text-xl text-[#A1A1A1] mb-6">
                The Riskmate mobile app lets you document jobs from anywhere—even without internet.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-[#F97316] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="font-semibold text-white">Offline mode support</p>
                    <p className="text-sm text-[#A1A1A1]">Capture hazards and photos without internet, sync when you&apos;re back online</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-[#F97316] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="font-semibold text-white">Instant sync with web dashboard</p>
                    <p className="text-sm text-[#A1A1A1]">Everything you capture on mobile appears instantly in your web dashboard</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-[#F97316] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="font-semibold text-white">GPS & weather metadata</p>
                    <p className="text-sm text-[#A1A1A1]">Every photo includes location and weather data for proof of presence</p>
                  </div>
                </li>
              </ul>
              <div className="flex gap-4">
                <button
                  onClick={() => router.push('/signup')}
                  className="px-6 py-3 bg-[#F97316] hover:bg-[#FB923C] text-black rounded-lg font-semibold transition-colors"
                >
                  Get Started
                </button>
                <button
                  onClick={() => router.push('/demo')}
                  className="px-6 py-3 border border-white/10 hover:border-white/20 text-white rounded-lg font-semibold transition-colors"
                >
                  View Demo
                </button>
              </div>
            </motion.div>
            <motion.div
              className="relative"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="aspect-[9/16] bg-gradient-to-br from-[#F97316]/20 to-[#F97316]/5 rounded-3xl border border-[#F97316]/20 p-8 flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-24 h-24 mx-auto mb-4 text-[#F97316]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <p className="text-white/60 text-sm">Mobile App</p>
                  <p className="text-white/40 text-xs mt-2">Coming Soon</p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Social Proof Section */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold mb-4 font-display">Built with real contractors</h2>
            <p className="text-[#A1A1A1] max-w-2xl mx-auto">
              Riskmate was built with feedback from dozens of electricians, roofers, HVAC technicians, and renovators during beta testing.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: 'Riskmate cut my reporting time in half. Clients love the professional PDFs.',
                author: 'James L.',
                role: 'Electrical Contractor',
              },
              {
                quote: 'The Permit Pack feature pays for itself every week. No more scrambling for documents.',
                author: 'Hector R.',
                role: 'Roofing Company Owner',
              },
              {
                quote: 'My team actually follows safety protocols now because it&apos;s so easy to document.',
                author: 'Carla M.',
                role: 'HVAC Supervisor',
              },
            ].map((testimonial, index) => (
              <motion.div
                key={index}
                className="p-6 bg-[#121212] rounded-xl border border-white/5"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <p className="text-white/70 italic mb-4">&ldquo;{testimonial.quote}&rdquo;</p>
                <div>
                  <p className="font-semibold text-white">{testimonial.author}</p>
                  <p className="text-sm text-[#A1A1A1]">{testimonial.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <motion.div
            className="text-center mt-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <p className="text-sm text-[#A1A1A1]">
              Used by dozens of contractors during beta testing • Built with industry compliance in mind
            </p>
          </motion.div>
        </section>

        {/* Case Studies Section */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold mb-4 font-display">See Riskmate in Action</h2>
            <p className="text-[#A1A1A1] max-w-2xl mx-auto">
              Real examples of how contractors use Riskmate for their specific trade. See sample jobs, hazards, mitigations, and reports.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Electrical Contractor',
                description: 'Commercial panel upgrade with live electrical work, confined spaces, and high-risk hazards.',
                riskScore: '78 (HIGH RISK)',
                link: '/case-studies/electrical',
                icon: '⚡',
              },
              {
                title: 'Roofing Company',
                description: 'High-rise flat roof replacement with fall protection, weather hazards, and permit compliance.',
                riskScore: '85 (CRITICAL)',
                link: '/case-studies/roofing',
                icon: '🏗️',
              },
              {
                title: 'HVAC Services',
                description: 'Commercial rooftop unit installation with refrigerant handling and confined space work.',
                riskScore: '68 (HIGH RISK)',
                link: '/case-studies/hvac',
                icon: '❄️',
              },
            ].map((study, index) => (
              <motion.div
                key={index}
                className="p-6 bg-[#121212] rounded-xl border border-white/5 hover:border-[#F97316]/30 transition-colors cursor-pointer group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                onClick={() => router.push(study.link)}
              >
                <div className="text-4xl mb-4">{study.icon}</div>
                <h3 className="text-xl font-semibold mb-2 group-hover:text-[#F97316] transition-colors">
                  {study.title}
                </h3>
                <p className="text-sm text-white/70 mb-4">{study.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#A1A1A1] bg-black/20 px-3 py-1 rounded">
                    Risk Score: {study.riskScore}
                  </span>
                  <svg className="w-5 h-5 text-[#F97316] group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </motion.div>
            ))}
          </div>
          <motion.div
            className="text-center mt-8"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <button
              onClick={() => router.push('/case-studies/electrical')}
              className="text-[#F97316] hover:text-[#FB923C] font-semibold transition-colors"
            >
              View All Case Studies →
            </button>
          </motion.div>
        </section>

        {/* Comparison Pages Section */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold mb-4 font-display">How Riskmate Compares</h2>
            <p className="text-[#A1A1A1] max-w-2xl mx-auto">
              See how Riskmate stacks up against other solutions contractors use for safety documentation.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'vs SafetyCulture', link: '/compare/safetyculture', description: 'Why contractors choose Riskmate' },
              { title: 'vs SiteDocs', link: '/compare/sitedocs', description: 'Job-centric vs document-centric' },
              { title: 'vs Pen & Paper', link: '/compare/pen-and-paper', description: 'Digital vs traditional' },
              { title: 'vs Spreadsheets', link: '/compare/spreadsheets', description: 'Purpose-built vs generic' },
            ].map((comparison, index) => (
              <motion.button
                key={index}
                onClick={() => router.push(comparison.link)}
                className="p-6 bg-[#121212] rounded-xl border border-white/5 hover:border-[#F97316]/30 transition-colors text-left group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <h3 className="text-lg font-semibold mb-2 group-hover:text-[#F97316] transition-colors">
                  {comparison.title}
                </h3>
                <p className="text-sm text-white/60 mb-3">{comparison.description}</p>
                <span className="text-[#F97316] text-sm font-medium group-hover:underline">
                  Compare →
                </span>
              </motion.button>
            ))}
          </div>
        </section>

        {/* Calculator Tools Section */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold mb-4 font-display">Free Safety Calculators</h2>
            <p className="text-[#A1A1A1] max-w-2xl mx-auto">
              Use these free tools to assess your risk, compliance, and potential savings. No signup required.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: 'Risk Score Calculator',
                description: 'Estimate your job\'s risk score',
                link: '/tools/risk-score-calculator',
                icon: '📊',
              },
              {
                title: 'Compliance Score',
                description: 'Check your safety compliance level',
                link: '/tools/compliance-score',
                icon: '✅',
              },
              {
                title: 'Incident Cost',
                description: 'Calculate the cost of workplace incidents',
                link: '/tools/incident-cost',
                icon: '💰',
              },
              {
                title: 'Time Saved',
                description: 'See how much time Riskmate saves',
                link: '/tools/time-saved',
                icon: '⏱️',
              },
            ].map((tool, index) => (
              <motion.button
                key={index}
                onClick={() => router.push(tool.link)}
                className="p-6 bg-[#121212] rounded-xl border border-white/5 hover:border-[#F97316]/30 transition-colors text-left group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <div className="text-3xl mb-3">{tool.icon}</div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-[#F97316] transition-colors">
                  {tool.title}
                </h3>
                <p className="text-sm text-white/60 mb-3">{tool.description}</p>
                <span className="text-[#F97316] text-sm font-medium group-hover:underline">
                  Calculate →
                </span>
              </motion.button>
            ))}
          </div>
        </section>

        {/* Proof Packs Section */}
        <section 
          id="proof"
          className="max-w-6xl mx-auto px-6 py-20"
        >
          <motion.h2 
            className="text-4xl font-bold text-center mb-4 font-display"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Proof Packs: Why Buyers Say &ldquo;This Is Real&rdquo;
          </motion.h2>
          <motion.p
            className="text-[#A1A1A1] text-center mb-12 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Every job can generate four exportable PDF proof packs. These are legal artifacts, not dashboards.
          </motion.p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: 'Insurance Packet',
                description: 'Completed job, risk score, flags, attachments, audit trail',
                icon: '🛡️',
                color: 'blue',
              },
              {
                title: 'Audit Packet',
                description: 'Role enforcement, violations, corrective actions, timeline',
                icon: '📋',
                color: 'yellow',
              },
              {
                title: 'Incident Packet',
                description: 'Flag escalation trail, accountability markers, decisions made',
                icon: '⚠️',
                color: 'red',
              },
              {
                title: 'Client Compliance Packet',
                description: 'Checklists, sign-offs, documentation, proof of work',
                icon: '✅',
                color: 'green',
              },
            ].map((pack, index) => (
              <motion.div
                key={pack.title}
                className="p-6 bg-[#121212] rounded-xl border border-white/5"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <div className="text-3xl mb-3">{pack.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{pack.title}</h3>
                <p className="text-white/70 text-sm">{pack.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Governance Model Section */}
        <section className="max-w-6xl mx-auto px-6 py-20 bg-[#121212]/50 rounded-3xl border border-white/5">
          <motion.h2 
            className="text-4xl font-bold text-center mb-4 font-display"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Deterministic Role Enforcement
          </motion.h2>
          <motion.p
            className="text-[#A1A1A1] text-center mb-12 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Capabilities are enforced at the API level, not the UI. Violations are logged as <code className="text-[#F97316]">auth.role_violation</code> with role, action, reason, and timestamp.
          </motion.p>
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { role: 'Owner', desc: 'Org authority, billing, deletion' },
              { role: 'Admin', desc: 'Team management, risk ops' },
              { role: 'Safety Lead', desc: 'Risk escalation authority' },
              { role: 'Executive', desc: 'Read-only, visibility only' },
              { role: 'Member', desc: 'Operational execution only' },
            ].map((r, index) => (
              <motion.div
                key={r.role}
                className="p-4 bg-black/20 rounded-lg border border-white/10"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <h3 className="font-semibold text-[#F97316] mb-1">{r.role}</h3>
                <p className="text-xs text-white/60">{r.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Who It's For Section */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <motion.h2 
            className="text-4xl font-bold text-center mb-4 font-display"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Who Riskmate Is For
          </motion.h2>
          <motion.p
            className="text-[#A1A1A1] text-center mb-12 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            High-liability field operations where mistakes are expensive and defensibility matters.
          </motion.p>
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <motion.div
              className="p-6 bg-[#121212] rounded-xl border border-white/5"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h3 className="text-xl font-semibold mb-4">Core Buyer Profiles</h3>
              <ul className="space-y-2 text-white/70">
                <li>• Safety Directors</li>
                <li>• Risk Managers</li>
                <li>• Compliance Leads</li>
                <li>• VP Operations</li>
                <li>• Executives responsible for exposure</li>
              </ul>
            </motion.div>
            <motion.div
              className="p-6 bg-[#121212] rounded-xl border border-white/5"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <h3 className="text-xl font-semibold mb-4">Core Industries</h3>
              <ul className="space-y-2 text-white/70">
                <li>• Trades (HVAC, Electrical, Plumbing, Roofing)</li>
                <li>• Facilities & Building Services</li>
                <li>• Fire & Life Safety</li>
                <li>• Infrastructure & Heavy Civil</li>
                <li>• Regulated field operations</li>
              </ul>
            </motion.div>
          </div>
          <motion.p
            className="text-center text-white/60 italic max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            They don&apos;t want &ldquo;productivity&rdquo;. They want defensibility.
          </motion.p>
        </section>


        {/* Pricing - Minimal Cards */}
        <section 
          id="pricing" 
          className="max-w-6xl mx-auto px-6 py-20"
          data-string=""
          data-string-show=""
        >
          <motion.h2 
            className="text-4xl font-bold text-center mb-4 font-display"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Simple, transparent pricing
          </motion.h2>
          <motion.p 
            className="text-[#A1A1A1] text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
          For teams that need audit-proof compliance.
          </motion.p>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Starter */}
            <motion.div 
              className="card p-8 bg-[#121212] rounded-xl border border-white/5 md:order-1"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              whileHover={{ y: -3, backgroundColor: '#1a1a1a' }}
            >
              <h3 className="text-2xl font-semibold mb-1">Starter</h3>
              <p className="text-sm text-white/50 mb-4">Solo contractors & small crews</p>
              <div className="mb-2">
                <span className="text-4xl font-bold">$29</span>
                <span className="text-[#A1A1A1]">/mo</span>
              </div>
              <p className="text-xs text-[#A1A1A1] mb-6">per business</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-[#A1A1A1]">10 jobs per month</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-[#A1A1A1]">Automatic risk scores</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-[#A1A1A1]">Branded watermark PDFs</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-[#A1A1A1]">View-only reports</span>
                </li>
              </ul>
              <button
                onClick={() => router.push('/signup?plan=starter')}
                className="w-full px-6 py-3 border border-white/10 rounded-lg hover:bg-white/5 transition-colors font-semibold btn-secondary"
              >
                Start Free
              </button>
            </motion.div>

            {/* Pro - Popular with minimal accent */}
            <motion.div 
              className="card card-popular p-8 bg-[#121212] rounded-xl border border-white/5 relative md:order-2"
              style={{ boxShadow: '0 0 40px rgba(249, 115, 22, 0.25)' }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              whileHover={{ y: -3, backgroundColor: '#1a1a1a' }}
            >
              <div className="text-xs font-semibold text-[#F97316] mb-2">Most Popular</div>
              <h3 className="text-2xl font-semibold mb-1">Pro</h3>
              <p className="text-sm text-white/50 mb-4">Growing teams managing active jobs</p>
              <div className="mb-2">
                <span className="text-4xl font-bold">$59</span>
                <span className="text-[#A1A1A1]">/mo</span>
              </div>
              <p className="text-xs text-[#A1A1A1] mb-6">per business</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <span className="text-[#F97316] mr-2">✓</span>
                  <span className="text-white font-semibold">Unlimited jobs</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-white font-semibold">Up to 5 team seats</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-[#A1A1A1]">Branded PDFs + notifications</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-[#A1A1A1]">Live, shareable reports</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-[#A1A1A1]">Priority email support</span>
                </li>
              </ul>
              <button
                onClick={() => router.push('/signup?plan=pro')}
                className="w-full px-6 py-3 bg-[#F97316] text-black rounded-lg hover:bg-[#FB923C] transition-colors font-semibold btn-primary"
              >
                Start Pro →
              </button>
            </motion.div>

            {/* Business */}
            <motion.div 
            className="card p-8 bg-gradient-to-b from-[#121212] via-[#1a1a1a] to-[#121212] rounded-xl border border-white/5 md:order-3 relative"
            style={{ boxShadow: '0 0 55px rgba(250, 204, 85, 0.25)' }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              whileHover={{ y: -3, backgroundColor: '#1a1a1a' }}
            >
            <div className="border-t-2 border-[#FACC15]/30 mb-4 -mx-8 -mt-8"></div>
            <div className="text-xs font-semibold text-[#FACC15] mb-2">Audit-Ready</div>
              <h3 className="text-2xl font-semibold mb-1">Business</h3>
              <p className="text-sm text-white/50 mb-4">Companies facing inspections & insurers</p>
              <div className="mb-2">
                <span className="text-4xl font-bold">$129</span>
                <span className="text-[#A1A1A1]">/mo</span>
              </div>
              <p className="text-xs text-[#A1A1A1] mb-1">per business</p>
              <p className="text-xs text-white/50 mb-6 italic">Used by teams that need inspection-safe documentation.</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                <span className="text-[#FACC15] mr-2">✓</span>
                  <span className="text-[#A1A1A1]">Unlimited seats</span>
                </li>
                <li className="flex items-start">
                <span className="text-[#FACC15] mr-2">✓</span>
                <span className="text-white font-semibold">Permit Pack Generator (ZIP bundle)</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#FACC15] mr-2">✓</span>
                <span className="text-[#A1A1A1]">Org-level dashboard analytics</span>
                </li>
                <li className="flex items-start">
                <span className="text-[#FACC15] mr-2">✓</span>
                <span className="text-white font-semibold">Immutable audit history</span>
                </li>
                <li className="flex items-start">
                <span className="text-[#FACC15] mr-2">✓</span>
                <span className="text-[#A1A1A1]">Dedicated onboarding & phone support</span>
                </li>
              </ul>
              <button
                onClick={() => router.push('/signup?plan=business')}
              className="w-full px-6 py-3 border border-[#FACC15]/40 text-[#FACC15] rounded-lg hover:bg-[#FACC15]/10 transition-colors font-semibold"
              >
              Start Business →
              </button>
            </motion.div>
          </div>

          <p className="text-center text-sm text-[#A1A1A1] mt-8">
            No setup fees. Cancel anytime.
          </p>
        </section>

        {/* Final CTA - Minimal */}
        <section 
          className="max-w-4xl mx-auto px-6 py-24 text-center"
          data-string=""
          data-string-show=""
        >
          <motion.h2 
            className="text-4xl font-bold mb-8 font-display"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Be bid-ready and insurer-ready <span className="text-[#F97316]">in minutes</span>
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            whileHover={{ scale: 1.05 }}
          >
            <motion.button
              onClick={() => router.push('/signup')}
              className="px-8 py-4 bg-[#F97316] text-black rounded-lg hover:bg-[#FB923C] transition-all font-semibold text-lg inline-block btn-primary relative overflow-hidden group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="relative z-10">Generate My First Report →</span>
              <motion.span
                className="absolute inset-0 bg-white/20"
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 1,
                }}
              />
            </motion.button>
          </motion.div>
        </section>

        {/* Founder Story Section */}
        <section className="max-w-4xl mx-auto px-6 py-20">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold mb-6 font-display">Why Riskmate Exists</h2>
            <div className="bg-[#121212] rounded-xl border border-white/10 p-8 text-left">
              <p className="text-lg text-white/80 leading-relaxed mb-4">
                After talking to dozens of contractors across Canada, one thing was consistent:
              </p>
              <p className="text-xl text-white font-semibold mb-6 italic">
                &ldquo;Safety paperwork was a mess.&rdquo;
              </p>
              <p className="text-lg text-white/80 leading-relaxed mb-4">
                Electricians were taking photos in iMessage, losing them, then scrambling to recreate reports when clients asked. Roofers were filling out paper forms that got lost or damaged. HVAC crews were using Google Drive folders that no one could find.
              </p>
              <p className="text-lg text-white/80 leading-relaxed">
                <strong className="text-white">Riskmate fixes that.</strong> One clean dashboard. Everything timestamped. Audit-ready reports in one click. No more lost paperwork, no more scrambling, no more liability gaps.
              </p>
              <div className="mt-8 pt-8 border-t border-white/10">
                <p className="text-sm text-[#A1A1A1]">
                  Built by contractors, for contractors. Every feature was designed with real field work in mind.
                </p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Footer - Minimal */}
        <footer className="border-t border-white/5 px-6 py-8">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#A1A1A1]">
            <div>Built in North America • © Riskmate 2025</div>
            <div className="flex gap-6 flex-wrap justify-center">
              <button
                onClick={() => router.push('/demo')}
                className="hover:text-white transition-colors flex items-center gap-1.5"
              >
                Demo
                <span className="px-1.5 py-0.5 text-xs bg-[#F97316]/20 text-[#F97316] border border-[#F97316]/30 rounded">
                  Interactive
                </span>
              </button>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-white transition-colors">Terms</a>
              <a href="mailto:hello@riskmate.com" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </footer>

        {/* Scroll to Top */}
        <ScrollToTop />

        {/* Sample Report Modal */}
        <SampleReportModal isOpen={sampleReportOpen} onClose={() => setSampleReportOpen(false)} />
      </motion.main>
  )
}
