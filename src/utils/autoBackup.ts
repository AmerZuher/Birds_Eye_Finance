import { db } from '@/db/client';
import { debts, expenses, incomeSources } from '@/db/schema';
import type {
  Debt,
  Expense,
  IncomeSource,
  NewDebt,
  NewExpense,
  NewIncomeSource,
} from '@/db/schema';
import type { Profile } from '@/constants/initialData';
import { getJSON, setJSON, StorageKeys } from '@/lib/mmkv';

export interface BackupSnapshot {
  expenses: Expense[];
  debts: Debt[];
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
  const [expenseRows, debtRows, incomeRows] = await Promise.all([
    db.select().from(expenses),
    db.select().from(debts),
    db.select().from(incomeSources),
  ]);

  return {
    expenses: expenseRows,
    debts: debtRows,
    incomes: incomeRows,
    profile,
    currency,
    theme,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Tolerant parser: accepts a full backup file, or a partial object with just
 * `{ debts: [...] }` / `{ expenses: [...] }` — the shape the AI-prompt
 * workflow (FEATURE_SPEC 3.4) produces when pasted into the import box.
 */
export function parseSnapshot(raw: string): BackupSnapshot {
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object') {
    throw new Error('Not a valid backup: expected a JSON object.');
  }
  const obj = data as Record<string, unknown>;

  return {
    expenses: Array.isArray(obj.expenses) ? (obj.expenses as Expense[]) : [],
    debts: Array.isArray(obj.debts) ? (obj.debts as Debt[]) : [],
    incomes: Array.isArray(obj.incomes) ? (obj.incomes as IncomeSource[]) : [],
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

function toNewDebts(items: Debt[]): NewDebt[] {
  return items.map(({ id: _id, ...rest }) => ({
    ...rest,
    type: rest.type === 'positive' ? 'positive' : 'negative',
    date: rest.date || new Date().toISOString().slice(0, 10),
  }));
}

function toNewIncomes(items: IncomeSource[]): NewIncomeSource[] {
  return items.map(({ id: _id, ...rest }) => rest);
}

export interface ImportCounts {
  expenses: number;
  debts: number;
  incomes: number;
}

/** Import = append. Ids are stripped so SQLite assigns fresh ones (never collides with existing rows). */
export async function appendSnapshot(snapshot: BackupSnapshot): Promise<ImportCounts> {
  const newExpenses = toNewExpenses(snapshot.expenses);
  const newDebts = toNewDebts(snapshot.debts);
  const newIncomes = toNewIncomes(snapshot.incomes);

  if (newExpenses.length) await db.insert(expenses).values(newExpenses);
  if (newDebts.length) await db.insert(debts).values(newDebts);
  if (newIncomes.length) await db.insert(incomeSources).values(newIncomes);

  return { expenses: newExpenses.length, debts: newDebts.length, incomes: newIncomes.length };
}

/** Restore = replace. Clears all three tables, then inserts the snapshot's rows. */
export async function replaceWithSnapshot(snapshot: BackupSnapshot): Promise<void> {
  await db.delete(expenses);
  await db.delete(debts);
  await db.delete(incomeSources);

  const newExpenses = toNewExpenses(snapshot.expenses);
  const newDebts = toNewDebts(snapshot.debts);
  const newIncomes = toNewIncomes(snapshot.incomes);

  if (newExpenses.length) await db.insert(expenses).values(newExpenses);
  if (newDebts.length) await db.insert(debts).values(newDebts);
  if (newIncomes.length) await db.insert(incomeSources).values(newIncomes);
}

export function readAutoBackupMeta(): AutoBackupMeta {
  return getJSON<AutoBackupMeta>(StorageKeys.autoBackupMeta) ?? { frequency: 'off' };
}

export function writeAutoBackupMeta(meta: AutoBackupMeta): void {
  setJSON(StorageKeys.autoBackupMeta, meta);
}

export function readAutoBackupSnapshot(): BackupSnapshot | undefined {
  return getJSON<BackupSnapshot>(StorageKeys.autoBackupSnapshot);
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
