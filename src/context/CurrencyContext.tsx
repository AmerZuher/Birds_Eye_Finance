import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { CURRENCIES, DEFAULT_CURRENCY_CODE, getCurrency } from '@/constants/currencies';
import { getJSON, setJSON, storage, StorageKeys } from '@/lib/mmkv';
import { useLanguage } from '@/context/LanguageContext';

export function readInitialBaseCurrency(): string {
  const stored = storage.getString(StorageKeys.baseCurrency);
  return stored && CURRENCIES.some((c) => c.code === stored) ? stored : DEFAULT_CURRENCY_CODE;
}

function readInitialUsage(): Record<string, number> {
  return getJSON<Record<string, number>>(StorageKeys.currencyUsage) ?? {};
}

const CODE_LIKE = /^[A-Za-z]+$/;

// The official Riyal symbol (U+20C1, see currencies.ts) isn't in any
// shipped font yet, so it can't appear in a plain string — formatMoney/
// formatOriginalMoney return raw text embedded directly in a Text node,
// with no way to substitute the SVG glyph MoneyAmount draws instead. This
// is the one place that matters: every plain-string formatter call across
// the app (Settings, EditProfileScreen, Debts, Expenses, Analytics, and
// anywhere new) routes through formatMoneyIn below, so falling back to
// legible text here — instead of at each call site — covers all of them
// at once. formatMoneyPartsIn (MoneyAmount's path) is untouched and keeps
// returning the real symbol, since it can actually render it.
const PLAIN_TEXT_SYMBOL_FALLBACK: Record<string, { ar: string; en: string }> = {
  SAR: { ar: 'ر.س', en: 'SAR' },
};

export interface MoneyParts {
  /** Digits before the decimal separator (grouped, locale digits). */
  integer: string;
  /** Digits after the decimal separator, no leading separator. */
  decimal: string;
  symbol: string;
  isNegative: boolean;
  /** English shows "SAR 1,234"; Arabic shows "١٬٢٣٤ ر.س" — a caller laying the
   * symbol out as its own Text node needs to know which side it's on. */
  symbolFirst: boolean;
}

interface CurrencyContextValue {
  baseCurrency: string;
  setBaseCurrency: (code: string) => void;
  /** CURRENCIES re-sorted by how often each code has actually been picked
   * (most-picked first, ties keep CURRENCIES' own order) — every picker in
   * the app reads from this instead of the static table directly, so the
   * currencies someone actually uses surface at the top of the list instead
   * of staying buried behind an alphabetical/static ordering. */
  currencies: typeof CURRENCIES;
  /** Call when the user picks a currency anywhere (debt/expense/balance/
   * income/base-currency) — the only input `currencies`' ordering above is
   * derived from. */
  recordCurrencyUsage: (code: string) => void;
  convertToBase: (amount: number, fromCurrency: string) => number;
  formatMoney: (amount: number, currencyCode?: string) => string;
  formatOriginalMoney: (amount: number, currencyCode: string) => string;
  /** Same formatting as `formatMoney`, split into parts so a caller can give
   * the symbol/integer/decimal portions different type treatment. */
  formatMoneyParts: (amount: number, currencyCode?: string) => MoneyParts;
  /** A whole-number percentage, localized — Arabic uses Arabic-Indic digits,
   * English uses Latin digits. Callers append the "%" glyph themselves. */
  formatPercent: (value: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  const [baseCurrency, setBaseCurrencyState] = useState<string>(readInitialBaseCurrency);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>(readInitialUsage);

  const setBaseCurrency = useCallback((code: string) => {
    storage.set(StorageKeys.baseCurrency, code);
    setBaseCurrencyState(code);
  }, []);

  const recordCurrencyUsage = useCallback((code: string) => {
    setUsageCounts((prev) => {
      const next = { ...prev, [code]: (prev[code] ?? 0) + 1 };
      setJSON(StorageKeys.currencyUsage, next);
      return next;
    });
  }, []);

  // Stable sort (guaranteed since ES2019) — ties fall back to CURRENCIES'
  // own order, so a never-picked list still reads exactly as it always has.
  const sortedCurrencies = useMemo(
    () => [...CURRENCIES].sort((a, b) => (usageCounts[b.code] ?? 0) - (usageCounts[a.code] ?? 0)),
    [usageCounts],
  );

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
      const fallback = PLAIN_TEXT_SYMBOL_FALLBACK[currency.code];
      const symbol = fallback ? (isAr ? fallback.ar : fallback.en) : isAr ? currency.symbolAr : currency.symbolEn;
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

  const formatMoneyPartsIn = useCallback(
    (amount: number, currencyCode: string): MoneyParts => {
      const currency = getCurrency(currencyCode);
      const isAr = language === 'ar';
      const abs = Math.abs(amount);
      const numberFormatter = new Intl.NumberFormat(isAr ? 'ar-SA-u-nu-arab' : 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const parts = numberFormatter.formatToParts(abs);
      const integer = parts
        .filter((p) => p.type === 'integer' || p.type === 'group')
        .map((p) => p.value)
        .join('');
      const decimal = parts
        .filter((p) => p.type === 'fraction')
        .map((p) => p.value)
        .join('');
      return {
        integer,
        decimal,
        symbol: isAr ? currency.symbolAr : currency.symbolEn,
        isNegative: amount < 0,
        symbolFirst: !isAr,
      };
    },
    [language],
  );

  const formatMoneyParts = useCallback(
    (amount: number, currencyCode?: string) =>
      formatMoneyPartsIn(amount, currencyCode ?? baseCurrency),
    [formatMoneyPartsIn, baseCurrency],
  );

  const formatPercent = useCallback(
    (value: number) => {
      const isAr = language === 'ar';
      const rounded = Math.round(value);
      const numberFormatter = new Intl.NumberFormat(isAr ? 'ar-SA-u-nu-arab' : 'en-US', {
        maximumFractionDigits: 0,
      });
      return numberFormatter.format(rounded);
    },
    [language],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      baseCurrency,
      setBaseCurrency,
      currencies: sortedCurrencies,
      recordCurrencyUsage,
      convertToBase,
      formatMoney,
      formatOriginalMoney,
      formatMoneyParts,
      formatPercent,
    }),
    [
      baseCurrency,
      setBaseCurrency,
      sortedCurrencies,
      recordCurrencyUsage,
      convertToBase,
      formatMoney,
      formatOriginalMoney,
      formatMoneyParts,
      formatPercent,
    ],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  return ctx;
}
