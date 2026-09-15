/**
 * Local-calendar YYYY-MM-DD helpers, shared by every date field in the app.
 * Built from local Date components — never toISOString/UTC parsing — because a
 * timezone with a positive UTC offset would otherwise shift "today" or a typed
 * date back a day when round-tripped through UTC (caught in Phase 3 testing).
 */
export function todayStr(): string {
  return localDateStr(new Date());
}

/** The local calendar day of an instant — e.g. an ISO `created_at`, shown as the day it happened here. */
export function localDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateStr(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Row audit timestamp (`created_at`) — a real instant, so UTC is correct here. */
export function nowIso(): string {
  return new Date().toISOString();
}
