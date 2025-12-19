// src/lib/utils.js

/**
 * Format a timestamp (ms number | ISO string | Date) to India locale
 * with IST timezone, e.g. "19 Dec 2025, 11:45 am".
 */
export function formatDateTime(ts) {
  const d = ts instanceof Date ? ts : new Date(ts);
  return d.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * Return true if timestamp falls on the same local calendar day as "now".
 */
export function isToday(ts) {
  const d = ts instanceof Date ? ts : new Date(ts);
  const now = new Date();
  return d.toLocaleDateString() === now.toLocaleDateString();
}
