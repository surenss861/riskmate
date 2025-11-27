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
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
      hour: '2-digit',
      minute: '2-digit',
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

export function categorizePhotos(
  photos: JobDocumentAsset[],
  jobStartDate?: string | null
): {
  before: JobDocumentAsset[];
  during: JobDocumentAsset[];
  after: JobDocumentAsset[];
} {
  if (!jobStartDate) return { before: [], during: photos, after: [] };

  const jobStart = new Date(jobStartDate).getTime();
  const jobEnd = Date.now();

  const before: JobDocumentAsset[] = [];
  const during: JobDocumentAsset[] = [];
  const after: JobDocumentAsset[] = [];

  photos.forEach((photo) => {
    if (!photo.created_at) {
      during.push(photo);
      return;
    }

    const photoTime = new Date(photo.created_at).getTime();
    if (photoTime < jobStart) {
      before.push(photo);
    } else if (photoTime > jobEnd) {
      after.push(photo);
    } else {
      during.push(photo);
    }
  });

  return { before, during, after };
}

