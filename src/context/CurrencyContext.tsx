import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import type { CustomSelectOption } from '@/components/ui/CustomSelect';
import {
  BUILT_IN_RATES_DATE,
  CURRENCIES,
  DEFAULT_CURRENCY_CODE,
  getCurrency,
} from '@/constants/currencies';
import { useLanguage } from '@/context/LanguageContext';
import {
  cacheRates,
  downloadRates,
  isRefreshDue,
  markRefreshAttempt,
  readCachedRates,
  readOnlineRatesEnabled,
  writeOnlineRatesEnabled,
} from '@/lib/exchangeRates';
import type { RateSource, RatesSnapshot } from '@/lib/exchangeRates';
import { getJSON, setJSON, storage, StorageKeys } from '@/lib/mmkv';

export function readInitialBaseCurrency(): string {
  const stored = storage.getString(StorageKeys.baseCurrency);
  return stored && CURRENCIES.some((c) => c.code === stored) ? stored : DEFAULT_CURRENCY_CODE;
}

function readInitialUsage(): Record<string, number> {
  return getJSON<Record<string, number>>(StorageKeys.currencyUsage) ?? {};
}

/** Local midnight of the built-in table's market date. */
const BUILT_IN_RATES_TIME = (() => {
  const [year, month, day] = BUILT_IN_RATES_DATE.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
})();

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

export interface ExchangeRatesStatus {
  /** Where the rates in use come from — `built-in` until the device has downloaded any. */
  source: RateSource | 'built-in';
  /** When the rates in use were downloaded (ms), or local midnight of the built-in table's market date. */
  updatedAt: number;
  /** Whether the app downloads rates (Settings toggle, on by default). */
  online: boolean;
  refreshing: boolean;
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
  /** `currencies` as picker options: the code as the label, the name in the
   * app's language as the description, so a picker can be searched by either. */
  currencyOptions: CustomSelectOption<string>[];
  /** Call when the user picks a currency anywhere (debt/expense/balance/
   * income/base-currency) — the only input `currencies`' ordering above is
   * derived from. */
  recordCurrencyUsage: (code: string) => void;
  /** Converts between any two currencies with the rates in use (downloaded, else built-in). */
  convert: (amount: number, fromCurrency: string, toCurrency: string) => number;
  convertToBase: (amount: number, fromCurrency: string) => number;
  formatMoney: (amount: number, currencyCode?: string) => string;
  formatOriginalMoney: (amount: number, currencyCode: string) => string;
  /** Same formatting as `formatMoney`, split into parts so a caller can give
   * the symbol/integer/decimal portions different type treatment. */
  formatMoneyParts: (amount: number, currencyCode?: string) => MoneyParts;
  /** A whole-number percentage, localized — Arabic uses Arabic-Indic digits,
   * English uses Latin digits. Callers append the "%" glyph themselves. */
  formatPercent: (value: number) => string;
  exchangeRates: ExchangeRatesStatus;
  setOnlineRates: (enabled: boolean) => void;
  /** Downloads rates now, however recent the current ones are. Resolves true on success. */
  refreshRates: () => Promise<boolean>;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  const [baseCurrency, setBaseCurrencyState] = useState<string>(readInitialBaseCurrency);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>(readInitialUsage);
  const [ratesSnapshot, setRatesSnapshot] = useState<RatesSnapshot | undefined>(readCachedRates);
  const [onlineRates, setOnlineRatesState] = useState<boolean>(readOnlineRatesEnabled);
  const [refreshing, setRefreshing] = useState(false);
  const refreshInFlight = useRef<Promise<boolean> | null>(null);

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

  const currencyOptions = useMemo(
    () =>
      sortedCurrencies.map((c) => ({
        label: c.code,
        value: c.code,
        description: language === 'ar' ? c.nameAr : c.nameEn,
      })),
    [sortedCurrencies, language],
  );

  const refreshRates = useCallback((): Promise<boolean> => {
    // A second call while one is running shares its result instead of starting another.
    if (refreshInFlight.current) return refreshInFlight.current;
    const run = (async () => {
      setRefreshing(true);
      markRefreshAttempt();
      try {
        setRatesSnapshot(cacheRates(await downloadRates()));
        return true;
      } catch (error) {
        console.warn('[rates] download failed', error);
        return false;
      } finally {
        refreshInFlight.current = null;
        setRefreshing(false);
      }
    })();
    refreshInFlight.current = run;
    return run;
  }, []);

  // Fresh rates on every app launch; after that, a return to the foreground downloads
  // only when the rates in use are a day old, and turning the setting back on downloads
  // only when one is due (FEATURE_SPEC 0.5). Never awaited — conversions keep using the
  // rates already in hand until a new table arrives.
  const launchRefreshed = useRef(false);
  useEffect(() => {
    if (!onlineRates) return;
    if (!launchRefreshed.current) {
      launchRefreshed.current = true;
      void refreshRates();
    } else if (isRefreshDue()) {
      void refreshRates();
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isRefreshDue()) void refreshRates();
    });
    return () => subscription.remove();
  }, [onlineRates, refreshRates]);

  const setOnlineRates = useCallback((enabled: boolean) => {
    writeOnlineRatesEnabled(enabled);
    setOnlineRatesState(enabled);
  }, []);

  const convert = useCallback(
    (amount: number, fromCurrency: string, toCurrency: string) => {
      // A downloaded rate when there is one, otherwise the built-in rate.
      const rateOf = (code: string) => {
        const currency = getCurrency(code);
        return ratesSnapshot?.rates[currency.code] ?? currency.rate;
      };
      return (amount * rateOf(fromCurrency)) / rateOf(toCurrency);
    },
    [ratesSnapshot],
  );

  const convertToBase = useCallback(
    (amount: number, fromCurrency: string) => convert(amount, fromCurrency, baseCurrency),
    [convert, baseCurrency],
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
      const symbol = fallback
        ? isAr
          ? fallback.ar
          : fallback.en
        : isAr
          ? currency.symbolAr
          : currency.symbolEn;
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

  const exchangeRates = useMemo<ExchangeRatesStatus>(
    () => ({
      source: ratesSnapshot?.source ?? 'built-in',
      updatedAt: ratesSnapshot ? Date.parse(ratesSnapshot.fetchedAt) : BUILT_IN_RATES_TIME,
      online: onlineRates,
      refreshing,
    }),
    [ratesSnapshot, onlineRates, refreshing],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      baseCurrency,
      setBaseCurrency,
      currencies: sortedCurrencies,
      currencyOptions,
      recordCurrencyUsage,
      convert,
      convertToBase,
      formatMoney,
      formatOriginalMoney,
      formatMoneyParts,
      formatPercent,
      exchangeRates,
      setOnlineRates,
      refreshRates,
    }),
    [
      baseCurrency,
      setBaseCurrency,
      sortedCurrencies,
      currencyOptions,
      recordCurrencyUsage,
      convert,
      convertToBase,
      formatMoney,
      formatOriginalMoney,
      formatMoneyParts,
      formatPercent,
      exchangeRates,
      setOnlineRates,
      refreshRates,
    ],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  return ctx;
}
