export type Period =
  'daily' | 'weekly' | 'monthly' | '3months' | '6months' | '9months' | 'yearly' | 'custom';

export function getMonthlyEquivalent(
  amount: number,
  period: Period,
  customPeriodDays?: number,
): number {
  switch (period) {
    case 'daily':
      return amount * 30.44;
    case 'weekly':
      return amount * 4.345;
    case 'custom':
      return (
        amount * (30.44 / (customPeriodDays && customPeriodDays > 0 ? customPeriodDays : 30.44))
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
