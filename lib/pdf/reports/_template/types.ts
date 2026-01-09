/**
 * Report Input/Output Types
 * 
 * Define your report's input data structure and output format
 */

export interface ReportInput {
  // Define your input fields here
  // Example:
  // data: YourData
  // organizationName: string
  // timeRange: string
  // reportId: string
}

export interface ReportOutput {
  buffer: Buffer
  hash: string
  apiLatency: number
  timeWindow: { start: Date; end: Date }
}

