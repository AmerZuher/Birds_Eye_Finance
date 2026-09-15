/**
 * Debt status is always derived from the ledger, never stored (FEATURE_SPEC
 * 1.10, DEBTS_V2_PLAN §4.2) — a stored status/archived flag could drift from
 * the adjustments it summarizes.
 */

/** Money comparisons tolerate half a minor unit on the existing `real` columns. */
export const MONEY_EPSILON = 0.005;

export type DebtStatus = 'open' | 'partial' | 'settled';

export interface DebtBalance {
  /** What's still owed, in the debt's own currency (0 once settled). */
  outstanding: number;
  /** Net amount paid down so far — the floor an edited principal can't go below. */
  paid: number;
  adjustmentSum: number;
  status: DebtStatus;
  /** Paid share of the original principal, 0..1. */
  progress: number;
}

export function getDebtBalance(amount: number, adjustmentSum: number): DebtBalance {
  const raw = amount + adjustmentSum;
  const status: DebtStatus =
    raw <= MONEY_EPSILON ? 'settled' : adjustmentSum < -MONEY_EPSILON ? 'partial' : 'open';
  const outstanding = status === 'settled' ? 0 : raw;
  const paid = Math.max(-adjustmentSum, 0);
  const progress = amount > 0 ? Math.min(1, Math.max(0, (amount - outstanding) / amount)) : 0;
  return { outstanding, paid, adjustmentSum, status, progress };
}

export function isMoneyZero(value: number): boolean {
  return Math.abs(value) <= MONEY_EPSILON;
}

/** "#0042" — the record id, zero-padded. Stable: the table uses AUTOINCREMENT, so ids are never reused. */
export function formatDebtId(id: number): string {
  return `#${String(id).padStart(4, '0')}`;
}
