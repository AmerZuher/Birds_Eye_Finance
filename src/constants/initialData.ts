// Non-relational data models (see CLAUDE.md rule 1 / FEATURE_SPEC 0.7).
// Expense/Debt/IncomeSource row types live in src/db/schema.ts (Drizzle-inferred).
// No `Target` type, no `targets` field here — see CLAUDE.md rule 13.

export interface StartBalance {
  id: number;
  name: string;
  amount: number;
  currency: string;
}

export interface Profile {
  name: string;
  avatar: string;
  startBalances?: StartBalance[];
  lastReconciledDate?: string;
}

export const DEFAULT_PROFILE: Profile = {
  name: '',
  avatar: '',
  startBalances: [],
};

export const EXPENSE_CATEGORIES = [
  'essential',
  'personal',
  'subscriptions',
  'entertainment',
  'emergency',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
