'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import ScrollToTop from '@/components/ScrollToTop'
import RiskmateLogo from '@/components/RiskmateLogo'
import { SampleReportModal } from '@/components/marketing'

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const ro = new ResizeObserver(() => setWidth(el.getBoundingClientRect().width))
    setWidth(el.getBoundingClientRect().width)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return { ref, width }
}

const heroVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}
const heroItem = {
  hidden: { opacity: 0, y: 10, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
}

function HeroSection({ onSignup, onSampleReport }: { onSignup: () => void; onSampleReport: () => void }) {
  const { ref: titleWrapRef, width } = useElementWidth<HTMLDivElement>()
  const prefersReducedMotion = useReducedMotion() ?? false
  const underlineWidth = Math.max(120, Math.min(width * 0.32, 220))

  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-visible">
      <div className="absolute inset-0 bg-[#0A0A0A]" />
      <motion.div
        className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center"
        variants={heroVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={heroItem} className="mb-6">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 text-[10px] font-mono text-white/70 tracking-[0.12em] uppercase">
            {prefersReducedMotion ? (
              <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
            ) : (
              <motion.span
                className="w-1.5 h-1.5 rounded-full bg-[#F97316]"
                animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.15, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            Verified outputs
          </span>
        </motion.div>

        <motion.div variants={heroItem} className="relative inline-block mb-8">
          <div ref={titleWrapRef} className="relative inline-block">
            <h1 className="font-display text-5xl md:text-6xl font-bold leading-tight text-white">
              Audit-ready proof packs from
              <br />
              everyday field work
            </h1>
            <div
              className="absolute left-1/2 -translate-x-1/2 -bottom-4 h-[4px]"
              style={{ width: underlineWidth }}
            >
              <div className="absolute inset-0 rounded-full bg-white/10" />
              <motion.div
                initial={prefersReducedMotion ? { scaleX: 1, opacity: 1, filter: 'blur(0px)' } : { scaleX: 0, opacity: 0, filter: 'blur(6px)' }}
                animate={
                  prefersReducedMotion
                    ? { scaleX: 1, opacity: 1 }
                    : { scaleX: [0, 1.08, 1], opacity: [0, 1, 1], filter: ['blur(6px)', 'blur(0px)', 'blur(0px)'] }
                }
                transition={
                  prefersReducedMotion
                    ? { duration: 0.4, delay: 0.2 }
                    : { duration: 0.85, delay: 0.18, times: [0, 0.72, 1], ease: [0.16, 1, 0.3, 1] }
                }
                style={{
                  width: underlineWidth,
                  transformOrigin: 'center',
                  willChange: 'transform, opacity, filter',
                }}
                className="absolute inset-0 h-[4px] rounded-full bg-[#F97316] shadow-[0_0_18px_rgba(249,115,22,0.55)]"
              />
            </div>
          </div>
        </motion.div>

        <motion.p variants={heroItem} className="text-xl text-[#A1A1A1] mb-2 max-w-2xl mx-auto">
          Immutable compliance ledger + evidence chain-of-custody. Export audit packets in one click.
        </motion.p>
        <motion.p variants={heroItem} className="text-sm text-white/50 mb-4 italic">
          The thing you hand over when someone asks questions.
        </motion.p>
        <motion.p variants={heroItem} className="text-xs text-white/40 font-mono mb-10">
          If it isn&apos;t anchored, it doesn&apos;t exist.
        </motion.p>
        <motion.div variants={heroItem} className="flex flex-col sm:flex-row gap-4 justify-center">
          <motion.button
            onClick={onSignup}
            className="relative overflow-hidden px-8 py-4 bg-[#F97316] text-black rounded-lg hover:bg-[#FB923C] transition-colors font-semibold text-lg"
          >
            <span className="relative z-10">Start Free</span>
            {!prefersReducedMotion && (
              <motion.span
                className="pointer-events-none absolute inset-y-0 left-0 w-[45%] bg-white/35 blur-md"
                initial={{ x: '-120%', opacity: 0 }}
                animate={{ x: '120%', opacity: [0, 0.6, 0] }}
                transition={{ duration: 1.1, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
                style={{ willChange: 'transform, opacity' }}
              />
            )}
          </motion.button>
          <button
            onClick={onSampleReport}
            className="px-8 py-4 rounded-lg border border-white/15 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/25 text-white/80 hover:text-white transition-colors font-semibold text-lg"
          >
            View Sample Audit
          </button>
        </motion.div>
      </motion.div>
    </section>
  )
}

export default function HomePage() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [navOpacity, setNavOpacity] = useState(0.4)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sampleReportOpen, setSampleReportOpen] = useState(false)
  const [verifyModal, setVerifyModal] = useState<{ name: string; hash: string; contents: string } | null>(null)

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
                onClick={() => router.push('/signup')}
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
                  router.push('/signup')
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
        <HeroSection
          onSignup={() => router.push('/signup')}
          onSampleReport={() => setSampleReportOpen(true)}
        />

        {/* Process — Capture → Review → Anchor → Defend */}
        <section id="how-it-works" className="max-w-4xl mx-auto px-6 py-20 border-t border-white/5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
            <div>
              <div className="text-3xl font-bold text-[#F97316]/60 mb-2">01</div>
              <div className="text-[#F97316] font-semibold text-base mb-1">Capture</div>
              <p className="text-[#A1A1A1] text-sm leading-relaxed">Field evidence recorded as work happens.</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#F97316]/60 mb-2">02</div>
              <div className="text-[#F97316] font-semibold text-base mb-1">Review</div>
              <p className="text-[#A1A1A1] text-sm leading-relaxed">Risks flagged before they compound.</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#F97316] mb-2">03</div>
              <div className="text-[#F97316] font-bold text-base mb-1">Anchor</div>
              <p className="text-white/80 text-sm leading-relaxed">Records frozen into the ledger.</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-[#F97316]/60 mb-2">04</div>
              <div className="text-[#F97316] font-semibold text-base mb-1">Defend</div>
              <p className="text-[#A1A1A1] text-sm leading-relaxed">Proof packs exported for audits and claims.</p>
            </div>
          </div>
        </section>

        {/* Divider — hero promise → scroll evidence */}
        <div className="max-w-4xl mx-auto px-6 py-8 border-t border-white/5">
          <div className="h-px w-12 mx-auto mb-4 bg-white/20" aria-hidden />
          <motion.p
            className="text-center text-xs text-white/60 font-mono tracking-wider"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            Scroll for evidence ↓
          </motion.p>
        </div>

        {/* Proof — verified outputs */}
        <section id="proof" className="max-w-6xl mx-auto px-6 py-20 border-t border-white/5">
          <h2 className="text-2xl font-semibold text-white mb-3 text-center">What auditors actually receive</h2>
          <p className="text-sm text-white/50 mb-10 text-center max-w-xl mx-auto">
            Auditors receive these exact formats. Nothing here is simulated.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Featured: Audit Packet */}
            <div className="lg:col-span-2 p-6 bg-[#121212] border border-white/10 rounded-lg hover:border-[#F97316]/40 transition-colors text-left group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-white/60 tracking-wider uppercase">Audit Packet</span>
                <span className="flex items-center gap-1.5 text-[10px] text-[#F97316]/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" /> VERIFIED
                </span>
              </div>
              <a href="/Test-audit-packet.pdf" target="_blank" rel="noopener noreferrer" className="block mb-4">
                <div className="aspect-[3/4] max-h-56 rounded border border-white/10 overflow-hidden bg-white/[0.02] relative">
                  <Image src="/proof/audit-01.png" alt="Audit packet page 1" fill className="object-cover object-top" sizes="(max-width: 1024px) 100vw, 50vw" />
                </div>
              </a>
              <p className="text-[10px] text-white/40 mb-2">Includes: job log, photo evidence, signatures, risk score, chain-of-custody</p>
              <div className="text-[11px] font-mono text-white/50 tracking-tight mb-1">Ledger anchor: sha256:a3f2b8c1...9d4e</div>
              <div className="text-[10px] text-white/40 mb-3">2026-02-07T12:00:00Z</div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <a href="/Test-audit-packet.pdf" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#F97316] group-hover:underline">View PDF →</a>
                <button
                  type="button"
                  onClick={() => setVerifyModal({ name: 'Audit Packet', hash: 'sha256:a3f2b8c1...9d4e', contents: 'job log, photo evidence, signatures, risk score, chain-of-custody' })}
                  className="px-2.5 py-1 rounded-md border border-white/20 text-[10px] font-mono text-white/60 hover:text-white/90 hover:border-white/30 transition-colors"
                >
                  Verify
                </button>
              </div>
            </div>
            {[
              { name: 'Compliance Packet', pdf: '/Test-compliance-packet.pdf', img: '/proof/compliance-01.png', hash: 'sha256:7c2e...f1a9', contents: 'Checklists, sign-offs, documentation, proof of work' },
              { name: 'Incident Packet', pdf: '/Test-incident-packet.pdf', img: '/proof/incident-01.png', hash: 'sha256:9b1d...c3e8', contents: 'Flag escalation trail, accountability markers, decisions' },
              { name: 'Insurance Packet', pdf: '/Test-insurance-packet.pdf', img: '/proof/insurance-01.png', hash: 'sha256:e4a2...6b7f', contents: 'Job completion, risk score, flags, attachments, audit trail' },
            ].map((pack) => (
              <div key={pack.name} className="p-6 bg-[#121212] border border-white/10 rounded-lg hover:border-white/20 transition-colors text-left group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono text-white/60 tracking-wider uppercase">{pack.name.replace(' Packet', '')}</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-[#F97316]/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" /> VERIFIED
                  </span>
                </div>
                <a href={pack.pdf} target="_blank" rel="noopener noreferrer" className="block mb-4">
                  <div className="aspect-[3/4] max-h-40 rounded border border-white/10 overflow-hidden bg-white/[0.02] relative">
                    <Image src={pack.img} alt={`${pack.name} page 1`} fill className="object-cover object-top" sizes="(max-width: 1024px) 100vw, 25vw" />
                  </div>
                </a>
                <p className="text-[10px] text-white/40 mb-2">{pack.contents}</p>
                <div className="text-[11px] font-mono text-white/50 tracking-tight mb-1">Ledger: {pack.hash}</div>
                <div className="text-[10px] text-white/40 mb-3">2026-02-07T12:00:00Z</div>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <a href={pack.pdf} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#F97316] group-hover:underline">View PDF →</a>
                  <button
                    type="button"
                    onClick={() => setVerifyModal({ name: pack.name, hash: pack.hash, contents: pack.contents })}
                    className="px-2.5 py-1 rounded-md border border-white/20 text-[10px] font-mono text-white/60 hover:text-white/90 hover:border-white/30 transition-colors"
                  >
                    Verify
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Verify modal — hash, timestamp, anchor, how to verify */}
        {verifyModal && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setVerifyModal(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="verify-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-[#121212] border border-white/15 rounded-xl p-6 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="verify-modal-title" className="text-lg font-semibold text-white mb-4 font-mono">
                Verify pack: {verifyModal.name}
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-white/40 text-xs font-mono uppercase tracking-wider">Ledger anchor</span>
                  <p className="font-mono text-white/80 break-all">{verifyModal.hash}</p>
                </div>
                <div>
                  <span className="text-white/40 text-xs font-mono uppercase tracking-wider">Timestamp</span>
                  <p className="font-mono text-white/80">2026-02-07T12:00:00Z</p>
                </div>
                <div>
                  <span className="text-white/40 text-xs font-mono uppercase tracking-wider">Contents</span>
                  <p className="text-white/70">{verifyModal.contents}</p>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <span className="text-white/40 text-xs font-mono uppercase tracking-wider">How to verify</span>
                  <p className="text-white/60 text-sm mt-1">
                    Each exported pack is anchored to the ledger. The hash above uniquely identifies this artifact. In production, auditors can recompute the hash and confirm the record has not been altered.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVerifyModal(null)}
                className="mt-6 w-full px-4 py-2 rounded-lg border border-white/20 text-white/80 hover:bg-white/5 transition-colors text-sm"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}

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

        {/* Founder Story — context, not justification */}
        <section className="max-w-4xl mx-auto px-6 pt-16 pb-20">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl font-semibold mb-6 font-display text-white/80">Why Riskmate Exists</h2>
            <div className="bg-[#121212] rounded-xl border border-white/10 p-8 text-left">
              <p className="text-lg text-white font-semibold mb-4">
                &ldquo;Safety paperwork was a mess.&rdquo;
              </p>
              <p className="text-white/70 leading-relaxed mb-4">
                Electricians losing photos in iMessage. Roofers with paper forms that got lost. HVAC crews using Google Drive folders no one could find.
              </p>
              <p className="text-white/70 leading-relaxed mb-4">
                Riskmate produces proof packs: immutable records you hand to insurers and auditors. One click.
              </p>
              <p className="text-sm text-white/40 font-mono">
                This is why it exists.
              </p>
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
