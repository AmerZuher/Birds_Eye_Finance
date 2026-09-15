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
import type { Profile } from '@/constants/initialData';
import { attachmentFileExists, duplicateAttachmentFile } from '@/lib/attachments';
import { nowIso, todayStr } from '@/lib/dates';
import { resolvePerson, toPersonValues } from '@/lib/people';
import { getJSON, setJSON, StorageKeys } from '@/lib/mmkv';

/**
 * A debt as it can appear in a snapshot. Current backups carry `personId`;
 * older backups and AI-prompt imports carry the person inline instead
 * (`name`/`phone`/`email`/`company`/`contactId`) and no `personId`.
 */
export type SnapshotDebt = Partial<Debt>;

export interface BackupSnapshot {
  expenses: Expense[];
  people: Person[];
  debts: SnapshotDebt[];
  debtAdjustments: DebtAdjustment[];
  /** Attachment records only — files are never part of a backup. */
  debtAttachments: DebtAttachment[];
  incomes: IncomeSource[];
  profile: Partial<Profile>;
  currency: string;
  theme: string;
  exportedAt: string;
}

export type BackupFrequency = 'off' | 'daily' | 'weekly' | 'monthly';

export const BACKUP_FREQUENCIES: BackupFrequency[] = ['off', 'daily', 'weekly', 'monthly'];

export interface AutoBackupMeta {
  frequency: BackupFrequency;
  lastBackup?: string;
}

const FREQUENCY_MS: Record<Exclude<BackupFrequency, 'off'>, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

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
 * Tolerant parser: accepts a full backup file (either shape), or a partial
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

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Inserts a snapshot's people, debts, adjustments and attachment records,
 * remapping every id (autoincrement assigns new ones) — DEBTS_V2_PLAN §7.
 * Returns how many debts were inserted.
 */
function insertDebtGraph(
  tx: Transaction,
  snapshot: BackupSnapshot,
  /** The file name a restored attachment record should use, or null to drop the record. */
  fileNameFor: (fileName: string) => string | null,
): number {
  const known: Person[] = tx.select().from(people).all();
  const personIdMap = new Map<number, number>();

  for (const record of snapshot.people) {
    if (!record?.name?.trim()) continue;
    const values = toPersonValues(record);
    // A backup's people are already distinct records, so only the strong keys
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
      })
      .returning({ id: debtAdjustments.id })
      .get();
    adjustmentIdMap.set(row.id, created.id);
  }

  for (const row of snapshot.debtAttachments) {
    const debtId = debtIdMap.get(row.debtId);
    // Backups never carry files — only records whose file is still on this device survive.
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

export interface ImportCounts {
  expenses: number;
  debts: number;
  incomes: number;
}

/** Import = append, in one transaction. People resolve to existing ones where identity says so (FEATURE_SPEC Part 6). */
export async function appendSnapshot(snapshot: BackupSnapshot): Promise<ImportCounts> {
  const newExpenses = toNewExpenses(snapshot.expenses);
  const newIncomes = toNewIncomes(snapshot.incomes);

  // Appending may land on a device still holding the original files, so each
  // restored attachment gets its own copy rather than sharing one. File copies
  // are async and a SQLite transaction can't await, so they're made up front;
  // copies left unused if the transaction fails are swept at next launch.
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

/**
 * Restore = replace, in one transaction. Attachment files of the replaced
 * records are left for the launch reconcile to delete once nothing refers to them.
 */
export async function replaceWithSnapshot(snapshot: BackupSnapshot): Promise<void> {
  const newExpenses = toNewExpenses(snapshot.expenses);
  const newIncomes = toNewIncomes(snapshot.incomes);

  db.transaction((tx) => {
    tx.delete(debtAttachments).run();
    tx.delete(debtAdjustments).run();
    tx.delete(debts).run();
    tx.delete(people).run();
    tx.delete(expenses).run();
    tx.delete(incomeSources).run();

    if (newExpenses.length) tx.insert(expenses).values(newExpenses).run();
    if (newIncomes.length) tx.insert(incomeSources).values(newIncomes).run();
    insertDebtGraph(tx, snapshot, (fileName) => (attachmentFileExists(fileName) ? fileName : null));
  });
}

export function readAutoBackupMeta(): AutoBackupMeta {
  return getJSON<AutoBackupMeta>(StorageKeys.autoBackupMeta) ?? { frequency: 'off' };
}

export function writeAutoBackupMeta(meta: AutoBackupMeta): void {
  setJSON(StorageKeys.autoBackupMeta, meta);
}

export function readAutoBackupSnapshot(): BackupSnapshot | undefined {
  const stored = getJSON<Partial<BackupSnapshot>>(StorageKeys.autoBackupSnapshot);
  // Snapshots written before Phase 6 lack the people/ledger arrays.
  return stored ? parseSnapshot(JSON.stringify(stored)) : undefined;
}

export function writeAutoBackupSnapshot(snapshot: BackupSnapshot): void {
  setJSON(StorageKeys.autoBackupSnapshot, snapshot);
}

export function isBackupDue(meta: AutoBackupMeta): boolean {
  if (meta.frequency === 'off') return false;
  if (!meta.lastBackup) return true;
  const elapsed = Date.now() - new Date(meta.lastBackup).getTime();
  return elapsed >= FREQUENCY_MS[meta.frequency];
}

/** Humanizes an ISO timestamp relative to now, via the caller's translation function. */
export function humanizeLastBackup(
  iso: string | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (!iso) return t('data.lastBackup.never');
  const elapsedMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(elapsedMs / 60000);
  if (minutes < 1) return t('data.lastBackup.justNow');
  if (minutes < 60) return t('data.lastBackup.minutesAgo', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('data.lastBackup.hoursAgo', { n: hours });
  const days = Math.floor(hours / 24);
  return t('data.lastBackup.daysAgo', { n: days });
}
