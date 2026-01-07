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
 */
export async function buildExecutiveBriefPDF(
  input: ExecutiveBriefInput
): Promise<ExecutiveBriefOutput> {
  // Temporary bridge: Import the existing implementation from route file
  // As we extract code incrementally, this will be replaced with local implementation
  const { buildExecutiveBriefPDF: buildInternal } = await import('../../../app/api/executive/brief/pdf/route')
  
  // Call with the old signature (will be updated as we refactor)
  return buildInternal(
    input.data,
    input.organizationName,
    input.generatedBy,
    input.timeRange,
    input.buildSha,
    input.reportId
  )
}

