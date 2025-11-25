'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import ScrollToTop from '@/components/ScrollToTop'
import RiskMateLogo from '@/components/RiskMateLogo'

export default function HomePage() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [navOpacity, setNavOpacity] = useState(0.4)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
          <div className="max-w-4xl mx-auto flex items-center justify-between py-5 px-6">
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <RiskMateLogo size="sm" showText={true} />
            </motion.div>
            <div className="hidden md:flex items-center gap-4">
              <button
                onClick={() => router.push('/demo')}
                className="text-white/70 hover:text-white transition-colors text-sm relative group"
              >
                See It in Action
                <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-white group-hover:w-full transition-all duration-300" />
              </button>
              <button
                onClick={() => router.push('/signup')}
                className="px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-white rounded-md font-medium text-sm transition-colors btn-primary"
              >
                Start Free →
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
            <div className="px-6 py-4 space-y-4">
              <button
                onClick={() => {
                  router.push('/demo')
                  setMobileMenuOpen(false)
                }}
                className="block w-full text-left text-white/70 hover:text-white transition-colors py-2"
              >
                See It in Action
              </button>
              <button
                onClick={() => {
                  router.push('/signup')
                  setMobileMenuOpen(false)
                }}
                className="w-full px-4 py-2 bg-[#F97316] hover:bg-[#FB923C] text-white rounded-md font-medium text-sm transition-colors btn-primary"
              >
                Start Free →
              </button>
            </div>
            </motion.div>
          )}
        </nav>

        {/* Spacer for fixed nav */}
        <div className="h-20" />

        {/* Hero - Minimal & Clean */}
        <section 
          className="relative max-w-4xl mx-auto px-6 py-32 text-center overflow-hidden"
          data-string=""
          data-string-parallax="-0.02"
        >
          {/* Background gradient pulse */}
          <div className="absolute inset-0 opacity-30">
            <motion.div
              className="absolute inset-0 bg-gradient-to-b from-[#F97316]/5 via-transparent to-transparent"
              animate={{
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </div>

          <div className="relative z-10">
            <motion.h1 
              className="text-5xl md:text-7xl font-bold mb-6 leading-tight font-display"
              style={{ 
                letterSpacing: '-0.02em',
                maxWidth: '60ch',
                margin: '0 auto'
              }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              <motion.span
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                Turn every job into an
              </motion.span>
              <br />
              <motion.span 
                className="text-[#F97316] relative inline-block"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                audit-ready safety report
                <motion.span
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#F97316]"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.6, delay: 1.1 }}
                />
              </motion.span>
            </motion.h1>
            <motion.p 
              className="text-xl text-[#A1A1A1] mb-8 max-w-2xl mx-auto"
              data-string=""
              data-string-parallax="0.01"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Replace messy paper forms and random photos with one clean dashboard. Document hazards, controls, photos, and signatures—everything timestamped and ready for clients, insurers, and auditors.
            </motion.p>
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <motion.button
                onClick={() => router.push('/signup')}
                className="px-8 py-4 bg-[#F97316] text-black rounded-lg hover:bg-[#FB923C] transition-all font-semibold text-lg btn-primary relative overflow-hidden group"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="relative z-10">Protect Your Next Job →</span>
                <motion.span
                  className="absolute inset-0 bg-white/20"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: '100%' }}
                  transition={{ duration: 0.6 }}
                />
              </motion.button>
              <motion.button
                onClick={() => router.push('/demo')}
                className="px-8 py-4 border border-white/10 rounded-lg hover:border-white/20 transition-colors font-semibold text-lg btn-secondary"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                See It in Action
              </motion.button>
            </motion.div>

            {/* Trust Badges */}
            <motion.div 
              className="flex flex-wrap justify-center gap-4 text-sm mb-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <div className="px-4 py-2 bg-[#121212] rounded-lg border border-white/5">
                Audit-ready documentation
              </div>
              <div className="px-4 py-2 bg-[#121212] rounded-lg border border-white/5">
                Timestamped evidence trail
              </div>
              <div className="px-4 py-2 bg-[#121212] rounded-lg border border-white/5">
                Insurer-approved reports
              </div>
            </motion.div>
          </div>

          {/* Proof Chips - Minimal */}
          <div className="flex flex-wrap justify-center gap-4 text-sm relative z-10" data-string="" data-string-show="">
            <div className="px-4 py-2 bg-[#121212] rounded-lg border border-white/5">
              Used by electricians, plumbers, HVAC crews
            </div>
            <div className="px-4 py-2 bg-[#121212] rounded-lg border border-white/5">
              Everything timestamped automatically
            </div>
            <div className="px-4 py-2 bg-[#121212] rounded-lg border border-white/5">
              Share with clients, insurers, auditors
            </div>
          </div>
        </section>

        {/* How It Works - Minimal Steps */}
        <section 
          className="max-w-6xl mx-auto px-6 py-20"
          data-string=""
          data-string-show=""
        >
          <motion.h2 
            className="text-4xl font-bold text-center mb-12 font-display"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            How it works
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto relative">
            {/* Connecting arrows - hidden on mobile */}
            <div className="hidden md:block absolute top-6 left-1/3 right-1/3 h-0.5 bg-gradient-to-r from-[#F97316]/30 via-[#F97316]/50 to-[#F97316]/30" />
            <div className="hidden md:block absolute top-6 left-2/3 right-0 h-0.5 bg-gradient-to-r from-[#F97316]/30 via-[#F97316]/50 to-transparent" />
            
            {/* Mobile: Vertical flow indicator */}
            <div className="md:hidden absolute left-6 top-14 bottom-0 w-0.5 bg-gradient-to-b from-[#F97316]/30 via-[#F97316]/50 to-transparent" />
            
            <motion.div 
              className="text-center"
              data-string=""
              data-string-show=""
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div className="w-14 h-14 rounded-lg number-badge flex items-center justify-center text-2xl font-bold text-[#F97316] mx-auto mb-4 relative z-10">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Before the job</h3>
              <p className="text-[#A1A1A1]">Complete hazard checklists, risk assessments, and required controls. Upload photos and capture team signatures—all timestamped automatically.</p>
            </motion.div>
            <motion.div 
              className="text-center"
              data-string=""
              data-string-show=""
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="w-14 h-14 rounded-lg number-badge flex items-center justify-center text-2xl font-bold text-[#F97316] mx-auto mb-4 relative z-10">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">During the job</h3>
              <p className="text-[#A1A1A1]">Track site changes, new hazards, and additional photos. See who's on-site and who submitted what—your living job log.</p>
            </motion.div>
            <motion.div 
              className="text-center"
              data-string=""
              data-string-show=""
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="w-14 h-14 rounded-lg number-badge flex items-center justify-center text-2xl font-bold text-[#F97316] mx-auto mb-4 relative z-10">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">After the job</h3>
              <p className="text-[#A1A1A1]">Generate audit-ready PDF reports with job summary, evidence photos, and compliance trail. Share with clients, insurers, or auditors.</p>
            </motion.div>
          </div>
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
              <h3 className="text-2xl font-semibold mb-2">Starter</h3>
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
                <span className="text-[#A1A1A1]">Shareable job reports (view-only links)</span>
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
              <h3 className="text-2xl font-semibold mb-2">Pro</h3>
              <div className="mb-2">
                <span className="text-4xl font-bold">$59</span>
                <span className="text-[#A1A1A1]">/mo</span>
              </div>
              <p className="text-xs text-[#A1A1A1] mb-6">per business</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <span className="text-[#F97316] mr-2">✓</span>
                  <span className="text-[#A1A1A1]">Unlimited jobs</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-[#A1A1A1]">Up to 5 team seats</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-[#A1A1A1]">Branded PDFs + notifications</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F97316] mr-2">✓</span>
                <span className="text-[#A1A1A1]">Live reports + client share links</span>
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
                Get Started →
              </button>
            </motion.div>

            {/* Business */}
            <motion.div 
            className="card p-8 bg-[#121212] rounded-xl border border-white/5 md:order-3 relative"
            style={{ boxShadow: '0 0 55px rgba(250, 204, 85, 0.25)' }}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              whileHover={{ y: -3, backgroundColor: '#1a1a1a' }}
            >
            <div className="text-xs font-semibold text-[#FACC15] mb-2">Audit-Ready</div>
              <h3 className="text-2xl font-semibold mb-2">Business</h3>
              <div className="mb-2">
                <span className="text-4xl font-bold">$129</span>
                <span className="text-[#A1A1A1]">/mo</span>
              </div>
              <p className="text-xs text-[#A1A1A1] mb-6">per business</p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                <span className="text-[#FACC15] mr-2">✓</span>
                  <span className="text-[#A1A1A1]">Unlimited seats</span>
                </li>
                <li className="flex items-start">
                <span className="text-[#FACC15] mr-2">✓</span>
                <span className="text-[#A1A1A1]">Permit Pack Generator (ZIP bundle)</span>
              </li>
              <li className="flex items-start">
                <span className="text-[#FACC15] mr-2">✓</span>
                <span className="text-[#A1A1A1]">Org-level dashboard analytics</span>
                </li>
                <li className="flex items-start">
                <span className="text-[#FACC15] mr-2">✓</span>
                <span className="text-[#A1A1A1]">Versioned audit logs (compliance history)</span>
                </li>
                <li className="flex items-start">
                <span className="text-[#FACC15] mr-2">✓</span>
                <span className="text-[#A1A1A1]">Dedicated onboarding & phone support</span>
                </li>
              </ul>
              <button
                onClick={() => router.push('/signup?plan=business')}
              className="w-full px-6 py-3 border border-[#FACC15]/40 text-[#FACC15] rounded-lg hover:bg-[#FACC15]/10 transition-colors font-semibold flex flex-col items-center gap-1"
              >
              <span>Upgrade to Business →</span>
              <span className="text-xs text-[#FACC15]/80 font-normal">Get advanced compliance & support</span>
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

        {/* Footer - Minimal */}
        <footer className="border-t border-white/5 px-6 py-8">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#A1A1A1]">
            <div>Built in North America • © RiskMate 2025</div>
            <div className="flex gap-6 flex-wrap justify-center">
              <button
                onClick={() => router.push('/demo')}
                className="hover:text-white transition-colors"
              >
                See It in Action
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
      </motion.main>
  )
}
