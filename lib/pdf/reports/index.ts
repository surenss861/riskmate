/**
 * PDF Report Registry
 * 
 * Central registry for all PDF report builders
 * Routes can import from here: reports.executiveBrief.build(input)
 */

import type { ExecutiveBriefInput, ExecutiveBriefOutput } from './executiveBrief/types'
import { buildExecutiveBriefPDF } from './executiveBrief/build'

/**
 * Report Registry
 * 
 * Each report exports a build(input) -> Buffer pattern
 * All reports follow the structural 2-page lock (only build.ts can add pages)
 */
export const reports = {
  executiveBrief: {
    build: async (input: ExecutiveBriefInput, deps: any): Promise<ExecutiveBriefOutput> => {
      return buildExecutiveBriefPDF(input, deps)
    },
  },
  // Future reports go here:
  // complianceReport: { build: ... },
  // riskAssessment: { build: ... },
}

/**
 * Type-safe report input/output types
 */
export type ReportInput = ExecutiveBriefInput // | ComplianceReportInput | ...
export type ReportOutput = ExecutiveBriefOutput // | ComplianceReportOutput | ...

