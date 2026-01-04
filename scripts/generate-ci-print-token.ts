#!/usr/bin/env ts-node
/**
 * Generate a long-lived print token for CI testing
 * 
 * Usage:
 *   PRINT_TOKEN_SECRET=... node scripts/generate-ci-print-token.ts
 * 
 * Or set environment variables:
 *   PRINT_TOKEN_SECRET: Secret key for signing tokens (defaults to SUPABASE_SERVICE_ROLE_KEY)
 *   CI_JOB_ID: Job ID for the token payload (optional, defaults to 'ci-test-job')
 *   CI_ORG_ID: Organization ID for the token payload (optional, defaults to 'ci-test-org')
 *   CI_RUN_ID: Report run ID for the token payload (optional, defaults to 'ci-test-run')
 *   TOKEN_EXPIRY_DAYS: Token expiration in days (defaults to 7)
 */

import { signPrintToken } from '../lib/utils/printToken'

const PRINT_TOKEN_SECRET = process.env.PRINT_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
const CI_JOB_ID = process.env.CI_JOB_ID || 'ci-test-job'
const CI_ORG_ID = process.env.CI_ORG_ID || 'ci-test-org'
const CI_RUN_ID = process.env.CI_RUN_ID || 'ci-test-run'
const TOKEN_EXPIRY_DAYS = parseInt(process.env.TOKEN_EXPIRY_DAYS || '7', 10)

if (!PRINT_TOKEN_SECRET) {
  console.error('❌ Error: PRINT_TOKEN_SECRET or SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

// Generate token valid for specified days
const expiresInSeconds = TOKEN_EXPIRY_DAYS * 24 * 60 * 60
const token = signPrintToken(
  {
    jobId: CI_JOB_ID,
    organizationId: CI_ORG_ID,
    reportRunId: CI_RUN_ID,
  },
  expiresInSeconds
)

// Output token (will be masked by GitHub Actions)
// Output only the token to stdout (for CI consumption)
// All other output goes to stderr so it doesn't interfere with token capture
console.error('✅ Generated CI print token')
console.error(`📅 Valid for ${TOKEN_EXPIRY_DAYS} days`)
console.error(`🔑 Payload: jobId=${CI_JOB_ID}, orgId=${CI_ORG_ID}, runId=${CI_RUN_ID}`)
console.error('💡 Token will be masked in CI logs')
// Output token to stdout (only thing on stdout)
console.log(token)

