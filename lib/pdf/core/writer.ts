/**
 * Core PDF Writer Primitives
 * 
 * Reusable text rendering helpers for all PDF reports
 * Handles sanitization, wrapping, and atomic writes
 */

import PDFKit from 'pdfkit'
import { sanitizeText, sanitizeAscii, truncateText } from './utils'

/**
 * Safe text renderer - always sanitizes before rendering
 * Prevents encoding issues and ensures clean PDF output
 */
export function safeText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  options: {
    width?: number
    align?: 'left' | 'center' | 'right' | 'justify'
    fontSize?: number
    font?: string
    color?: string
    lineGap?: number
  } = {}
): void {
  // CRITICAL: Always sanitize text before rendering (prevents encoding issues)
  const sanitized = sanitizeText(text)
  
  doc
    .fontSize(options.fontSize || 10)
    .font(options.font || 'Helvetica')
    .fillColor(options.color || '#1A1A1A')
  
  if (options.width) {
    doc.text(sanitized, x, y, {
      width: options.width,
      align: options.align || 'left',
      lineGap: options.lineGap,
    })
  } else {
    doc.text(sanitized, x, y, {
      align: options.align || 'left',
      lineGap: options.lineGap,
    })
  }
}

/**
 * Atomic line writer - ensures proper line separation
 * Returns next Y position for consistent spacing
 * 
 * @param noWrap - If true, prevents wrapping and shrinks font if needed (min 6pt)
 */
export function writeLine(
  doc: PDFKit.PDFDocument,
  text: string,
  fontSize: number,
  font: string,
  lineGap: number = 11,
  options?: { noWrap?: boolean; minFont?: number; x?: number; width?: number; color?: string }
): number {
  const minFont = options?.minFont || 6
  const currentY = doc.y || 0
  const x = options?.x ?? 0
  const width = options?.width ?? (doc.page.width - 96)
  const color = options?.color || '#666666'
  
  doc.fontSize(fontSize).font(font).fillColor(color)
  
  // CRITICAL: For atomic lines (like Generated/Window), prevent wrapping by shrinking font if needed
  if (options?.noWrap) {
    let atomicText = sanitizeText(text)
    let atomicFontSize = fontSize
    doc.fontSize(atomicFontSize).font(font)
    let textWidth = doc.widthOfString(atomicText)
    
    // If text doesn't fit, shrink font size until it fits (min 6pt)
    while (textWidth > width && atomicFontSize > minFont) {
      atomicFontSize -= 0.5
      doc.fontSize(atomicFontSize).font(font)
      textWidth = doc.widthOfString(atomicText)
    }
    
    // Render as single atomic line (no wrapping)
    doc.text(atomicText, x, currentY, {
      width: width,
      lineBreak: false, // CRITICAL: Prevent any wrapping
    })
  } else {
    // Normal line with wrapping allowed
    doc.text(sanitizeText(text), x, currentY, {
      width: width,
    })
  }
  
  const nextY = currentY + lineGap
  doc.y = nextY
  return nextY
}

/**
 * Atomic key-value renderer
 * Renders label + value as single unit (prevents orphaned labels)
 */
export function writeKV(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string | number,
  x: number,
  y: number,
  options: {
    labelWidth?: number
    valueWidth?: number
    fontSize?: number
    font?: string
    color?: string
  } = {}
): boolean {
  const fontSize = options.fontSize || 10
  const font = options.font || 'Helvetica'
  const color = options.color || '#1A1A1A'
  
  // Render label
  safeText(doc, label, x, y, {
    width: options.labelWidth || 120,
    fontSize,
    font,
    color,
  })
  
  // Render value (right-aligned)
  safeText(doc, String(value), x + (options.labelWidth || 120) + 8, y, {
    width: options.valueWidth || 100,
    align: 'right',
    fontSize,
    font,
    color: options.color || '#666666',
  })
  
  return true
}

/**
 * Write fitted single line - prevents mid-word wrapping by shrinking font
 * CRITICAL: Never allows single-word values to wrap mid-word
 * Use this for KPI values like "Moderate", "Low", "High" that must stay on one line
 */
export function writeFittedSingleLine(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  opts: {
    font?: string
    color?: string
    fontSize: number
    minFontSize?: number
    align?: 'left' | 'center' | 'right'
  }
): { usedFontSize: number } {
  const min = opts.minFontSize ?? 8
  const font = opts.font || 'Helvetica'
  const color = opts.color || '#1A1A1A'
  
  if (opts.font) doc.font(opts.font)
  if (opts.color) doc.fillColor(opts.color)

  let size = opts.fontSize
  doc.fontSize(size)

  // Shrink until it fits (or we hit the min)
  while (size > min && doc.widthOfString(text) > maxWidth) {
    size -= 1
    doc.fontSize(size)
  }

  // CRITICAL: lineBreak false prevents PDFKit from doing character wraps
  doc.text(text, x, y, {
    width: maxWidth,
    align: opts.align ?? 'left',
    lineBreak: false, // CRITICAL: Never allow mid-word wrapping
  })

  return { usedFontSize: size }
}

/**
 * Fitted label renderer - prevents mid-word breaks
 * Splits into multiple lines or shrinks font to fit
 */
export function renderFittedLabel(
  doc: PDFKit.PDFDocument,
  label: string,
  x: number,
  y: number,
  maxWidth: number,
  options: {
    fontSize: number
    minFontSize: number
    font: string
    color: string
  }
): number {
  let currentY = y
  let currentFontSize = options.fontSize
  let lines: string[] = [label]
  
  // Special handling for "Attestation coverage" to force two lines if needed
  if (label === 'Attestation coverage') {
    doc.fontSize(currentFontSize).font(options.font)
    const attestationWidth = doc.widthOfString('Attestation')
    const coverageWidth = doc.widthOfString('coverage')
    
    if (attestationWidth <= maxWidth && coverageWidth <= maxWidth) {
      // Both fit on separate lines
      lines = ['Attestation', 'coverage']
    } else {
      // Fallback to single line and shrink if necessary
      lines = [label]
    }
  }
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    let lineFits = false
    let tempFontSize = currentFontSize
    
    // Try to fit the line by shrinking font size
    while (!lineFits && tempFontSize >= options.minFontSize) {
      doc.fontSize(tempFontSize).font(options.font)
      const lineWidth = doc.widthOfString(line)
      if (lineWidth <= maxWidth) {
        lineFits = true
        currentFontSize = tempFontSize // Use the smallest font that fits
      } else {
        tempFontSize -= 0.5 // Shrink by 0.5pt
      }
    }
    
    // If still doesn't fit, truncate (should be rare with shrinking)
    if (!lineFits) {
      // Set font before truncating so width calculation is correct
      doc.fontSize(currentFontSize).font(options.font)
      line = truncateText(doc, line, maxWidth, currentFontSize)
    }
    
    doc
      .fontSize(currentFontSize)
      .font(options.font)
      .fillColor(options.color)
      .text(line, x, currentY, {
        width: maxWidth,
        align: 'left',
        lineBreak: false, // Prevent accidental breaks
      })
    currentY += currentFontSize * 1.2 // Advance Y for next line
  }
  return currentY - y // Return total height used
}

