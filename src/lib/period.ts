/**
 * The average calendar month, used wherever a rate has to be spread over days
 * rather than whole months: the period conversions below, and the balance
 * aging in src/lib/reconciliation.ts (FEATURE_SPEC 0.6, 9.5).
 */
export const DAYS_PER_MONTH = 30.44;

export type Period =
  'daily' | 'weekly' | 'monthly' | '3months' | '6months' | '9months' | 'yearly' | 'custom';

export function getMonthlyEquivalent(
  amount: number,
  period: Period,
  customPeriodDays?: number,
): number {
  switch (period) {
    case 'daily':
      return amount * DAYS_PER_MONTH;
    case 'weekly':
      return amount * 4.345;
    case 'custom':
      return (
        amount *
        (DAYS_PER_MONTH /
          (customPeriodDays && customPeriodDays > 0 ? customPeriodDays : DAYS_PER_MONTH))
      );
    case '3months':
      return amount / 3;
    case '6months':
      return amount / 6;
    case '9months':
      return amount / 9;
    case 'yearly':
      return amount / 12;
    case 'monthly':
    default:
      return amount;
  }
}
