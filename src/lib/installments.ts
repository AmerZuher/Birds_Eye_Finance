import { DEFAULT_CURRENCY_CODE } from '@/constants/currencies';
import { dateParts, isValidDateStr, localDateStr } from '@/lib/dates';
import { MONEY_EPSILON } from '@/lib/debtStatus';
import type { DebtStatus } from '@/lib/debtStatus';

/**
 * The installment calendar of "I owe" debts with a monthly payment (FEATURE_SPEC 1.13). Pure date
 * math shared by the Dashboard's Coming up card (7.4) and the installment reminders, so both always
 * agree on what is due and what is already paid. Dates are local-calendar YYYY-MM-DD strings.
 */

/** The debt fields the calendar reads — a DebtView satisfies it. */
export interface InstallmentDebt {
  id: number;
  personId: number | null;
  type: 'positive' | 'negative';
  status: DebtStatus;
  date: string;
  monthlyPayment: number;
  startDate: string | null;
  endDate: string | null;
  currency: string | null;
  outstanding: number;
}

/** One recorded payment (a − adjustment, so `amount` is negative), in the debt's currency. */
export interface PaymentRecord {
  debtId: number;
  amount: number;
  date: string;
}

export interface InstallmentEvent {
  /** An installment falling due, or the plan's end date. */
  kind: 'installment' | 'planEnd';
  debtId: number;
  personId: number;
  date: string;
  /** The monthly payment for an installment; what's still outstanding for a plan end. */
  amount: number;
  currency: string;
}

/** Installment `index` (0 = the start date). A day the month doesn't have falls on its last day. */
function installmentDate(startDate: string, index: number): string {
  const [year, month, day] = dateParts(startDate);
  const lastDay = new Date(year, month + index, 0).getDate();
  return localDateStr(new Date(year, month - 1 + index, Math.min(day, lastDay)));
}

/** An active "I owe" debt with a monthly payment and a valid start date. */
export function hasInstallmentPlan(debt: InstallmentDebt): boolean {
  return (
    debt.type === 'negative' &&
    debt.status !== 'settled' &&
    debt.personId != null &&
    debt.monthlyPayment > MONEY_EPSILON &&
    !!debt.startDate &&
    isValidDateStr(debt.startDate)
  );
}

/**
 * Every installment and plan end dated from `from` to `to` (both included), soonest first.
 * An installment is left out when the payments recorded after the previous installment date — for
 * the first installment, on or after the debt's own date — and up to its own date add up to at
 * least the monthly payment.
 */
export function installmentEvents(
  debts: InstallmentDebt[],
  payments: PaymentRecord[],
  from: string,
  to: string,
): InstallmentEvent[] {
  const paymentsByDebt = new Map<number, PaymentRecord[]>();
  for (const payment of payments) {
    const list = paymentsByDebt.get(payment.debtId);
    if (list) list.push(payment);
    else paymentsByDebt.set(payment.debtId, [payment]);
  }

  const events: InstallmentEvent[] = [];
  for (const debt of debts) {
    if (!hasInstallmentPlan(debt) || debt.personId == null || !debt.startDate) continue;
    const { startDate, personId } = debt;
    const endDate = debt.endDate && isValidDateStr(debt.endDate) ? debt.endDate : null;
    const currency = debt.currency ?? DEFAULT_CURRENCY_CODE;
    const own = paymentsByDebt.get(debt.id) ?? [];

    // Start a month before the window's month, so short months can't skip one.
    const [startYear, startMonth] = dateParts(startDate);
    const [fromYear, fromMonth] = dateParts(from);
    const firstIndex = Math.max(0, (fromYear - startYear) * 12 + (fromMonth - startMonth) - 1);

    for (let index = firstIndex; ; index += 1) {
      const date = installmentDate(startDate, index);
      if (date > to || (endDate && date > endDate)) break;
      if (date < from) continue;
      const previous = index === 0 ? null : installmentDate(startDate, index - 1);
      let paid = 0;
      for (const payment of own) {
        const inCycle =
          previous == null
            ? payment.date >= debt.date && payment.date <= date
            : payment.date > previous && payment.date <= date;
        if (inCycle) paid -= payment.amount;
      }
      if (paid + MONEY_EPSILON >= debt.monthlyPayment) continue;
      events.push({
        kind: 'installment',
        debtId: debt.id,
        personId,
        date,
        amount: debt.monthlyPayment,
        currency,
      });
    }

    if (endDate && endDate >= from && endDate <= to) {
      events.push({
        kind: 'planEnd',
        debtId: debt.id,
        personId,
        date: endDate,
        amount: debt.outstanding,
        currency,
      });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.debtId - b.debtId);
}
