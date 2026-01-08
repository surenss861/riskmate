/**
 * Core PDF Layout Helpers
 * 
 * Reusable layout primitives for consistent spacing and page management
 */

import PDFKit from 'pdfkit'

/**
 * Get content limit Y (safe area above footer)
 */
export function getContentLimitY(doc: PDFKit.PDFDocument): number {
  return doc.page.height - 80 // Footer space
}

/**
 * Ensure space for content - move to next page if needed
 */
export function ensureSpace(
  doc: PDFKit.PDFDocument,
  requiredHeight: number,
  margin: number
): void {
  const contentLimitY = getContentLimitY(doc)
  const currentY = doc.y || margin
  
  if (currentY + requiredHeight > contentLimitY) {
    doc.addPage()
    doc.y = margin
  }
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

