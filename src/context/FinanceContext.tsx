import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { debts, expenses, incomeSources } from '@/db/schema';
import type { Debt, Expense, NewDebt, NewExpense } from '@/db/schema';
import { useCurrency } from '@/context/CurrencyContext';
import { getMonthlyEquivalent } from '@/lib/period';
import type { Period } from '@/lib/period';

// Phase 1-2 scope: DB/migrations wiring + income sources for the Settings
// profile card's monthly-income line. Phase 3 adds Debt CRUD + the
// groupedDebts engine (FEATURE_SPEC Part 1.3). Phase 4 (this file) adds
// Expense CRUD + totalExpenses (FEATURE_SPEC 2.2/0.6), wired into
// effectiveIncome/netSavings/savingsRate below.

export type FinancialHealthTier = 'excellent' | 'good' | 'fair' | 'critical';

function computeFinancialHealth(effectiveIncome: number, savingsRate: number): FinancialHealthTier {
  if (effectiveIncome <= 0) return 'critical';
  if (savingsRate >= 20) return 'excellent';
  if (savingsRate >= 10) return 'good';
  if (savingsRate >= 0) return 'fair';
  return 'critical';
}

export type DebtGroupType = 'positive' | 'negative' | 'settled';
export type DebtFilter = 'all' | 'positive' | 'negative';

export interface DebtGroup {
  name: string;
  transactions: Debt[];
  totalNet: number;
  type: DebtGroupType;
  phone?: string;
  avatar?: string;
  email?: string;
  company?: string;
  contactId?: string;
}

interface DebtsCalculations {
  totalPositiveAmount: number;
  totalNegativeAmount: number;
  totalNegativeMonthly: number;
}

interface FinanceContextValue {
  migrationsReady: boolean;
  migrationError?: Error;
  incomeSources: (typeof incomeSources.$inferSelect)[];
  totalMonthlyIncomeBase: number;
  addIncomeSource: (input: { name: string; amount: number; currency: string }) => Promise<void>;
  removeIncomeSource: (id: number) => Promise<void>;
  expenses: Expense[];
  totalExpenses: number;
  addExpense: (input: Omit<NewExpense, 'id'>) => Promise<void>;
  updateExpense: (id: number, patch: Partial<NewExpense>) => Promise<void>;
  deleteExpense: (id: number) => Promise<void>;
  debts: Debt[];
  deletedDebts: Debt[];
  groupedDebts: DebtGroup[];
  debtFilter: DebtFilter;
  setDebtFilter: (filter: DebtFilter) => void;
  debtsCalculations: DebtsCalculations;
  addDebt: (input: Omit<NewDebt, 'id'>) => Promise<void>;
  updateDebt: (id: number, patch: Partial<NewDebt>) => Promise<void>;
  /** Soft delete — moves the debt to `deletedDebts` (the history screen). */
  deleteDebt: (id: number) => Promise<void>;
  /** Hard delete — only ever called from the history screen. */
  permanentlyDeleteDebt: (id: number) => Promise<void>;
  effectiveIncome: number;
  netSavings: number;
  savingsRate: number;
  financialHealth: FinancialHealthTier;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { success, error } = useMigrations(db, migrations);
  const { convertToBase } = useCurrency();

  const { data: incomeSourceRows } = useLiveQuery(db.select().from(incomeSources));
  // Newest-first — "create mode prepends" (FEATURE_SPEC 1.7) falls out for
  // free from this ordering, both in a person's transaction history and when
  // groupedDebtsAll merges each group's first-found contact metadata below.
  // Soft-deleted rows (deletedAt set) are excluded here — they live in
  // deletedDebtRows below, for the debts history screen.
  const { data: debtRows } = useLiveQuery(
    db.select().from(debts).where(isNull(debts.deletedAt)).orderBy(desc(debts.id)),
  );
  const { data: deletedDebtRows } = useLiveQuery(
    db.select().from(debts).where(isNotNull(debts.deletedAt)).orderBy(desc(debts.deletedAt)),
  );

  const totalMonthlyIncomeBase = useMemo(() => {
    if (!incomeSourceRows) return 0;
    return incomeSourceRows.reduce(
      (sum, source) => sum + convertToBase(source.amount, source.currency),
      0,
    );
  }, [incomeSourceRows, convertToBase]);

  const addIncomeSource = useCallback(
    async (input: { name: string; amount: number; currency: string }) => {
      await db.insert(incomeSources).values(input);
    },
    [],
  );

  const removeIncomeSource = useCallback(async (id: number) => {
    await db.delete(incomeSources).where(eq(incomeSources.id, id));
  }, []);

  // Newest-first, like debts above — "create mode prepends" (FEATURE_SPEC
  // 2.7) falls out of this ordering for free.
  const { data: expenseRows } = useLiveQuery(db.select().from(expenses).orderBy(desc(expenses.id)));
  const expensesSafe = useMemo(() => expenseRows ?? [], [expenseRows]);

  // FEATURE_SPEC 2.2/0.6: every expense's amount is normalized to its
  // monthly equivalent (any billing period) via getMonthlyEquivalent, then
  // converted to base currency, and summed.
  const totalExpenses = useMemo(() => {
    return expensesSafe.reduce((sum, expense) => {
      const monthly = getMonthlyEquivalent(
        expense.amount,
        (expense.period as Period) ?? 'monthly',
        expense.customPeriodDays ?? undefined,
      );
      return sum + convertToBase(monthly, expense.currency ?? 'SAR');
    }, 0);
  }, [expensesSafe, convertToBase]);

  const addExpense = useCallback(async (input: Omit<NewExpense, 'id'>) => {
    await db.insert(expenses).values(input);
  }, []);

  const updateExpense = useCallback(async (id: number, patch: Partial<NewExpense>) => {
    await db.update(expenses).set(patch).where(eq(expenses.id, id));
  }, []);

  const deleteExpense = useCallback(async (id: number) => {
    await db.delete(expenses).where(eq(expenses.id, id));
  }, []);

  const [debtFilter, setDebtFilter] = useState<DebtFilter>('all');

  const debtRowsSafe = useMemo(() => debtRows ?? [], [debtRows]);

  const debtsCalculations = useMemo<DebtsCalculations>(() => {
    let totalPositiveAmount = 0;
    let totalNegativeAmount = 0;
    let totalNegativeMonthly = 0;
    for (const debt of debtRowsSafe) {
      const currency = debt.currency ?? 'SAR';
      const base = convertToBase(debt.amount, currency);
      if (debt.type === 'positive') {
        totalPositiveAmount += base;
      } else {
        totalNegativeAmount += base;
        if (debt.monthlyPayment > 0) {
          totalNegativeMonthly += convertToBase(debt.monthlyPayment, currency);
        }
      }
    }
    return { totalPositiveAmount, totalNegativeAmount, totalNegativeMonthly };
  }, [debtRowsSafe, convertToBase]);

  // FEATURE_SPEC 1.3: group by trimmed name (exact match), merging the
  // first-found non-empty contact metadata and accumulating a running net
  // (base currency) per group. Sorted by absolute net descending for 1.2.
  const groupedDebtsAll = useMemo<DebtGroup[]>(() => {
    const order: string[] = [];
    const groups = new Map<string, DebtGroup>();

    for (const debt of debtRowsSafe) {
      const name = debt.name.trim();
      let group = groups.get(name);
      if (!group) {
        group = { name, transactions: [], totalNet: 0, type: 'settled' };
        groups.set(name, group);
        order.push(name);
      }
      group.transactions.push(debt);
      const base = convertToBase(debt.amount, debt.currency ?? 'SAR');
      group.totalNet += debt.type === 'positive' ? base : -base;
      if (!group.phone && debt.phone) group.phone = debt.phone;
      if (!group.avatar && debt.avatar) group.avatar = debt.avatar;
      if (!group.email && debt.email) group.email = debt.email;
      if (!group.company && debt.company) group.company = debt.company;
      if (!group.contactId && debt.contactId) group.contactId = debt.contactId;
    }

    return order
      .map((name) => groups.get(name)!)
      .map((group) => ({
        ...group,
        type: (group.totalNet > 0
          ? 'positive'
          : group.totalNet < 0
            ? 'negative'
            : 'settled') as DebtGroupType,
      }))
      .sort((a, b) => Math.abs(b.totalNet) - Math.abs(a.totalNet));
  }, [debtRowsSafe, convertToBase]);

  const groupedDebts = useMemo(() => {
    if (debtFilter === 'all') return groupedDebtsAll;
    return groupedDebtsAll.filter((group) => group.type === debtFilter);
  }, [groupedDebtsAll, debtFilter]);

  const addDebt = useCallback(async (input: Omit<NewDebt, 'id'>) => {
    await db.insert(debts).values(input);
  }, []);

  const updateDebt = useCallback(async (id: number, patch: Partial<NewDebt>) => {
    await db.update(debts).set(patch).where(eq(debts.id, id));
  }, []);

  // Soft delete — moves the debt to the history screen instead of erasing it
  // outright, matching a bank app's transaction history.
  const deleteDebt = useCallback(async (id: number) => {
    await db.update(debts).set({ deletedAt: new Date().toISOString() }).where(eq(debts.id, id));
  }, []);

  const permanentlyDeleteDebt = useCallback(async (id: number) => {
    await db.delete(debts).where(eq(debts.id, id));
  }, []);

  const effectiveIncome = totalMonthlyIncomeBase - debtsCalculations.totalNegativeMonthly;
  const netSavings = effectiveIncome - totalExpenses;
  const savingsRate = effectiveIncome > 0 ? (netSavings / effectiveIncome) * 100 : 0;
  const financialHealth = computeFinancialHealth(effectiveIncome, savingsRate);

  const value = useMemo<FinanceContextValue>(
    () => ({
      migrationsReady: success,
      migrationError: error,
      incomeSources: incomeSourceRows ?? [],
      totalMonthlyIncomeBase,
      addIncomeSource,
      removeIncomeSource,
      expenses: expensesSafe,
      totalExpenses,
      addExpense,
      updateExpense,
      deleteExpense,
      debts: debtRowsSafe,
      deletedDebts: deletedDebtRows ?? [],
      groupedDebts,
      debtFilter,
      setDebtFilter,
      debtsCalculations,
      addDebt,
      updateDebt,
      deleteDebt,
      permanentlyDeleteDebt,
      effectiveIncome,
      netSavings,
      savingsRate,
      financialHealth,
    }),
    [
      success,
      error,
      incomeSourceRows,
      totalMonthlyIncomeBase,
      addIncomeSource,
      removeIncomeSource,
      expensesSafe,
      totalExpenses,
      addExpense,
      updateExpense,
      deleteExpense,
      debtRowsSafe,
      deletedDebtRows,
      groupedDebts,
      debtFilter,
      debtsCalculations,
      addDebt,
      updateDebt,
      deleteDebt,
      permanentlyDeleteDebt,
      effectiveIncome,
      netSavings,
      savingsRate,
      financialHealth,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within a FinanceProvider');
  return ctx;
}
