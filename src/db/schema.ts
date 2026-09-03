import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// No `targets` table — see CLAUDE.md rule 13.

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  amount: real('amount').notNull().default(0),
  icon: text('icon').notNull(),
  category: text('category').notNull(),
  currency: text('currency'),
  period: text('period'),
  notes: text('notes'),
  translationKey: text('translation_key'),
  customPeriodDays: integer('custom_period_days'),
});

export const debts = sqliteTable('debts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  amount: real('amount').notNull().default(0),
  monthlyPayment: real('monthly_payment').notNull().default(0),
  type: text('type', { enum: ['positive', 'negative'] }).notNull(),
  date: text('date').notNull(),
  notes: text('notes'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  currency: text('currency'),
  phone: text('phone'),
  avatar: text('avatar'),
  email: text('email'),
  company: text('company'),
  contactId: text('contact_id'),
  // Soft-delete: null = active. Deleting from the person/summary views sets
  // this instead of removing the row, so it surfaces in the debts history
  // screen (bank-app style) until permanently removed from there.
  deletedAt: text('deleted_at'),
});

export const incomeSources = sqliteTable('income_sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  amount: real('amount').notNull().default(0),
  currency: text('currency').notNull(),
});

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;
export type IncomeSource = typeof incomeSources.$inferSelect;
export type NewIncomeSource = typeof incomeSources.$inferInsert;
