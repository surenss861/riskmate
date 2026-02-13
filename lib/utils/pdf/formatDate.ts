/**
 * PDF date formatting with no app path-alias dependencies.
 * Used by shared PDF sections (e.g. signatures) so they can be consumed by both
 * the Next app and the backend without pulling in @/ aliases.
 */
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
