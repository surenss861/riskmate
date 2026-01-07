/**
 * Executive Brief PDF Builder - Main Entrypoint
 * 
 * Pure function: input → PDF bytes
 * No Supabase, no auth, no env reads.
 * 
 * This is the shared module used by:
 * - Route handler: app/api/executive/brief/pdf/route.ts
 * - Smoke tests: scripts/pdf-smoke-test.ts
 * - CI/CD: Docker-based visual regression
 * 
 * REFACTORING STATUS:
 * - Step 0: ✅ Fixed reportId redeclare bug
 * - Step 1: ✅ Created entrypoint (this file)
 * - Step 2: ⏳ Moving pure helpers next
 * - Step 3: ⏳ Moving render functions incrementally
 * - Step 4: ⏳ Route will use this module
 */

import type { ExecutiveBriefInput, ExecutiveBriefOutput } from './types'

/**
 * Build comprehensive executive brief PDF
 * 
 * @param input - All data needed to generate the PDF
 * @returns PDF buffer, hash, latency metrics, and time window
 * 
 * NOTE: This is a temporary bridge implementation.
 * The actual function lives in the route file and will be moved here incrementally.
 */
export async function buildExecutiveBriefPDF(
  input: ExecutiveBriefInput
): Promise<ExecutiveBriefOutput> {
  // TODO: This is a temporary workaround - Next.js doesn't allow exporting non-route functions from route files
  // We'll move the implementation here incrementally in the next steps
  // For now, this function will be implemented directly in the route handler
  // and we'll extract it piece by piece
  
  throw new Error(
    'buildExecutiveBriefPDF from lib/pdf/executiveBrief/build.ts is not yet implemented. ' +
    'The implementation is still in app/api/executive/brief/pdf/route.ts and will be moved incrementally.'
  )
}

