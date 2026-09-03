import { createMMKV } from 'react-native-mmkv';

export const storage = createMMKV({ id: 'birdseye-finance' });

export const StorageKeys = {
  themeId: 'settings.themeId',
  fontScale: 'settings.fontScale',
  language: 'settings.language',
  baseCurrency: 'settings.baseCurrency',
  profile: 'settings.profile',
  activeTab: 'nav.activeTab',
  previousTab: 'nav.previousTab',
  settingsScreen: 'nav.settingsScreen',
  autoBackupMeta: 'backup.meta',
  autoBackupSnapshot: 'backup.snapshot',
} as const;

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
