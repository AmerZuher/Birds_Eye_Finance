import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, max, ne, sum } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import { debtAdjustments, debtAttachments, debts, people } from '@/db/schema';
import type { Debt, DebtAdjustment, DebtAttachment, NewDebt, Person } from '@/db/schema';
import { useCurrency } from '@/context/CurrencyContext';
import { commitStagedFile, deleteAttachmentFile } from '@/lib/attachments';
import type { StagedFile } from '@/lib/attachments';
import { avatarDisplayUri } from '@/lib/avatars';
import { nowIso, todayStr } from '@/lib/dates';
import { MONEY_EPSILON, getDebtBalance } from '@/lib/debtStatus';
import type { DebtBalance } from '@/lib/debtStatus';
import type { PaymentRecord } from '@/lib/installments';
import { toPersonValues } from '@/lib/people';
import type { PersonFields } from '@/lib/people';

/**
 * Everything debt-shaped: people, debts, the adjustment ledger, attachments,
 * and every figure derived from them (FEATURE_SPEC Part 1). Split out of
 * FinanceContext (DEBTS_V2_PLAN §6) so expense edits don't re-render debt
 * screens and vice versa.
 *
 * SQLite is the only source of truth. Each table gets its own live query and
 * they're combined in useMemo — never a join inside a live query, because
 * drizzle's useLiveQuery only re-runs when the table in its `from()` changes.
 * Every multi-row write runs in one transaction.
 */

export type DebtGroupType = 'positive' | 'negative' | 'settled';
export type DebtFilter = 'all' | 'positive' | 'negative';

/** A non-deleted debt with its derived balance. */
export type DebtView = Debt & DebtBalance & { settledOn: string | null };

export interface DebtGroup {
  personId: number;
  person: Person;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  /** Display-ready URI (app-stored photos resolved). */
  avatar?: string;
  /** Active (not settled) debts only, newest first. */
  transactions: DebtView[];
  /** Net outstanding in base currency: owed to me − I owe. */
  totalNet: number;
  type: DebtGroupType;
}

export interface DebtsCalculations {
  totalPositiveAmount: number;
  totalNegativeAmount: number;
  totalNegativeMonthly: number;
}

/** The fields a debt form owns — identity comes from the person, not the debt. */
export type DebtInput = Pick<
  NewDebt,
  'amount' | 'monthlyPayment' | 'type' | 'date' | 'notes' | 'startDate' | 'endDate' | 'currency'
>;

export type DebtPersonTarget = { personId: number } | { newPerson: PersonFields };

export interface AdjustmentInput {
  debtId: number;
  /** Signed, in the debt's own currency. */
  amount: number;
  date: string;
  note?: string | null;
  /** The amount and currency as typed, when that wasn't the debt's currency (FEATURE_SPEC 1.10). */
  enteredAmount?: number | null;
  enteredCurrency?: string | null;
}

/** Another person already owns this phone number or device contact. */
export class PersonConflictError extends Error {
  readonly conflict: Person;

  constructor(conflict: Person) {
    super('Another person already has this phone number or contact.');
    this.name = 'PersonConflictError';
    this.conflict = conflict;
  }
}

interface DebtsContextValue {
  people: Person[];
  peopleById: Map<number, Person>;
  /** Every non-deleted debt, newest first, with derived balances. */
  debtViews: DebtView[];
  debtViewById: Map<number, DebtView>;
  /** Settled debts, most recently settled first (History › Settled). */
  settledDebts: DebtView[];
  /** Soft-deleted debts, most recently deleted first (History › Deleted). */
  deletedDebts: Debt[];
  groupedDebts: DebtGroup[];
  settledCountByPerson: Map<number, number>;
  debtFilter: DebtFilter;
  setDebtFilter: (filter: DebtFilter) => void;
  debtsCalculations: DebtsCalculations;
  /** Every recorded payment (− adjustment) — the installment calendar's "already paid" check (src/lib/installments.ts). */
  payments: PaymentRecord[];
  /** Returns the new debt's id. */
  addDebt: (input: DebtInput, target: DebtPersonTarget) => number;
  updateDebt: (id: number, patch: Partial<DebtInput>) => void;
  moveDebt: (id: number, personId: number) => void;
  /** Soft delete — moves the debt to History › Deleted. */
  deleteDebt: (id: number) => void;
  /** Hard delete (History › Deleted only) — also removes adjustments and attachment files. */
  permanentlyDeleteDebt: (id: number) => void;
  /** Throws PersonConflictError when the new phone/contact belongs to someone else. */
  updatePerson: (id: number, fields: PersonFields) => void;
  /** Moves every debt of `sourceId` to `targetId`, fills the target's empty details, removes the source. */
  mergePeople: (sourceId: number, targetId: number) => void;
  /** Returns the new adjustment's id. */
  addAdjustment: (input: AdjustmentInput) => number;
  updateAdjustment: (id: number, patch: Omit<AdjustmentInput, 'debtId'>) => void;
  deleteAdjustment: (id: number) => void;
  /** Closes every active debt of a net-zero person with one adjustment each (FEATURE_SPEC 1.9). */
  settleAll: (personId: number, note: string) => void;
  /** Resolves once every file has landed in storage and its row exists. */
  addAttachments: (
    debtId: number,
    staged: StagedFile[],
    adjustmentId?: number | null,
  ) => Promise<void>;
  deleteAttachment: (attachment: DebtAttachment) => void;
}

const DebtsContext = createContext<DebtsContextValue | null>(null);

export function DebtsProvider({ children }: { children: React.ReactNode }) {
  const { convertToBase } = useCurrency();

  const { data: peopleRows } = useLiveQuery(db.select().from(people).orderBy(asc(people.nameKey)));
  // Newest-first — "create mode prepends" (FEATURE_SPEC 1.7) falls out of this ordering.
  const { data: debtRows } = useLiveQuery(
    db.select().from(debts).where(isNull(debts.deletedAt)).orderBy(desc(debts.id)),
  );
  const { data: deletedDebtRows } = useLiveQuery(
    db.select().from(debts).where(isNotNull(debts.deletedAt)).orderBy(desc(debts.deletedAt)),
  );
  const { data: adjustmentTotalRows } = useLiveQuery(
    db
      .select({
        debtId: debtAdjustments.debtId,
        total: sum(debtAdjustments.amount),
        lastDate: max(debtAdjustments.date),
      })
      .from(debtAdjustments)
      .groupBy(debtAdjustments.debtId),
  );

  const { data: paymentRows } = useLiveQuery(
    db
      .select({
        debtId: debtAdjustments.debtId,
        amount: debtAdjustments.amount,
        date: debtAdjustments.date,
      })
      .from(debtAdjustments)
      .where(lt(debtAdjustments.amount, 0)),
  );

  const peopleSafe = useMemo(() => peopleRows ?? [], [peopleRows]);
  const payments = useMemo<PaymentRecord[]>(() => paymentRows ?? [], [paymentRows]);
  const peopleById = useMemo(() => new Map(peopleSafe.map((p) => [p.id, p])), [peopleSafe]);

  const adjustmentTotals = useMemo(() => {
    const map = new Map<number, { total: number; lastDate: string | null }>();
    for (const row of adjustmentTotalRows ?? []) {
      map.set(row.debtId, { total: Number(row.total ?? 0), lastDate: row.lastDate ?? null });
    }
    return map;
  }, [adjustmentTotalRows]);

  const debtViews = useMemo<DebtView[]>(
    () =>
      (debtRows ?? []).map((debt) => {
        const totals = adjustmentTotals.get(debt.id);
        const balance = getDebtBalance(debt.amount, totals?.total ?? 0);
        return {
          ...debt,
          ...balance,
          settledOn: balance.status === 'settled' ? (totals?.lastDate ?? debt.date) : null,
        };
      }),
    [debtRows, adjustmentTotals],
  );

  const debtViewById = useMemo(() => new Map(debtViews.map((d) => [d.id, d])), [debtViews]);

  const settledDebts = useMemo(
    () =>
      debtViews
        .filter((d) => d.status === 'settled')
        .sort((a, b) => (b.settledOn ?? '').localeCompare(a.settledOn ?? '') || b.id - a.id),
    [debtViews],
  );

  const settledCountByPerson = useMemo(() => {
    const map = new Map<number, number>();
    for (const debt of settledDebts) {
      if (debt.personId == null) continue;
      map.set(debt.personId, (map.get(debt.personId) ?? 0) + 1);
    }
    return map;
  }, [settledDebts]);

  // Totals use what's still outstanding on active debts only — settled debts
  // (and their installment plans) no longer count (FEATURE_SPEC 1.10).
  const debtsCalculations = useMemo<DebtsCalculations>(() => {
    let totalPositiveAmount = 0;
    let totalNegativeAmount = 0;
    let totalNegativeMonthly = 0;
    for (const debt of debtViews) {
      if (debt.status === 'settled') continue;
      const currency = debt.currency ?? 'SAR';
      const base = convertToBase(debt.outstanding, currency);
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
  }, [debtViews, convertToBase]);

  // FEATURE_SPEC 1.3: grouped by personId — never by name text.
  const groupedDebtsAll = useMemo<DebtGroup[]>(() => {
    const groups = new Map<number, DebtGroup>();
    for (const debt of debtViews) {
      if (debt.status === 'settled' || debt.personId == null) continue;
      const person = peopleById.get(debt.personId);
      if (!person) continue;
      let group = groups.get(person.id);
      if (!group) {
        group = {
          personId: person.id,
          person,
          name: person.name,
          phone: person.phone ?? undefined,
          email: person.email ?? undefined,
          company: person.company ?? undefined,
          avatar: avatarDisplayUri(person.avatar),
          transactions: [],
          totalNet: 0,
          type: 'settled',
        };
        groups.set(person.id, group);
      }
      group.transactions.push(debt);
      const base = convertToBase(debt.outstanding, debt.currency ?? 'SAR');
      group.totalNet += debt.type === 'positive' ? base : -base;
    }
    return [...groups.values()]
      .map((group) => ({
        ...group,
        type: (group.totalNet > MONEY_EPSILON
          ? 'positive'
          : group.totalNet < -MONEY_EPSILON
            ? 'negative'
            : 'settled') as DebtGroupType,
      }))
      .sort((a, b) => Math.abs(b.totalNet) - Math.abs(a.totalNet));
  }, [debtViews, peopleById, convertToBase]);

  const [debtFilter, setDebtFilter] = useState<DebtFilter>('all');

  const groupedDebts = useMemo(() => {
    if (debtFilter === 'all') return groupedDebtsAll;
    return groupedDebtsAll.filter((group) => group.type === debtFilter);
  }, [groupedDebtsAll, debtFilter]);

  const addDebt = useCallback((input: DebtInput, target: DebtPersonTarget): number => {
    return db.transaction((tx) => {
      let person: Person | undefined;
      if ('personId' in target) {
        person = tx.select().from(people).where(eq(people.id, target.personId)).get();
        if (!person) throw new Error(`Person ${target.personId} not found`);
      } else {
        person = tx
          .insert(people)
          .values({ ...toPersonValues(target.newPerson), createdAt: nowIso() })
          .returning()
          .get();
      }
      const inserted = tx
        .insert(debts)
        .values({ ...input, personId: person.id, name: person.name })
        .returning({ id: debts.id })
        .get();
      return inserted.id;
    });
  }, []);

  const updateDebt = useCallback((id: number, patch: Partial<DebtInput>) => {
    db.update(debts).set(patch).where(eq(debts.id, id)).run();
  }, []);

  const moveDebt = useCallback((id: number, personId: number) => {
    db.transaction((tx) => {
      const person = tx.select().from(people).where(eq(people.id, personId)).get();
      if (!person) return;
      tx.update(debts)
        .set({ personId: person.id, name: person.name })
        .where(eq(debts.id, id))
        .run();
    });
  }, []);

  const deleteDebt = useCallback((id: number) => {
    db.update(debts).set({ deletedAt: nowIso() }).where(eq(debts.id, id)).run();
  }, []);

  const permanentlyDeleteDebt = useCallback((id: number) => {
    const files = db
      .select({ fileName: debtAttachments.fileName })
      .from(debtAttachments)
      .where(eq(debtAttachments.debtId, id))
      .all();
    // Adjustments and attachment rows go with it (ON DELETE CASCADE); files don't.
    db.delete(debts).where(eq(debts.id, id)).run();
    for (const file of files) deleteAttachmentFile(file.fileName);
  }, []);

  const updatePerson = useCallback((id: number, fields: PersonFields) => {
    const values = toPersonValues(fields);
    const conflict =
      (values.phoneKey
        ? db
            .select()
            .from(people)
            .where(and(eq(people.phoneKey, values.phoneKey), ne(people.id, id)))
            .get()
        : undefined) ??
      (values.contactId
        ? db
            .select()
            .from(people)
            .where(and(eq(people.contactId, values.contactId), ne(people.id, id)))
            .get()
        : undefined);
    if (conflict) throw new PersonConflictError(conflict);

    db.transaction((tx) => {
      tx.update(people).set(values).where(eq(people.id, id)).run();
      // Keep the per-debt name snapshot in step with the person.
      tx.update(debts).set({ name: values.name }).where(eq(debts.personId, id)).run();
    });
  }, []);

  const mergePeople = useCallback((sourceId: number, targetId: number) => {
    if (sourceId === targetId) return;
    db.transaction((tx) => {
      const source = tx.select().from(people).where(eq(people.id, sourceId)).get();
      const target = tx.select().from(people).where(eq(people.id, targetId)).get();
      if (!source || !target) return;

      tx.update(debts)
        .set({ personId: target.id, name: target.name })
        .where(eq(debts.personId, source.id))
        .run();

      const patch: Partial<Person> = {};
      if (!target.email && source.email) patch.email = source.email;
      if (!target.company && source.company) patch.company = source.company;
      if (!target.avatar && source.avatar) patch.avatar = source.avatar;
      if (!target.phoneKey && source.phoneKey) {
        patch.phone = source.phone;
        patch.phoneKey = source.phoneKey;
      }
      if (!target.contactId && source.contactId) patch.contactId = source.contactId;

      // Source goes first so its phone/contact free up in the unique indexes.
      tx.delete(people).where(eq(people.id, source.id)).run();
      if (Object.keys(patch).length > 0) {
        tx.update(people).set(patch).where(eq(people.id, target.id)).run();
      }
    });
  }, []);

  const addAdjustment = useCallback((input: AdjustmentInput): number => {
    const inserted = db
      .insert(debtAdjustments)
      .values({
        debtId: input.debtId,
        amount: input.amount,
        date: input.date,
        note: input.note?.trim() || null,
        createdAt: nowIso(),
        enteredAmount: input.enteredAmount ?? null,
        enteredCurrency: input.enteredCurrency ?? null,
      })
      .returning({ id: debtAdjustments.id })
      .get();
    return inserted.id;
  }, []);

  const updateAdjustment = useCallback((id: number, patch: Omit<AdjustmentInput, 'debtId'>) => {
    db.update(debtAdjustments)
      .set({
        amount: patch.amount,
        date: patch.date,
        note: patch.note?.trim() || null,
        enteredAmount: patch.enteredAmount ?? null,
        enteredCurrency: patch.enteredCurrency ?? null,
      })
      .where(eq(debtAdjustments.id, id))
      .run();
  }, []);

  const deleteAdjustment = useCallback((id: number) => {
    // Linked attachments stay on the debt (adjustment_id ON DELETE SET NULL).
    db.delete(debtAdjustments).where(eq(debtAdjustments.id, id)).run();
  }, []);

  const settleAll = useCallback((personId: number, note: string) => {
    db.transaction((tx) => {
      const rows = tx
        .select()
        .from(debts)
        .where(and(eq(debts.personId, personId), isNull(debts.deletedAt)))
        .all();
      if (rows.length === 0) return;
      const totals = new Map(
        tx
          .select({ debtId: debtAdjustments.debtId, total: sum(debtAdjustments.amount) })
          .from(debtAdjustments)
          .where(
            inArray(
              debtAdjustments.debtId,
              rows.map((row) => row.id),
            ),
          )
          .groupBy(debtAdjustments.debtId)
          .all()
          .map((row) => [row.debtId, Number(row.total ?? 0)]),
      );
      const date = todayStr();
      for (const row of rows) {
        const balance = getDebtBalance(row.amount, totals.get(row.id) ?? 0);
        if (balance.status === 'settled') continue;
        tx.insert(debtAdjustments)
          .values({ debtId: row.id, amount: -balance.outstanding, date, note, createdAt: nowIso() })
          .run();
      }
    });
  }, []);

  const addAttachments = useCallback(
    async (debtId: number, staged: StagedFile[], adjustmentId: number | null = null) => {
      for (const file of staged) {
        const fileName = await commitStagedFile(file);
        try {
          db.insert(debtAttachments)
            .values({
              debtId,
              adjustmentId,
              fileName,
              mimeType: file.mimeType,
              originalName: file.originalName,
              sizeBytes: file.sizeBytes,
              createdAt: nowIso(),
            })
            .run();
        } catch (error) {
          deleteAttachmentFile(fileName);
          throw error;
        }
      }
    },
    [],
  );

  const deleteAttachment = useCallback((attachment: DebtAttachment) => {
    db.delete(debtAttachments).where(eq(debtAttachments.id, attachment.id)).run();
    deleteAttachmentFile(attachment.fileName);
  }, []);

  const value = useMemo<DebtsContextValue>(
    () => ({
      people: peopleSafe,
      peopleById,
      debtViews,
      debtViewById,
      settledDebts,
      deletedDebts: deletedDebtRows ?? [],
      groupedDebts,
      settledCountByPerson,
      debtFilter,
      setDebtFilter,
      debtsCalculations,
      payments,
      addDebt,
      updateDebt,
      moveDebt,
      deleteDebt,
      permanentlyDeleteDebt,
      updatePerson,
      mergePeople,
      addAdjustment,
      updateAdjustment,
      deleteAdjustment,
      settleAll,
      addAttachments,
      deleteAttachment,
    }),
    [
      peopleSafe,
      peopleById,
      debtViews,
      debtViewById,
      settledDebts,
      deletedDebtRows,
      groupedDebts,
      settledCountByPerson,
      debtFilter,
      debtsCalculations,
      payments,
      addDebt,
      updateDebt,
      moveDebt,
      deleteDebt,
      permanentlyDeleteDebt,
      updatePerson,
      mergePeople,
      addAdjustment,
      updateAdjustment,
      deleteAdjustment,
      settleAll,
      addAttachments,
      deleteAttachment,
    ],
  );

  return <DebtsContext.Provider value={value}>{children}</DebtsContext.Provider>;
}

export function useDebts(): DebtsContextValue {
  const ctx = useContext(DebtsContext);
  if (!ctx) throw new Error('useDebts must be used within a DebtsProvider');
  return ctx;
}

/** One debt's ledger, newest first — mounted only while that debt's sheet is open. */
export function useDebtAdjustments(debtId: number | null): DebtAdjustment[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(debtAdjustments)
      .where(eq(debtAdjustments.debtId, debtId ?? -1))
      .orderBy(desc(debtAdjustments.date), desc(debtAdjustments.id)),
    [debtId],
  );
  return data ?? [];
}

/** One debt's attachments, newest first — mounted only while that debt's sheet is open. */
export function useDebtAttachments(debtId: number | null): DebtAttachment[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(debtAttachments)
      .where(eq(debtAttachments.debtId, debtId ?? -1))
      .orderBy(desc(debtAttachments.id)),
    [debtId],
  );
  return data ?? [];
}
