import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { eq } from 'drizzle-orm';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { incomeSources } from '@/db/schema';
import { useCurrency } from '@/context/CurrencyContext';

// Phase 1 scope: DB/migrations wiring + income sources for the Settings profile
// card's monthly-income line. Expense/Debt CRUD (groupedDebts, totalExpenses,
// totalNegativeMonthly, ...) land in Phases 3-4 — until then totalNegativeMonthly
// and totalExpenses are 0 (no debt/expense records exist yet), so the derived
// figures below correctly reduce to income-only.

export type FinancialHealthTier = 'excellent' | 'good' | 'fair' | 'critical';

function computeFinancialHealth(effectiveIncome: number, savingsRate: number): FinancialHealthTier {
  if (effectiveIncome <= 0) return 'critical';
  if (savingsRate >= 20) return 'excellent';
  if (savingsRate >= 10) return 'good';
  if (savingsRate >= 0) return 'fair';
  return 'critical';
}

interface FinanceContextValue {
  migrationsReady: boolean;
  migrationError?: Error;
  incomeSources: (typeof incomeSources.$inferSelect)[];
  totalMonthlyIncomeBase: number;
  addIncomeSource: (input: { name: string; amount: number; currency: string }) => Promise<void>;
  removeIncomeSource: (id: number) => Promise<void>;
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

  const totalNegativeMonthly = 0; // wired in Phase 3 (Debts)
  const totalExpenses = 0; // wired in Phase 4 (Expenses)

  const effectiveIncome = totalMonthlyIncomeBase - totalNegativeMonthly;
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
