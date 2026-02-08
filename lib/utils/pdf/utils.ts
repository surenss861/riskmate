import { STYLES } from './styles';
import type { JobDocumentAsset } from './types';

export async function fetchLogoBuffer(logoUrl?: string | null): Promise<Buffer | null> {
  if (!logoUrl) return null;
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) throw new Error('Failed to download logo');
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.warn('Unable to include logo in PDF:', error);
    return null;
  }
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.valueOf())) return 'N/A';
    return date.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return 'N/A';
  }
}

export function formatTime(dateString?: string | null): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.valueOf())) return '';
    return date.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return '';
  }
}

export function formatShortDate(dateString?: string | null): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.valueOf())) return '';
    return date.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return '';
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function getRiskColor(level: string | null): string {
  if (!level) return STYLES.colors.riskLow;
  const lower = level.toLowerCase();
  if (lower === 'critical' || lower === 'high') return STYLES.colors.riskHigh;
  if (lower === 'medium') return STYLES.colors.riskMedium;
  return STYLES.colors.riskLow;
}

export function getSeverityColor(severity: string): string {
  const lower = severity.toLowerCase();
  if (lower === 'critical') return STYLES.colors.riskCritical;
  if (lower === 'high') return STYLES.colors.riskHigh;
  if (lower === 'medium') return STYLES.colors.riskMedium;
  return STYLES.colors.riskLow;
}

/**
 * Categorize photos into before/during/after for PDF sections.
 * Honors explicit category first; when missing, compares timestamps to job start/end
 * to place photos into before/during/after; defaults to during only when dates are unavailable.
 */
export function categorizePhotos(
  photos: JobDocumentAsset[],
  jobStartDate?: string | null,
  jobEndDate?: string | null
): {
  before: JobDocumentAsset[];
  during: JobDocumentAsset[];
  after: JobDocumentAsset[];
} {
  const jobStart = jobStartDate ? new Date(jobStartDate).getTime() : NaN;
  const jobEnd = jobEndDate ? new Date(jobEndDate).getTime() : jobStart;

  const before: JobDocumentAsset[] = [];
  const during: JobDocumentAsset[] = [];
  const after: JobDocumentAsset[] = [];

  photos.forEach((photo) => {
    // Honor explicit category first (from job_photos / document metadata)
    if (photo.category === 'before' || photo.category === 'during' || photo.category === 'after') {
      if (photo.category === 'before') before.push(photo);
      else if (photo.category === 'during') during.push(photo);
      else after.push(photo);
      return;
    }

    // When category missing: fall back to timestamp vs job start/end
    if (!Number.isFinite(jobStart)) {
      during.push(photo);
      return;
    }
    if (!photo.created_at) {
      during.push(photo);
      return;
    }
    const photoTime = new Date(photo.created_at).getTime();
    if (photoTime < jobStart) {
      before.push(photo);
    } else if (Number.isFinite(jobEnd) && photoTime > jobEnd) {
      after.push(photo);
    } else {
      during.push(photo);
    }
  });

  return { before, during, after };
}

