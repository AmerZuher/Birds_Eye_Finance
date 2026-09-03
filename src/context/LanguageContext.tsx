import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';

import { TRANSLATIONS, type Language } from '@/constants/translations';
import { storage, StorageKeys } from '@/lib/mmkv';

const DEFAULT_LANGUAGE: Language = 'en';

export function readInitialLanguage(): Language {
  const stored = storage.getString(StorageKeys.language);
  return stored === 'ar' || stored === 'en' ? stored : DEFAULT_LANGUAGE;
}

I18nManager.allowRTL(true);

interface LanguageContextValue {
  language: Language;
  dir: 'ltr' | 'rtl';
  isRTL: boolean;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    storage.set(StorageKeys.language, lang);
    const isRTL = lang === 'ar';
    I18nManager.swapLeftAndRightInRTL(isRTL);
    I18nManager.forceRTL(isRTL);
    setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = TRANSLATIONS[language] ?? TRANSLATIONS[DEFAULT_LANGUAGE];
      let str = dict[key] ?? TRANSLATIONS[DEFAULT_LANGUAGE][key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
        }
      }
      return str;
    },
    [language],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      dir: language === 'ar' ? 'rtl' : 'ltr',
      isRTL: language === 'ar',
      setLanguage,
      t,
    }),
    [language, setLanguage, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
