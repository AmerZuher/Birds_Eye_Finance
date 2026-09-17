import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import { balanceSnapshots } from '@/db/schema';
import type { BalanceSnapshot } from '@/db/schema';
import { useCurrency } from '@/context/CurrencyContext';
import { useFinance } from '@/context/FinanceContext';
import { useUser } from '@/context/UserContext';
import { nowIso, todayStr } from '@/lib/dates';
import {
  daysSinceLog,
  expectedAt,
  isBalanceStale,
  latestSnapshot,
  snapshotHistory,
} from '@/lib/reconciliation';
import type { SnapshotView } from '@/lib/reconciliation';

/**
 * The reconciliation log and everything derived from it (FEATURE_SPEC Part 9).
 * The math itself is pure and lives in src/lib/reconciliation.ts; this is the
 * one place that pairs it with the live rows, so the Dashboard hero (7.3), the
 * stale nudge (7.4) and the variance chart (8.3) always agree.
 *
 * Sits inside FinanceProvider because the aging rate is FinanceContext's
 * netSavings, and inside UserProvider because the typed accounts (3.3) are the
 * fallback before anything has been logged.
 */

export interface LogBalanceInput {
  amount: number;
  currency: string;
  note?: string | null;
}

interface BalanceContextValue {
  /** Every log, newest first (the order the history screens read). */
  snapshots: BalanceSnapshot[];
  /** Each log with its expected figure and variance, oldest first. */
  history: SnapshotView[];
  latest: BalanceSnapshot | null;
  /** Today's log, when there is one — saving again replaces it (9.4). */
  todaysLog: BalanceSnapshot | null;
  hasLog: boolean;
  /** The latest log aged forward to today, or the typed accounts before the first log. */
  currentBalance: number;
  /** The sum of the profile's typed balances in base currency (3.3) — the seed. */
  accountsTotal: number;
  daysSince: number | null;
  isStale: boolean;
  /** The newest log's variance against what was expected — null until the second log. */
  latestVariance: number | null;
  logBalance: (input: LogBalanceInput) => Promise<void>;
  deleteSnapshot: (id: number) => Promise<void>;
}

const BalanceContext = createContext<BalanceContextValue | null>(null);

export function BalanceProvider({ children }: { children: React.ReactNode }) {
  const { convertToBase } = useCurrency();
  const { netSavings } = useFinance();
  const { profile } = useUser();

  const { data: rows } = useLiveQuery(
    db.select().from(balanceSnapshots).orderBy(desc(balanceSnapshots.date)),
  );
  const snapshots = useMemo(() => rows ?? [], [rows]);

  const today = todayStr();

  const latest = useMemo(() => latestSnapshot(snapshots), [snapshots]);

  const history = useMemo(
    () => snapshotHistory(snapshots, netSavings, convertToBase),
    [snapshots, netSavings, convertToBase],
  );

  const accountsTotal = useMemo(
    () =>
      (profile.startBalances ?? []).reduce(
        (sum, balance) => sum + convertToBase(balance.amount, balance.currency),
        0,
      ),
    [profile.startBalances, convertToBase],
  );

  // The logged figure aged forward (CLAUDE.md rule 15) — the typed accounts
  // only stand in until the first log exists.
  const currentBalance = useMemo(
    () => (latest ? expectedAt(latest, today, netSavings, convertToBase) : accountsTotal),
    [latest, today, netSavings, convertToBase, accountsTotal],
  );

  const latestVariance = useMemo(
    () => (history.length ? history[history.length - 1].variance : null),
    [history],
  );

  const todaysLog = useMemo(
    () => snapshots.find((row) => row.date === today) ?? null,
    [snapshots, today],
  );

  /**
   * One row per date (9.4): a second log on the same day is the user
   * correcting today's figure, so it updates in place instead of leaving two
   * rows an hour apart for the chart to treat as an interval.
   */
  const logBalance = useCallback(async (input: LogBalanceInput) => {
    const date = todayStr();
    const values = {
      date,
      amount: input.amount,
      currency: input.currency,
      note: input.note?.trim() ? input.note.trim() : null,
    };
    // Read and write in one (synchronous) transaction, so the "does today
    // already have a row" check can't be raced by another write.
    db.transaction((tx) => {
      const existing = tx
        .select()
        .from(balanceSnapshots)
        .where(eq(balanceSnapshots.date, date))
        .all();
      if (existing.length) {
        tx.update(balanceSnapshots)
          .set(values)
          .where(eq(balanceSnapshots.id, existing[0].id))
          .run();
        return;
      }
      tx.insert(balanceSnapshots)
        .values({ ...values, createdAt: nowIso() })
        .run();
    });
  }, []);

  const deleteSnapshot = useCallback(async (id: number) => {
    await db.delete(balanceSnapshots).where(eq(balanceSnapshots.id, id));
  }, []);

  const value = useMemo<BalanceContextValue>(
    () => ({
      snapshots,
      history,
      latest,
      todaysLog,
      hasLog: latest !== null,
      currentBalance,
      accountsTotal,
      daysSince: daysSinceLog(latest, today),
      isStale: isBalanceStale(latest, today),
      latestVariance,
      logBalance,
      deleteSnapshot,
    }),
    [
      snapshots,
      history,
      latest,
      todaysLog,
      currentBalance,
      accountsTotal,
      today,
      latestVariance,
      logBalance,
      deleteSnapshot,
    ],
  );

  return <BalanceContext.Provider value={value}>{children}</BalanceContext.Provider>;
}

export function useBalance(): BalanceContextValue {
  const ctx = useContext(BalanceContext);
  if (!ctx) throw new Error('useBalance must be used within a BalanceProvider');
  return ctx;
}
