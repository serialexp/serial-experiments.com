/**
 * Format an ISO-8601 date (UTC, as written by SQLite's `datetime('now')`)
 * as `YYYY-MM-DD`. Same date format the old Hugo blog used; readable in
 * the monospace layout where a long human-friendly date would visually
 * disrupt the post list alignment.
 */
export function formatDate(iso: string): string {
  // Handle both "YYYY-MM-DD HH:MM:SS" (SQLite default) and full ISO.
  return iso.slice(0, 10);
}
