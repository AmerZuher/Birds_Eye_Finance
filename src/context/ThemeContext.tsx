import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

import {
  DEFAULT_THEME_ID,
  THEMES,
  getTheme,
  type ThemeId,
  type ThemeShape,
} from '@/constants/theme';
import {
  DEFAULT_FONT_SCALE,
  FONT_SCALE_MULTIPLIERS,
  type FontScaleId,
} from '@/constants/fontScale';
import { storage, StorageKeys } from '@/lib/mmkv';

export function readInitialThemeId(): ThemeId {
  const stored = storage.getString(StorageKeys.themeId);
  return stored && stored in THEMES ? (stored as ThemeId) : DEFAULT_THEME_ID;
}

function readInitialFontScale(): FontScaleId {
  const stored = storage.getString(StorageKeys.fontScale);
  return stored && stored in FONT_SCALE_MULTIPLIERS ? (stored as FontScaleId) : DEFAULT_FONT_SCALE;
}

interface ThemeContextValue {
  themeId: ThemeId;
  theme: ThemeShape;
  setThemeId: (id: ThemeId) => void;
  fontScale: FontScaleId;
  fontScaleMultiplier: number;
  setFontScale: (scale: FontScaleId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(readInitialThemeId);
  const [fontScale, setFontScaleState] = useState<FontScaleId>(readInitialFontScale);

  const setThemeId = useCallback((id: ThemeId) => {
    storage.set(StorageKeys.themeId, id);
    setThemeIdState(id);
  }, []);

  const setFontScale = useCallback((scale: FontScaleId) => {
    storage.set(StorageKeys.fontScale, scale);
    setFontScaleState(scale);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      theme: getTheme(themeId),
      setThemeId,
      fontScale,
      fontScaleMultiplier: FONT_SCALE_MULTIPLIERS[fontScale],
      setFontScale,
    }),
    [themeId, fontScale, setThemeId, setFontScale],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
