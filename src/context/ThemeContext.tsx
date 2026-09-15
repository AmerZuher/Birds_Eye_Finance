import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

import {
  DEFAULT_THEME_ID,
  THEMES,
  getTheme,
  type ThemeId,
  type ThemeShape,
} from '@/constants/theme';
import { storage, StorageKeys } from '@/lib/mmkv';

export function readInitialThemeId(): ThemeId {
  const stored = storage.getString(StorageKeys.themeId);
  return stored && stored in THEMES ? (stored as ThemeId) : DEFAULT_THEME_ID;
}

interface ThemeContextValue {
  themeId: ThemeId;
  theme: ThemeShape;
  setThemeId: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(readInitialThemeId);

  const setThemeId = useCallback((id: ThemeId) => {
    storage.set(StorageKeys.themeId, id);
    setThemeIdState(id);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      theme: getTheme(themeId),
      setThemeId,
    }),
    [themeId, setThemeId],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
