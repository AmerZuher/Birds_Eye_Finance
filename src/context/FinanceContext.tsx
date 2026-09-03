import React, { createContext, useContext, useMemo } from 'react';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { incomeSources } from '@/db/schema';
import { useCurrency } from '@/context/CurrencyContext';

// Phase 1 scope: DB/migrations wiring + income sources for the Settings profile
// card's monthly-income line. Expense/Debt CRUD and derived calculations
// (groupedDebts, totalExpenses, financialHealth, ...) land in Phases 2-4.

interface FinanceContextValue {
  migrationsReady: boolean;
  migrationError?: Error;
  incomeSources: (typeof incomeSources.$inferSelect)[];
  totalMonthlyIncomeBase: number;
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

  const value = useMemo<FinanceContextValue>(
    () => ({
      migrationsReady: success,
      migrationError: error,
      incomeSources: incomeSourceRows ?? [],
      totalMonthlyIncomeBase,
    }),
    [success, error, incomeSourceRows, totalMonthlyIncomeBase],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within a FinanceProvider');
  return ctx;
}
