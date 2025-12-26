/**
 * Shared utilities for report generation (both PDFKit and HTML)
 * 
 * These functions are used by both the PDFKit generator and the HTML print route.
 */

// Re-export from pdf/utils for use in HTML print route
export { formatDate, formatTime, getRiskColor, getSeverityColor } from './pdf/utils'

