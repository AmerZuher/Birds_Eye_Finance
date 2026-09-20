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

/**
 * Display helpers for the calendar in `DateField`. Every one falls back to
 * plain ASCII if `Intl` can't produce the locale's form: Hermes ships Intl on
 * Android and the app already formats money through it, but a calendar that
 * throws while rendering would take the whole sheet down with it, and a month
 * header in the wrong language is a far smaller problem than that.
 */
/**
 * Numbers use exactly the tags CurrencyContext formats amounts with, so a day
 * number in the calendar is written in the same digits as every amount.
 * Date names pin the Gregorian calendar as well: the app's dates are Gregorian
 * throughout, and an ICU build that defaults `ar-SA` to Umm al-Qura would
 * otherwise print a Hijri month over a Gregorian grid.
 */
const NUMBER_TAG = { ar: 'ar-SA-u-nu-arab', en: 'en-US' } as const;
const DATE_TAG = { ar: 'ar-SA-u-nu-arab-ca-gregory', en: 'en-US' } as const;

function tagFor(map: typeof NUMBER_TAG | typeof DATE_TAG, language: string): string {
  return language === 'ar' ? map.ar : map.en;
}

/** "September 2026" — the calendar's month header. */
export function monthLabel(year: number, month: number, language: string): string {
  const date = new Date(year, month - 1, 1);
  try {
    return new Intl.DateTimeFormat(tagFor(DATE_TAG, language), {
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return `${year}-${String(month).padStart(2, '0')}`;
  }
}

/** The seven weekday headings, Sunday first — the column order the grid uses. */
export function weekdayInitials(language: string): string[] {
  // 2026-11-01 is a Sunday, so seven days from it walk one full week in order.
  const sunday = new Date(2026, 10, 1);
  try {
    const format = new Intl.DateTimeFormat(tagFor(DATE_TAG, language), { weekday: 'narrow' });
    return Array.from({ length: 7 }, (_, index) =>
      format.format(new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + index)),
    );
  } catch {
    return ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  }
}

/** A day number in the language's own digits (Arabic uses Arabic-Indic, like every amount). */
export function formatDayNumber(day: number, language: string): string {
  try {
    return new Intl.NumberFormat(tagFor(NUMBER_TAG, language), { useGrouping: false }).format(day);
  } catch {
    return String(day);
  }
}

/** Days in a month (month is 1-based). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Which column the 1st falls in, 0 = Sunday. */
export function firstWeekdayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

/** A local calendar date as YYYY-MM-DD, from its parts. */
export function toDateStr(year: number, month: number, day: number): string {
  return localDateStr(new Date(year, month - 1, day));
}

/** "20 September 2026" — a date as a person reads it, for a form field. */
export function formatDateLong(date: string, language: string): string {
  if (!isValidDateStr(date)) return date;
  const [year, month, day] = dateParts(date);
  try {
    return new Intl.DateTimeFormat(tagFor(DATE_TAG, language), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month - 1, day));
  } catch {
    return date;
  }
}

/** "20 Sep 2026" — the same date where space is tight (two fields side by side). */
export function formatDateMedium(date: string, language: string): string {
  if (!isValidDateStr(date)) return date;
  const [year, month, day] = dateParts(date);
  try {
    return new Intl.DateTimeFormat(tagFor(DATE_TAG, language), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(year, month - 1, day));
  } catch {
    return date;
  }
}
