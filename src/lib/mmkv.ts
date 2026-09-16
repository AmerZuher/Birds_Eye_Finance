import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({ id: 'birdseye-finance' });

export const StorageKeys = {
  themeId: 'settings.themeId',
  language: 'settings.language',
  baseCurrency: 'settings.baseCurrency',
  profile: 'settings.profile',
  activeTab: 'nav.activeTab',
  previousTab: 'nav.previousTab',
  settingsScreen: 'nav.settingsScreen',
  currencyUsage: 'settings.currencyUsage',
  /** Last downloaded exchange rates, plus the Settings toggle and the last attempt (src/lib/exchangeRates.ts). */
  ratesCache: 'rates.cache',
  ratesOnline: 'rates.online',
  ratesLastAttempt: 'rates.lastAttempt',
  /** Who a photo is being picked for while the picker is open (src/lib/avatars.ts). */
  pendingPhotoPick: 'avatars.pendingPick',
  /** Installment reminders: the Settings switch, the lead time, and the last tapped reminder (FEATURE_SPEC 1.13). */
  remindersEnabled: 'reminders.enabled',
  remindersLead: 'reminders.lead',
  remindersLastHandled: 'reminders.lastHandled',
  /** App updates: the automatic-check setting and the last check's time and result (FEATURE_SPEC 3.6). */
  updatesAuto: 'updates.auto',
  updatesLastCheck: 'updates.lastCheck',
} as const;

/**
 * Keys earlier versions wrote that nothing reads any more: the local auto-backup's meta and
 * snapshot (the snapshot could be large) and the font-size setting — all removed in 2.1.0.
 */
const RETIRED_KEYS = ['backup.meta', 'backup.snapshot', 'settings.fontScale'];

/** Deletes retired keys. Idempotent and cheap, so it simply runs on every launch. */
export function removeRetiredKeys(): void {
  for (const key of RETIRED_KEYS) storage.remove(key);
}

export function getString(key: string): string | undefined {
  return storage.getString(key);
}

export function getJSON<T>(key: string): T | undefined {
  const raw = storage.getString(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function setJSON(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}
