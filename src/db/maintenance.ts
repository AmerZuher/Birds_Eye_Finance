import { desc, inArray, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { debtAttachments, debts, people } from '@/db/schema';
import type { Debt, Person } from '@/db/schema';
import { clearStagedFiles, sweepAttachmentFiles } from '@/lib/attachments';
import { nowIso } from '@/lib/dates';
import { toPersonValues } from '@/lib/people';

/**
 * One-time move of pre-people data onto `people` (DEBTS_V2_PLAN §3.7). Guarded
 * by its own precondition — any debt with no person — so it's idempotent and
 * needs no "already ran" flag. Groups exactly the way the old engine did
 * (trimmed name, newest-first contact metadata) so every person group looks
 * the same after the migration as before it. The one intended exception: two
 * name groups sharing a phone or device contact become one person, because
 * those are the strong identity keys.
 */
export function backfillPeople(): void {
  const pending = db
    .select({ id: debts.id })
    .from(debts)
    .where(isNull(debts.personId))
    .limit(1)
    .all();
  if (pending.length === 0) return;

  db.transaction((tx) => {
    const known: Person[] = tx.select().from(people).all();
    const rows = tx
      .select()
      .from(debts)
      .where(isNull(debts.personId))
      .orderBy(desc(debts.id))
      .all();

    const groups = new Map<string, Debt[]>();
    for (const row of rows) {
      const key = row.name.trim();
      const group = groups.get(key);
      if (group) group.push(row);
      else groups.set(key, [row]);
    }

    const firstNonEmpty = (
      list: Debt[],
      field: 'phone' | 'email' | 'company' | 'avatar' | 'contactId',
    ) => list.find((row) => row[field]?.trim())?.[field] ?? null;

    for (const [name, list] of groups) {
      const values = toPersonValues({
        name,
        phone: firstNonEmpty(list, 'phone'),
        email: firstNonEmpty(list, 'email'),
        company: firstNonEmpty(list, 'company'),
        avatar: firstNonEmpty(list, 'avatar'),
        contactId: firstNonEmpty(list, 'contactId'),
      });

      let person =
        (values.contactId ? known.find((p) => p.contactId === values.contactId) : undefined) ??
        (values.phoneKey ? known.find((p) => p.phoneKey === values.phoneKey) : undefined);

      if (!person) {
        person = tx
          .insert(people)
          .values({ ...values, createdAt: nowIso() })
          .returning()
          .get();
        known.push(person);
      }

      tx.update(debts)
        .set({ personId: person.id })
        .where(
          inArray(
            debts.id,
            list.map((row) => row.id),
          ),
        )
        .run();
    }
  });
}

/**
 * Launch reconcile for attachments (DEBTS_V2_PLAN §5.2): clears abandoned
 * staged files, deletes stored files no row points at, and drops rows whose
 * file is gone (e.g. restored from a backup, which never carries files).
 */
export function reconcileAttachmentFiles(): void {
  clearStagedFiles();
  const rows = db
    .select({ id: debtAttachments.id, fileName: debtAttachments.fileName })
    .from(debtAttachments)
    .all();
  const missing = new Set(sweepAttachmentFiles(new Set(rows.map((row) => row.fileName))));
  const missingIds = rows.filter((row) => missing.has(row.fileName)).map((row) => row.id);
  if (missingIds.length > 0) {
    db.delete(debtAttachments).where(inArray(debtAttachments.id, missingIds)).run();
  }
}
