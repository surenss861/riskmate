/**
 * Executive Brief PDF Builder
 * 
 * Pure function: input → PDF bytes
 * No side effects, no database, no auth
 */

import PDFDocument from 'pdfkit'
import crypto from 'crypto'
import QRCode from 'qrcode'
import type { ExecutiveBriefInput, ExecutiveBriefOutput } from './types'
import { PDF_CORE_TOKENS } from '@/lib/pdf/core/tokens'

// TODO: Import render functions once they're extracted
// import { renderPage1, renderPage2 } from './render'

/**
 * Build Executive Brief PDF
 * 
 * Pure function that takes input data and returns PDF buffer + metadata
 * 
 * NOTE: This is a bridge function that temporarily calls the old implementation
 * in the route file. It will be fully implemented incrementally.
 */
export async function buildExecutiveBriefPDF(
  input: ExecutiveBriefInput
): Promise<ExecutiveBriefOutput> {
  // TODO: Remove this import once full implementation is complete
  // For now, dynamically import the old implementation to avoid circular dependencies
  const { buildExecutiveBriefPDF: oldBuild } = await import('@/app/api/executive/brief/pdf/route')
  
  // Call old implementation with same signature
  return oldBuild(
    input.data,
    input.organizationName,
    input.generatedBy,
    input.timeRange,
    input.buildSha,
    input.reportId,
    input.baseUrl
  )
  
  // Generate QR code before PDF generation (async operation)
  const verifyUrl = baseUrl 
    ? `${baseUrl}/api/executive/brief/${reportId.substring(0, 8)}`
    : `/api/executive/brief/${reportId.substring(0, 8)}`
  
  let qrCodeBuffer: Buffer | null = null
  try {
    qrCodeBuffer = await QRCode.toBuffer(verifyUrl, {
      width: 80,
      margin: 1,
      color: {
        dark: PDF_CORE_TOKENS.colors.primaryText,
        light: PDF_CORE_TOKENS.colors.white,
      },
    })
  } catch (qrError) {
    console.warn('[PDF] Failed to generate QR code:', qrError)
    // Continue without QR code
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: PDF_CORE_TOKENS.spacing.margin,
        bottom: 60,
        left: PDF_CORE_TOKENS.spacing.margin,
        right: PDF_CORE_TOKENS.spacing.margin,
      },
      bufferPages: true,
      info: {
        Title: `RiskMate Executive Brief - ${organizationName}`,
        Author: 'RiskMate',
        Subject: 'Executive Risk Posture Summary',
        Keywords: `risk, governance, compliance, ${organizationName}`,
        Creator: 'RiskMate Platform',
        Producer: 'RiskMate PDF Generator',
      },
    })

    const chunks: Buffer[] = []
    const startTime = Date.now()
    const generatedAt = new Date()
    
    // CRITICAL: Compute deterministic hash from report metadata for Integrity capsule
    const metadataHashInput = `${reportId}-${generatedAt.toISOString()}-${organizationName}-${timeRange}`
    const metadataHash = crypto.createHash('sha256').update(metadataHashInput).digest('hex')
    
    // Calculate time window boundaries
    const end = new Date()
    const start = new Date()
    switch (timeRange) {
      case '7d':
        start.setDate(end.getDate() - 7)
        break
      case '30d':
        start.setDate(end.getDate() - 30)
        break
      case '90d':
        start.setDate(end.getDate() - 90)
        break
      default:
        start.setDate(end.getDate() - 30)
    }
    const timeWindow = { start, end }

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks)
      const apiLatency = Date.now() - startTime
      
      // Compute actual PDF hash (SHA-256) for Integrity capsule
      const pdfHash = crypto.createHash('sha256').update(buffer).digest('hex')
      
      resolve({
        buffer,
        hash: pdfHash,
        apiLatency,
        timeWindow,
      })
    })
    
    doc.on('error', (err: any) => {
      reject(err)
    })

    // TODO: Call render functions once they're extracted
    // For now, this is a placeholder that will be filled incrementally
    // renderPage1(doc, data, organizationName, generatedBy, timeRange, timeWindow, hasPriorPeriodData)
    // renderPage2(doc, data, organizationName, generatedBy, timeRange, timeWindow, metadataHash, pdfHash, reportId, baseUrl, qrCodeBuffer)
    
    // Temporary: Add a placeholder page so PDF is valid
    doc.text('Executive Brief PDF - Rendering in progress...', 48, 48)
    
    doc.end()
  })
}

