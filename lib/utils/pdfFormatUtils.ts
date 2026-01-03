/**
 * PDF Formatting Utilities
 * Canonical formatters for PDF generation (always UTC, consistent format)
 */

/**
 * Format timestamp for PDF display (always UTC, consistent format)
 * Format: "Jan 3, 2025, 4:57 AM UTC"
 */
export function formatPdfTimestamp(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  
  return date.toLocaleString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' UTC'
}

/**
 * Format date only (no time) for PDF display
 * Format: "Jan 3, 2025"
 */
export function formatPdfDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format date and time separately (for headers/footers)
 * Returns: { date: "Jan 3, 2025", time: "4:57 AM" }
 */
export function formatPdfDateTimeParts(dateString: string | Date): { date: string; time: string } {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  if (Number.isNaN(date.getTime())) {
    return { date: 'Invalid date', time: '' }
  }
  
  const dateStr = date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  
  const timeStr = date.toLocaleTimeString('en-US', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  
  return { date: dateStr, time: timeStr }
}

