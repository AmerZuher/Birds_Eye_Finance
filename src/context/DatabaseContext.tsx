import React, { useEffect, useState } from 'react';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { backfillPeople, reconcileAttachmentFiles } from '@/db/maintenance';

/**
 * Runs migrations, then the post-migration maintenance steps, before anything
 * that reads the database mounts. Live queries started against a
 * not-yet-migrated schema fail once and only re-run on a later write, so
 * gating here is what guarantees the first render sees the real tables and
 * columns. The splash screen stays up meanwhile (it's only hidden once
 * RootLayoutInner mounts, below this provider), so there's nothing to flash.
 *
 * A failure still renders the app rather than bricking it on a blank screen.
 */
export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    migrate(db, migrations)
      .then(() => {
        try {
          backfillPeople();
        } catch (error) {
          console.warn('[database] people backfill failed', error);
        }
        try {
          reconcileAttachmentFiles();
        } catch (error) {
          console.warn('[database] attachment reconcile failed', error);
        }
      })
      .catch((error: unknown) => {
        console.warn('[database] migrations failed', error);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
