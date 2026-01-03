/**
 * QR Code Generation Utility
 * Generates QR codes for PDF verification
 */

import QRCode from 'qrcode'

/**
 * Generate QR code as data URL (base64 PNG)
 */
export async function generateQRCodeDataURL(text: string): Promise<string> {
  try {
    const dataURL = await QRCode.toDataURL(text, {
      width: 300,
      margin: 2,
      color: {
        dark: '#0A0A0A', // PDF theme ink color
        light: '#FFFFFF', // PDF theme paper color
      },
    })
    return dataURL
  } catch (error) {
    console.error('Failed to generate QR code:', error)
    // Return empty data URL on error
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  }
}

