import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

import * as schema from '@/db/schema';

export const sqliteDb = openDatabaseSync('birdseye.db', { enableChangeListener: true });
export const db = drizzle(sqliteDb, { schema });
