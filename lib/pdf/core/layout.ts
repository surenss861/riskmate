/**
 * Core PDF Layout Helpers
 * 
 * Reusable layout primitives for consistent spacing and page management
 * 
 * CRITICAL: These functions NEVER call doc.addPage() - only build.ts can add pages
 * This enforces the structural 2-page lock pattern for board-grade reports
 */

import PDFKit from 'pdfkit'

/**
 * Get content limit Y (safe area above footer)
 * Footer consists of: main footer + build stamp + confidentiality (3 lines)
 */
export function getContentLimitY(doc: PDFKit.PDFDocument): number {
  const bottomMargin = 60 // matches PDFDocument bottom margin
  doc.fontSize(8).font('Helvetica')
  const lineHeight = doc.currentLineHeight(true) || 10
  const footerLines = 3
  const footerSpacing = 8
  const footerTotalHeight = (lineHeight * footerLines) + (footerSpacing * (footerLines - 1))
  return doc.page.height - bottomMargin - footerTotalHeight - 8 // 8px safety margin
}

/**
 * Ensure space for content (NEVER adds pages)
 * 
 * CRITICAL: This function NEVER calls doc.addPage() - only build.ts can add pages
 * 
 * Structural Rule:
 * - Only build.ts may call doc.addPage() (max once, between Page 1 and Page 2)
 * - ensureSpace() only checks space and returns boolean
 * - Renderers must skip/truncate when ensureSpace() returns false
 * 
 * @param pageNumber - Current page number (1 or 2)
 * @returns true if space is available, false if content doesn't fit (hard stop on page 2)
 */
export function ensureSpace(
  doc: PDFKit.PDFDocument,
  requiredHeight: number,
  margin: number,
  pageNumber: number
): boolean {
  const contentLimitY = getContentLimitY(doc)
  
  // HARD LOCK: Never create page 3 - Executive Brief is exactly 2 pages
  if (pageNumber >= 2) {
    // On page 2, check if content fits
    return doc.y + requiredHeight <= contentLimitY
  }
  
  // On page 1, check if content fits
  // NOTE: We don't add pages here - build.ts handles the single page break
  return doc.y + requiredHeight <= contentLimitY
}

/**
 * Check if there's enough space for content
 */
export function hasSpace(
  doc: PDFKit.PDFDocument,
  requiredHeight: number
): boolean {
  const contentLimitY = getContentLimitY(doc)
  const currentY = doc.y || 0
  return currentY + requiredHeight <= contentLimitY
}

/**
 * Two-column layout helper
 * Returns left and right column boundaries
 */
export function createTwoColumnLayout(
  pageWidth: number,
  margin: number,
  leftColumnWidth: number = 0.65,
  gutter: number = 24
): {
  leftX: number
  leftWidth: number
  rightX: number
  rightWidth: number
} {
  const contentWidth = pageWidth - margin * 2
  const leftWidth = Math.floor(contentWidth * leftColumnWidth) - gutter / 2
  const rightWidth = contentWidth - leftWidth - gutter
  const leftX = margin
  const rightX = margin + leftWidth + gutter
  
  return {
    leftX,
    leftWidth,
    rightX,
    rightWidth,
  }
}

/**
 * Chip flow layout helper
 * Handles chip wrapping with separator rules
 */
export function calculateChipLayout(
  doc: PDFKit.PDFDocument,
  chips: Array<{ label: string; delta: string }>,
  startX: number,
  startY: number,
  rightLimit: number,
  options: {
    chipHeight?: number
    chipGap?: number
    maxChipsPerLine?: number
    maxLines?: number
    separator?: string
  } = {}
): Array<{
  x: number
  y: number
  text: string
  width: number
}> {
  const chipHeight = options.chipHeight || 24
  const chipGap = options.chipGap || 12
  const maxChipsPerLine = options.maxChipsPerLine || 3
  const maxLines = options.maxLines || 2
  const separator = options.separator || ' •'
  const separatorMargin = 4 // Small margin to ensure separator isn't at exact edge
  
  doc.fontSize(9).font('Helvetica')
  
  const layout: Array<{ x: number; y: number; text: string; width: number }> = []
  let chipX = startX
  let chipY = startY
  let chipsOnCurrentLine = 0
  
  for (let i = 0; i < chips.length; i++) {
    const chip = chips[i]
    const chipTextWithoutSeparator = `${chip.label} ${chip.delta}`
    const chipTextWithSeparator = i < chips.length - 1 ? `${chipTextWithoutSeparator}${separator}` : chipTextWithoutSeparator
    
    const chipWidthWithoutSeparator = doc.widthOfString(chipTextWithoutSeparator) + 16
    const chipWidthWithSeparator = doc.widthOfString(chipTextWithSeparator) + 16
    
    // Check if chip + separator fits on current line
    const separatorFits = (chipX + chipWidthWithSeparator + separatorMargin <= rightLimit) && chipsOnCurrentLine < maxChipsPerLine
    const needsWrap = !separatorFits || chipsOnCurrentLine >= maxChipsPerLine
    
    if (needsWrap) {
      const currentLine = Math.floor(i / maxChipsPerLine)
      if (currentLine < maxLines) {
        chipY += chipHeight + 8
        chipX = startX
        chipsOnCurrentLine = 0
      } else {
        // Max lines reached - add collapse indicator
        break
      }
    }
    
    const finalChipText = separatorFits ? chipTextWithSeparator : chipTextWithoutSeparator
    const finalChipWidth = doc.widthOfString(finalChipText) + 16
    
    layout.push({
      x: chipX,
      y: chipY,
      text: finalChipText,
      width: finalChipWidth,
    })
    
    chipX += finalChipWidth + chipGap
    chipsOnCurrentLine++
  }
  
  return layout
}

/**
 * Measure wrapped text height
 */
export function measureWrappedText(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  fontSize: number,
  font: string,
  lineGap: number = 0
): number {
  doc.fontSize(fontSize).font(font)
  const lines = text.split('\n')
  const lineHeight = fontSize * 1.25
  return lines.length * lineHeight + (lines.length - 1) * lineGap
}

