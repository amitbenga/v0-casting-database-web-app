/**
 * Centralized date formatting for the entire application.
 * Always uses Hebrew-Israel locale and Asia/Jerusalem timezone.
 */

const dateTimeFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
})

const dateOnlyFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Jerusalem",
})

/**
 * Format a date string or Date object to Hebrew-IL format with time.
 * Output: "23.06.2025, 16:39"
 */
export function formatDateHe(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return ""
  return dateTimeFormatter.format(d)
}

/**
 * Format a date string or Date object to Hebrew-IL format (date only, no time).
 * Output: "23.06.2025"
 */
export function formatDateOnlyHe(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return ""
  return dateOnlyFormatter.format(d)
}
