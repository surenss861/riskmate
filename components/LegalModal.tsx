'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

type LegalModalProps = {
  open: boolean;
  version: string;
  updatedAt?: string;
  onAccept: () => Promise<void>;
};

export function LegalModal({ open, version, updatedAt, onAccept }: LegalModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    try {
      setError(null);
      setLoading(true);
      await onAccept();
      // Success - modal will close automatically when legalAccepted becomes true
    } catch (err: any) {
      // Enhanced error handling with user-friendly messages
      let errorMessage = 'Failed to record acceptance. Please try again.';
      
      if (err?.code === 'AUTH_UNAUTHORIZED' || err?.message?.includes('Unauthorized')) {
        errorMessage = 'Your session has expired. Please refresh the page and try again.';
      } else if (err?.message) {
        // Use the API error message if available
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      console.error('Legal acceptance error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0B0C14] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">Accept Legal Terms</h2>
                <p className="text-sm text-[#9FA6BE]">
                  Version <span className="font-medium text-white">{version}</span>
                  {updatedAt && (
                    <>
                      {' '}
                      • Updated {new Date(updatedAt).toLocaleDateString()}
                    </>
                  )}
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-[#F97316]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F97316]">
                Required
              </span>
            </div>

            <div className="space-y-4 text-sm text-[#C5CADB]">
              <p>
                To comply with OSHA, insurance, and customer requirements, RiskMate records
                that each user has accepted our Terms of Service and Privacy Policy. Please
                review the agreement before continuing.
              </p>
              <p>
                Acceptance applies to this organization and is tracked per user. Any changes
                to the policy will prompt you to re-accept.
              </p>
              <p>
                <Link
                  href="/account/legal"
                  target="_blank"
                  className="font-medium text-[#F97316] underline-offset-4 hover:underline"
                >
                  View full Terms &amp; Privacy
                </Link>
              </p>
              {error && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div>
                      <p className="font-medium mb-1">Unable to record acceptance</p>
                      <p className="text-red-300/80">{error}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[#F97316] px-6 py-3 text-sm font-semibold uppercase tracking-wide text-black transition hover:bg-[#FB923C] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:ring-offset-2 focus:ring-offset-[#0B0C14]"
              onClick={handleAccept}
              disabled={loading}
            >
              {loading ? 'Recording acceptance…' : 'I Agree'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default LegalModal;

