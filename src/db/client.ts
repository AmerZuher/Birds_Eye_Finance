import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

import * as schema from '@/db/schema';

export const sqliteDb = openDatabaseSync('birdseye.db', { enableChangeListener: true });
// SQLite leaves foreign keys off per connection — without this, every
// `onDelete: 'cascade'` / `'set null'` in schema.ts silently does nothing.
sqliteDb.execSync('PRAGMA foreign_keys = ON;');
export const db = drizzle(sqliteDb, { schema });
