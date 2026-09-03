import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { eq } from 'drizzle-orm';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { debts, incomeSources } from '@/db/schema';
import type { Debt, NewDebt } from '@/db/schema';
import { useCurrency } from '@/context/CurrencyContext';

// Phase 1-2 scope: DB/migrations wiring + income sources for the Settings
// profile card's monthly-income line. Phase 3 (this file) adds Debt CRUD +
// the groupedDebts engine (FEATURE_SPEC Part 1.3). totalExpenses stays 0
// until Phase 4 (Expenses) lands.

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
  debts: Debt[];
  groupedDebts: DebtGroup[];
  debtFilter: DebtFilter;
  setDebtFilter: (filter: DebtFilter) => void;
  debtsCalculations: DebtsCalculations;
  addDebt: (input: Omit<NewDebt, 'id'>) => Promise<void>;
  updateDebt: (id: number, patch: Partial<NewDebt>) => Promise<void>;
  deleteDebt: (id: number) => Promise<void>;
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
  const { data: debtRows } = useLiveQuery(db.select().from(debts));

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

  const [debtFilter, setDebtFilter] = useState<DebtFilter>('all');

  const debtRowsSafe = debtRows ?? [];

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
        type: group.totalNet > 0 ? 'positive' : group.totalNet < 0 ? 'negative' : 'settled',
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

  const deleteDebt = useCallback(async (id: number) => {
    await db.delete(debts).where(eq(debts.id, id));
  }, []);

  const totalExpenses = 0; // wired in Phase 4 (Expenses)

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
      debts: debtRowsSafe,
      groupedDebts,
      debtFilter,
      setDebtFilter,
      debtsCalculations,
      addDebt,
      updateDebt,
      deleteDebt,
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
      debtRowsSafe,
      groupedDebts,
      debtFilter,
      debtsCalculations,
      addDebt,
      updateDebt,
      deleteDebt,
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
