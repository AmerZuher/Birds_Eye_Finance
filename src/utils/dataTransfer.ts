import { db } from '@/db/client';
import {
  debtAdjustments,
  debtAttachments,
  debts,
  expenses,
  incomeSources,
  people,
} from '@/db/schema';
import type {
  Debt,
  DebtAdjustment,
  DebtAttachment,
  Expense,
  IncomeSource,
  NewExpense,
  NewIncomeSource,
  Person,
} from '@/db/schema';
import { DEFAULT_CURRENCY_CODE } from '@/constants/currencies';
import type { Profile, StartBalance } from '@/constants/initialData';
import { duplicateAttachmentFile } from '@/lib/attachments';
import { isAvatarAvailable } from '@/lib/avatars';
import { nowIso, todayStr } from '@/lib/dates';
import { resolvePerson, toPersonValues } from '@/lib/people';

/**
 * Export and import (FEATURE_SPEC 3.4). The app keeps no backups of its own: an export is a
 * JSON file the user shares somewhere, and an import adds a file's records on top of the live
 * data — nothing is ever replaced.
 */

/**
 * A debt as it can appear in a snapshot. Current exports carry `personId`;
 * older files and AI-prompt imports carry the person inline instead
 * (`name`/`phone`/`email`/`company`/`contactId`) and no `personId`.
 */
export type SnapshotDebt = Partial<Debt>;

export interface BackupSnapshot {
  expenses: Expense[];
  people: Person[];
  debts: SnapshotDebt[];
  debtAdjustments: DebtAdjustment[];
  /** Attachment records only — files are never part of an export. */
  debtAttachments: DebtAttachment[];
  incomes: IncomeSource[];
  profile: Partial<Profile>;
  currency: string;
  theme: string;
  exportedAt: string;
}

/** Assembles the full snapshot from live DB tables + the given preference values. */
export async function buildSnapshot(
  profile: Profile,
  currency: string,
  theme: string,
): Promise<BackupSnapshot> {
  const [expenseRows, peopleRows, debtRows, adjustmentRows, attachmentRows, incomeRows] =
    await Promise.all([
      db.select().from(expenses),
      db.select().from(people),
      db.select().from(debts),
      db.select().from(debtAdjustments),
      db.select().from(debtAttachments),
      db.select().from(incomeSources),
    ]);

  return {
    expenses: expenseRows,
    people: peopleRows,
    debts: debtRows,
    debtAdjustments: adjustmentRows,
    debtAttachments: attachmentRows,
    incomes: incomeRows,
    profile,
    currency,
    theme,
    exportedAt: new Date().toISOString(),
  };
}

function arrayOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Tolerant parser: accepts a full export file (either shape), or a partial
 * object with just `{ debts: [...] }` / `{ expenses: [...] }` — the shape the
 * AI-prompt workflow (FEATURE_SPEC 3.4) produces when pasted into the import box.
 */
export function parseSnapshot(raw: string): BackupSnapshot {
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object') {
    throw new Error('Not a valid backup: expected a JSON object.');
  }
  const obj = data as Record<string, unknown>;

  return {
    expenses: arrayOf<Expense>(obj.expenses),
    people: arrayOf<Person>(obj.people),
    debts: arrayOf<SnapshotDebt>(obj.debts),
    debtAdjustments: arrayOf<DebtAdjustment>(obj.debtAdjustments),
    debtAttachments: arrayOf<DebtAttachment>(obj.debtAttachments),
    incomes: arrayOf<IncomeSource>(obj.incomes),
    profile:
      obj.profile && typeof obj.profile === 'object' ? (obj.profile as Partial<Profile>) : {},
    currency: typeof obj.currency === 'string' ? obj.currency : '',
    theme: typeof obj.theme === 'string' ? obj.theme : '',
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
  };
}

function toNewExpenses(items: Expense[]): NewExpense[] {
  return items.map(({ id: _id, ...rest }) => ({
    ...rest,
    icon: rest.icon || rest.category || 'essential',
    category: rest.category || 'essential',
  }));
}

function toNewIncomes(items: IncomeSource[]): NewIncomeSource[] {
  return items.map(({ id: _id, ...rest }) => rest);
}

/** Balances an import would add — named, with a positive amount, like Edit Profile's own add row. */
function importableBalances(profile: Partial<Profile>): StartBalance[] {
  return arrayOf<Partial<StartBalance>>(profile.startBalances)
    .filter((b) => typeof b?.name === 'string' && b.name.trim() && Number(b.amount) > 0)
    .map((b, index) => ({
      id: Date.now() + index,
      name: String(b.name).trim(),
      amount: Number(b.amount),
      currency: typeof b.currency === 'string' && b.currency ? b.currency : DEFAULT_CURRENCY_CODE,
    }));
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Inserts a snapshot's people, debts, adjustments and attachment records,
 * remapping every id (autoincrement assigns new ones) — DEBTS_V2_PLAN §7.
 * Returns how many debts were inserted.
 */
function insertDebtGraph(
  tx: Transaction,
  snapshot: BackupSnapshot,
  /** The file name an imported attachment record should use, or null to drop the record. */
  fileNameFor: (fileName: string) => string | null,
): number {
  const known: Person[] = tx.select().from(people).all();
  const personIdMap = new Map<number, number>();

  for (const record of snapshot.people) {
    if (!record?.name?.trim()) continue;
    const values = toPersonValues(record);
    // A file's people are already distinct records, so only the strong keys
    // may fold one into someone who exists — two same-name people stay two.
    const existing =
      (values.contactId ? known.find((p) => p.contactId === values.contactId) : undefined) ??
      (values.phoneKey ? known.find((p) => p.phoneKey === values.phoneKey) : undefined);
    const person =
      existing ??
      tx
        .insert(people)
        .values({ ...values, createdAt: record.createdAt || nowIso() })
        .returning()
        .get();
    if (!existing) known.push(person);
    personIdMap.set(record.id, person.id);
  }

  const debtIdMap = new Map<number, number>();
  let inserted = 0;

  for (const row of snapshot.debts) {
    const mappedPersonId = row.personId != null ? personIdMap.get(row.personId) : undefined;
    let person = mappedPersonId != null ? known.find((p) => p.id === mappedPersonId) : undefined;

    if (!person) {
      // Old-shape row: the person is inline — resolve it like a typed name (FEATURE_SPEC 1.3).
      const name = row.name?.trim();
      if (!name) continue;
      const match = resolvePerson({ name, phone: row.phone, contactId: row.contactId }, known);
      if (match.kind === 'existing') {
        person = match.person;
      } else {
        person = tx
          .insert(people)
          .values({
            ...toPersonValues({
              name,
              phone: row.phone,
              email: row.email,
              company: row.company,
              avatar: row.avatar,
              contactId: row.contactId,
            }),
            createdAt: nowIso(),
          })
          .returning()
          .get();
        known.push(person);
      }
    }

    const created = tx
      .insert(debts)
      .values({
        personId: person.id,
        name: person.name,
        amount: Number(row.amount) || 0,
        monthlyPayment: Number(row.monthlyPayment) || 0,
        type: row.type === 'positive' ? 'positive' : 'negative',
        date: row.date || todayStr(),
        notes: row.notes ?? null,
        startDate: row.startDate ?? null,
        endDate: row.endDate ?? null,
        currency: row.currency ?? null,
        deletedAt: row.deletedAt ?? null,
      })
      .returning({ id: debts.id })
      .get();
    if (typeof row.id === 'number') debtIdMap.set(row.id, created.id);
    inserted += 1;
  }

  const adjustmentIdMap = new Map<number, number>();
  for (const row of snapshot.debtAdjustments) {
    const debtId = debtIdMap.get(row.debtId);
    if (debtId == null) continue;
    const created = tx
      .insert(debtAdjustments)
      .values({
        debtId,
        amount: Number(row.amount) || 0,
        date: row.date || todayStr(),
        note: row.note ?? null,
        createdAt: row.createdAt || nowIso(),
        // Files exported before 2.1.0 have neither.
        enteredAmount: typeof row.enteredAmount === 'number' ? row.enteredAmount : null,
        enteredCurrency: row.enteredCurrency ?? null,
      })
      .returning({ id: debtAdjustments.id })
      .get();
    adjustmentIdMap.set(row.id, created.id);
  }

  for (const row of snapshot.debtAttachments) {
    const debtId = debtIdMap.get(row.debtId);
    // Exports never carry files — only records whose file is still on this device survive.
    if (debtId == null) continue;
    const fileName = fileNameFor(row.fileName);
    if (!fileName) continue;
    tx.insert(debtAttachments)
      .values({
        debtId,
        adjustmentId:
          row.adjustmentId != null ? (adjustmentIdMap.get(row.adjustmentId) ?? null) : null,
        fileName,
        mimeType: row.mimeType,
        originalName: row.originalName ?? null,
        sizeBytes: row.sizeBytes ?? 0,
        createdAt: row.createdAt || nowIso(),
      })
      .run();
  }

  return inserted;
}

export interface ImportPreview {
  expenses: number;
  debts: number;
  incomes: number;
  balances: number;
}

/** What an import would add — shown in its confirmation before anything is written. */
export function previewImport(snapshot: BackupSnapshot): ImportPreview {
  const namedPeople = new Set(snapshot.people.filter((p) => p?.name?.trim()).map((p) => p.id));
  const debtCount = snapshot.debts.filter(
    (row) => (row.personId != null && namedPeople.has(row.personId)) || !!row.name?.trim(),
  ).length;
  return {
    expenses: snapshot.expenses.length,
    debts: debtCount,
    incomes: snapshot.incomes.length,
    balances: importableBalances(snapshot.profile).length,
  };
}

/**
 * The profile half of an import, which adds instead of replacing (FEATURE_SPEC 3.4): the
 * file's balances are appended, and its name and photo only fill in a profile that has none —
 * the photo only when it can be shown on this device. Null when there is nothing to change.
 */
export function profilePatchForImport(
  current: Profile,
  incoming: Partial<Profile>,
): Partial<Profile> | null {
  const patch: Partial<Profile> = {};
  const balances = importableBalances(incoming);
  if (balances.length) {
    patch.startBalances = [...(current.startBalances ?? []), ...balances];
    patch.lastReconciledDate = new Date().toISOString();
  }
  const name = typeof incoming.name === 'string' ? incoming.name.trim() : '';
  if (!current.name?.trim() && name) patch.name = name;
  if (
    !current.avatar &&
    typeof incoming.avatar === 'string' &&
    isAvatarAvailable(incoming.avatar)
  ) {
    patch.avatar = incoming.avatar;
  }
  return Object.keys(patch).length ? patch : null;
}

export interface ImportCounts {
  expenses: number;
  debts: number;
  incomes: number;
}

/** Import = append, in one transaction. People resolve to existing ones where identity says so (FEATURE_SPEC Part 6). */
export async function appendSnapshot(snapshot: BackupSnapshot): Promise<ImportCounts> {
  const newExpenses = toNewExpenses(snapshot.expenses);
  const newIncomes = toNewIncomes(snapshot.incomes);

  // Importing may land on a device still holding the original files, so each
  // attachment gets its own copy rather than sharing one. File copies are async
  // and a SQLite transaction can't await, so they're made up front; copies left
  // unused if the transaction fails are swept at next launch.
  const copies = new Map<string, string>();
  for (const row of snapshot.debtAttachments) {
    if (copies.has(row.fileName)) continue;
    const copy = await duplicateAttachmentFile(row.fileName);
    if (copy) copies.set(row.fileName, copy);
  }

  const debtCount = db.transaction((tx) => {
    if (newExpenses.length) tx.insert(expenses).values(newExpenses).run();
    if (newIncomes.length) tx.insert(incomeSources).values(newIncomes).run();
    return insertDebtGraph(tx, snapshot, (fileName) => copies.get(fileName) ?? null);
  });

  return { expenses: newExpenses.length, debts: debtCount, incomes: newIncomes.length };
}
