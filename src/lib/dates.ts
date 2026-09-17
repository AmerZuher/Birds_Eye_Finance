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

/** A YYYY-MM-DD split into local calendar numbers — month is 1-based, as written. */
export function dateParts(date: string): [number, number, number] {
  const [year, month, day] = date.split('-').map(Number);
  return [year, month, day];
}

/** The local date `days` after `date` (negative goes back). */
export function addDays(date: string, days: number): string {
  const [year, month, day] = dateParts(date);
  return localDateStr(new Date(year, month - 1, day + days));
}

/** Whole calendar days from `from` to `to` — negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = dateParts(from);
  const [y2, m2, d2] = dateParts(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}
