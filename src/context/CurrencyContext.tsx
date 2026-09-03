import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { CURRENCIES, DEFAULT_CURRENCY_CODE, getCurrency } from '@/constants/currencies';
import { storage, StorageKeys } from '@/lib/mmkv';
import { useLanguage } from '@/context/LanguageContext';

export function readInitialBaseCurrency(): string {
  const stored = storage.getString(StorageKeys.baseCurrency);
  return stored && CURRENCIES.some((c) => c.code === stored) ? stored : DEFAULT_CURRENCY_CODE;
}

const CODE_LIKE = /^[A-Za-z]+$/;

interface CurrencyContextValue {
  baseCurrency: string;
  setBaseCurrency: (code: string) => void;
  currencies: typeof CURRENCIES;
  convertToBase: (amount: number, fromCurrency: string) => number;
  formatMoney: (amount: number, currencyCode?: string) => string;
  formatOriginalMoney: (amount: number, currencyCode: string) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  const [baseCurrency, setBaseCurrencyState] = useState<string>(readInitialBaseCurrency);

  const setBaseCurrency = useCallback((code: string) => {
    storage.set(StorageKeys.baseCurrency, code);
    setBaseCurrencyState(code);
  }, []);

  const convertToBase = useCallback(
    (amount: number, fromCurrency: string) => {
      const from = getCurrency(fromCurrency);
      const base = getCurrency(baseCurrency);
      return (amount * from.rate) / base.rate;
    },
    [baseCurrency],
  );

  const formatMoneyIn = useCallback(
    (amount: number, currencyCode: string) => {
      const currency = getCurrency(currencyCode);
      const isAr = language === 'ar';
      const abs = Math.abs(amount);
      const numberFormatter = new Intl.NumberFormat(isAr ? 'ar-SA-u-nu-arab' : 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const formatted = numberFormatter.format(abs);
      const symbol = isAr ? currency.symbolAr : currency.symbolEn;
      const isNegative = amount < 0;

      if (isAr) {
        const signedNumber = isNegative ? `${formatted}-` : formatted;
        return `${signedNumber} ${symbol}`;
      }

      const spaced = CODE_LIKE.test(symbol) ? `${symbol} ${formatted}` : `${symbol}${formatted}`;
      return isNegative ? `-${spaced}` : spaced;
    },
    [language],
  );

  const formatMoney = useCallback(
    (amount: number, currencyCode?: string) => formatMoneyIn(amount, currencyCode ?? baseCurrency),
    [formatMoneyIn, baseCurrency],
  );

  const formatOriginalMoney = useCallback(
    (amount: number, currencyCode: string) => formatMoneyIn(amount, currencyCode),
    [formatMoneyIn],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      baseCurrency,
      setBaseCurrency,
      currencies: CURRENCIES,
      convertToBase,
      formatMoney,
      formatOriginalMoney,
    }),
    [baseCurrency, setBaseCurrency, convertToBase, formatMoney, formatOriginalMoney],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  return ctx;
}
