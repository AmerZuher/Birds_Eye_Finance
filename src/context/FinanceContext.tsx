import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import { expenses, incomeSources } from '@/db/schema';
import type { Expense, NewExpense } from '@/db/schema';
import { useCurrency } from '@/context/CurrencyContext';
import { useDebts } from '@/context/DebtsContext';
import { getMonthlyEquivalent } from '@/lib/period';
import type { Period } from '@/lib/period';

// Income sources, expenses, and the savings math built on them. Everything
// debt-shaped lives in DebtsContext (split out in Phase 6 — DEBTS_V2_PLAN §6);
// the only debt figure read here is totalNegativeMonthly, which is subtracted
// from income *before* expenses (CLAUDE.md rule 14). Migrations run in
// DatabaseProvider, above both contexts.

export type FinancialHealthTier = 'excellent' | 'good' | 'fair' | 'critical';

function computeFinancialHealth(effectiveIncome: number, savingsRate: number): FinancialHealthTier {
  if (effectiveIncome <= 0) return 'critical';
  if (savingsRate >= 20) return 'excellent';
  if (savingsRate >= 10) return 'good';
  if (savingsRate >= 0) return 'fair';
  return 'critical';
}

interface FinanceContextValue {
  incomeSources: (typeof incomeSources.$inferSelect)[];
  totalMonthlyIncomeBase: number;
  addIncomeSource: (input: { name: string; amount: number; currency: string }) => Promise<void>;
  removeIncomeSource: (id: number) => Promise<void>;
  expenses: Expense[];
  totalExpenses: number;
  addExpense: (input: Omit<NewExpense, 'id'>) => Promise<void>;
  updateExpense: (id: number, patch: Partial<NewExpense>) => Promise<void>;
  deleteExpense: (id: number) => Promise<void>;
  effectiveIncome: number;
  netSavings: number;
  savingsRate: number;
  financialHealth: FinancialHealthTier;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { convertToBase } = useCurrency();
  const { debtsCalculations } = useDebts();

  const { data: incomeSourceRows } = useLiveQuery(db.select().from(incomeSources));

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

  // Newest-first — "create mode prepends" (FEATURE_SPEC 2.7) falls out of
  // this ordering for free.
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

  const effectiveIncome = totalMonthlyIncomeBase - debtsCalculations.totalNegativeMonthly;
  const netSavings = effectiveIncome - totalExpenses;
  const savingsRate = effectiveIncome > 0 ? (netSavings / effectiveIncome) * 100 : 0;
  const financialHealth = computeFinancialHealth(effectiveIncome, savingsRate);

  const value = useMemo<FinanceContextValue>(
    () => ({
      incomeSources: incomeSourceRows ?? [],
      totalMonthlyIncomeBase,
      addIncomeSource,
      removeIncomeSource,
      expenses: expensesSafe,
      totalExpenses,
      addExpense,
      updateExpense,
      deleteExpense,
      effectiveIncome,
      netSavings,
      savingsRate,
      financialHealth,
    }),
    [
      incomeSourceRows,
      totalMonthlyIncomeBase,
      addIncomeSource,
      removeIncomeSource,
      expensesSafe,
      totalExpenses,
      addExpense,
      updateExpense,
      deleteExpense,
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
