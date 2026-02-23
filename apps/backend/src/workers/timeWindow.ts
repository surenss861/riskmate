/**
 * Time-of-day window check using server local time.
 * Used so digest/reminder workers only run in the intended morning window (e.g. 08:00–08:10),
 * avoiding off-hour email blasts on restart.
 */
export function isWithinTimeWindow(
  now: Date,
  startHour: number,
  startMinute: number,
  durationMinutes: number
): boolean {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const totalStartMinutes = startHour * 60 + startMinute;
  const totalEndMinutes = totalStartMinutes + durationMinutes;
  const currentMinutes = hour * 60 + minute;
  return currentMinutes >= totalStartMinutes && currentMinutes < totalEndMinutes;
}
