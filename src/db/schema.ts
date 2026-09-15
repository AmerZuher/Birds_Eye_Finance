import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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

// A person is identity; debts point at one via personId (FEATURE_SPEC 1.3,
// docs/DEBTS_V2_PLAN.md §3). Names repeat, so `name_key` is indexed but NOT
// unique — it only drives suggestions/matching. Phone and device contact id
// are the strong keys: unique when present (SQLite allows any number of NULLs
// in a unique index, so optional values are fine).
export const people = sqliteTable(
  'people',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    nameKey: text('name_key').notNull(),
    phone: text('phone'),
    phoneKey: text('phone_key'),
    email: text('email'),
    company: text('company'),
    avatar: text('avatar'),
    contactId: text('contact_id'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('people_name_key_idx').on(t.nameKey),
    uniqueIndex('people_phone_key_uq').on(t.phoneKey),
    uniqueIndex('people_contact_id_uq').on(t.contactId),
  ],
);

export const debts = sqliteTable('debts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // Nullable only until backfillPeople() has run on data that predates people.
  personId: integer('person_id').references(() => people.id),
  // Snapshot of the person's name at write time — kept because the column is
  // NOT NULL and old backups/AI imports rely on it. Never used for grouping.
  name: text('name').notNull(),
  // Original principal. Payments never rewrite it — they're adjustments.
  amount: real('amount').notNull().default(0),
  monthlyPayment: real('monthly_payment').notNull().default(0),
  type: text('type', { enum: ['positive', 'negative'] }).notNull(),
  date: text('date').notNull(),
  notes: text('notes'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  currency: text('currency'),
  // Legacy per-debt contact copies — no longer read or written; contact
  // details live on `people`. Dropped in a later cleanup migration once
  // nothing imports the old shape (DEBTS_V2_PLAN §3.7).
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

// Payments and top-ups against one debt (FEATURE_SPEC 1.10). Signed, always in
// the parent debt's currency: negative reduces what's outstanding, positive
// adds to it. Status (open/partial/settled) is derived from these — never
// stored — so it can't drift from the ledger (src/lib/debtStatus.ts).
export const debtAdjustments = sqliteTable(
  'debt_adjustments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    debtId: integer('debt_id')
      .notNull()
      .references(() => debts.id, { onDelete: 'cascade' }),
    amount: real('amount').notNull(),
    date: text('date').notNull(),
    note: text('note'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('debt_adjustments_debt_id_idx').on(t.debtId)],
);

// Proof files attached to a debt, optionally tied to one adjustment
// (FEATURE_SPEC 1.12). `file_name` is relative to the app's attachments folder
// (`<uuid>.<ext>`) — never an absolute URI, since the app container's absolute
// path can change across iOS updates. See src/lib/attachments.ts.
export const debtAttachments = sqliteTable(
  'debt_attachments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    debtId: integer('debt_id')
      .notNull()
      .references(() => debts.id, { onDelete: 'cascade' }),
    adjustmentId: integer('adjustment_id').references(() => debtAdjustments.id, {
      onDelete: 'set null',
    }),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    originalName: text('original_name'),
    sizeBytes: integer('size_bytes').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('debt_attachments_debt_id_idx').on(t.debtId)],
);

export const incomeSources = sqliteTable('income_sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  amount: real('amount').notNull().default(0),
  currency: text('currency').notNull(),
});

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;
export type DebtAdjustment = typeof debtAdjustments.$inferSelect;
export type NewDebtAdjustment = typeof debtAdjustments.$inferInsert;
export type DebtAttachment = typeof debtAttachments.$inferSelect;
export type NewDebtAttachment = typeof debtAttachments.$inferInsert;
export type IncomeSource = typeof incomeSources.$inferSelect;
export type NewIncomeSource = typeof incomeSources.$inferInsert;
