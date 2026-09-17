import type { BalanceSnapshot } from '@/db/schema';
import { daysBetween } from '@/lib/dates';
import { MONEY_EPSILON } from '@/lib/debtStatus';
import { DAYS_PER_MONTH } from '@/lib/period';

/**
 * The reconciliation math (FEATURE_SPEC Part 9, CLAUDE.md rule 15): what the
 * app expected to be in the user's pocket versus what they logged.
 *
 * Pure functions, no React and no context — the hero (7.3), the stale-balance
 * nudge (7.4) and the variance chart (8.3) all read them through
 * BalanceContext, so the three can never disagree about what "expected" means.
 *
 * `netSavings` is whatever FinanceContext derives *now* (income −
 * installments − expenses); the app keeps no history of it, so an interval is
 * always aged with today's configuration. FEATURE_SPEC Part 6 says so out
 * loud rather than dressing the number up as an audit of the past.
 */

/** Past this many days without a log, the Dashboard nudges (FEATURE_SPEC 7.4). */
export const STALE_AFTER_DAYS = 30;

/** Converts an amount in its own currency into the base currency (CurrencyContext). */
export type ToBase = (amount: number, currency: string) => number;

/** One logged balance with its base-currency value resolved, newest interval first. */
export interface SnapshotView {
  snapshot: BalanceSnapshot;
  /** The logged amount in base currency. */
  logged: number;
  /**
   * What this log was expected to be, aged from the log before it — null for
   * the very first log, which has nothing to be compared against.
   */
  expected: number | null;
  /** `logged − expected`, null for the first log. */
  variance: number | null;
  /** Days covered since the previous log — the interval the variance belongs to. */
  days: number | null;
}

/**
 * The most recent log: greatest date, breaking ties on the later `createdAt`
 * and then the higher id. Same-date rows shouldn't exist (a same-day log
 * updates in place, 9.4), but an import can append one, so "latest" is defined
 * rather than left to row order.
 */
export function latestSnapshot(snapshots: readonly BalanceSnapshot[]): BalanceSnapshot | null {
  let latest: BalanceSnapshot | null = null;
  for (const row of snapshots) {
    if (!latest) {
      latest = row;
      continue;
    }
    if (row.date > latest.date) latest = row;
    else if (row.date === latest.date) {
      if (row.createdAt > latest.createdAt) latest = row;
      else if (row.createdAt === latest.createdAt && row.id > latest.id) latest = row;
    }
  }
  return latest;
}

/** Oldest first — the order the variance history is built in. */
export function sortSnapshots(snapshots: readonly BalanceSnapshot[]): BalanceSnapshot[] {
  return [...snapshots].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
  );
}

/**
 * One row per date, keeping the last-written one — the same "latest wins"
 * rule `latestSnapshot` uses. Logging twice in a day updates the row rather
 * than adding one (9.4), but an import appends whatever the file holds, so
 * two rows can share a date; left alone they would produce a zero-day
 * interval whose variance is meaningless. Collapsing here means duplicates
 * are harmless wherever they come from.
 */
export function oneLogPerDate(snapshots: readonly BalanceSnapshot[]): BalanceSnapshot[] {
  const byDate = new Map<string, BalanceSnapshot>();
  for (const row of sortSnapshots(snapshots)) byDate.set(row.date, row);
  return [...byDate.values()];
}

/**
 * A balance aged forward from the day it was logged: the log plus net savings
 * spread over the days since, using the same average month as every other
 * period conversion (FEATURE_SPEC 0.6). Aging backwards (`asOf` before the
 * log) is left to the caller to avoid — nothing in the app does it.
 */
export function expectedAt(
  from: BalanceSnapshot,
  asOf: string,
  netSavings: number,
  toBase: ToBase,
): number {
  const days = daysBetween(from.date, asOf);
  return toBase(from.amount, from.currency) + netSavings * (days / DAYS_PER_MONTH);
}

/**
 * Every log with its expected figure and variance, oldest first. Each log is
 * measured against the one before it, so the first has neither.
 */
export function snapshotHistory(
  snapshots: readonly BalanceSnapshot[],
  netSavings: number,
  toBase: ToBase,
): SnapshotView[] {
  const ordered = oneLogPerDate(snapshots);
  return ordered.map((snapshot, index) => {
    const logged = toBase(snapshot.amount, snapshot.currency);
    const previous = index === 0 ? null : ordered[index - 1];
    if (!previous) return { snapshot, logged, expected: null, variance: null, days: null };
    const expected = expectedAt(previous, snapshot.date, netSavings, toBase);
    return {
      snapshot,
      logged,
      expected,
      variance: logged - expected,
      days: daysBetween(previous.date, snapshot.date),
    };
  });
}

/** Whole days since the last log — null when nothing has been logged yet. */
export function daysSinceLog(latest: BalanceSnapshot | null, today: string): number | null {
  return latest ? daysBetween(latest.date, today) : null;
}

/** A logged balance older than STALE_AFTER_DAYS. Never stale before the first log (7.4). */
export function isBalanceStale(latest: BalanceSnapshot | null, today: string): boolean {
  const days = daysSinceLog(latest, today);
  return days !== null && days > STALE_AFTER_DAYS;
}

/** A variance small enough to read as "matched what was expected" (7.3). */
export function isOnTrack(variance: number | null): boolean {
  return variance !== null && Math.abs(variance) <= MONEY_EPSILON;
}
