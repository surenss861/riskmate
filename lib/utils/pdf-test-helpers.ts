/**
 * PDF Test Helpers
 * 
 * Utilities for testing PDF output
 */

/**
 * Extract text from PDF buffer
 * 
 * Uses pdf-parse or similar library to extract text content
 * Falls back to basic extraction if library not available
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // Try to use pdf-parse if available (dynamic import to avoid build-time dependency)
    // @ts-ignore - pdf-parse may not be installed, that's OK
    const pdfParse = await import('pdf-parse').catch(() => null)
    if (pdfParse?.default) {
      const data = await pdfParse.default(buffer)
      return data.text || ''
    }
  } catch (error) {
    // Fall back to basic extraction
    console.warn('[PDF Test] pdf-parse not available, using basic extraction')
  }
  
  // Basic fallback: extract text from PDF buffer (limited but works for simple cases)
  // This is a minimal implementation - for full text extraction, install pdf-parse
  const bufferString = buffer.toString('binary')
  
  // Extract text between stream objects (basic PDF text extraction)
  // This is a simplified approach - for production tests, use pdf-parse
  const textMatches: string[] = []
  const streamRegex = /stream[\s\S]*?endstream/g
  const matches = bufferString.match(streamRegex) || []
  
  for (const match of matches) {
    // Extract readable text (basic heuristic)
    const text = match
      .replace(/stream|endstream/g, '')
      .replace(/[^\x20-\x7E\n\r]/g, ' ') // Keep printable ASCII + newlines
      .replace(/\s+/g, ' ')
      .trim()
    
    if (text.length > 10) {
      textMatches.push(text)
    }
  }
  
  return textMatches.join(' ')
}

/**
 * Check if PDF has exactly N pages
 */
export async function getPDFPageCount(buffer: Buffer): Promise<number> {
  try {
    // @ts-ignore - pdf-parse may not be installed, that's OK
    const pdfParse = await import('pdf-parse').catch(() => null)
    if (pdfParse?.default) {
      const data = await pdfParse.default(buffer)
      return data.numpages || 0
    }
  } catch (error) {
    // Fallback: count /Type /Page occurrences (basic heuristic)
    const bufferString = buffer.toString('binary')
    const pageMatches = bufferString.match(/\/Type\s*\/Page[^s]/g) || []
    return pageMatches.length
  }
  
  return 0
}

