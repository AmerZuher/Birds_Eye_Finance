import { z } from 'zod';

import { CORE_CURRENCY_CODES, CURRENCIES } from '@/constants/currencies';
import { getJSON, setJSON, storage, StorageKeys } from '@/lib/mmkv';

/**
 * Daily market reference rates (FEATURE_SPEC 0.5) — CLAUDE.md rule 1's exchange-rate
 * exception. Each download is a plain GET of a public, key-less URL that is the same for
 * every user: no identifiers, amounts or settings are sent, not even the base currency.
 *
 * Every provider quotes units of each currency per 1 SAR. The app keeps SAR per 1 unit
 * (CurrencyDef.rate), so every quote is inverted here — and nowhere else.
 */

export type RateSource = 'exchangerate-api' | 'currency-api';

export interface RatesSnapshot {
  /** SAR per 1 unit, by currency code. */
  rates: Record<string, number>;
  /** When this device downloaded them (ISO instant). */
  fetchedAt: string;
  source: RateSource;
}

/** Provider names as shown in Settings — brand names, not translated. */
export const RATE_SOURCE_NAMES: Record<RateSource, string> = {
  'exchangerate-api': 'ExchangeRate-API',
  'currency-api': 'Currency API',
};

/** ExchangeRate-API's open-access terms require an attribution link (shown in Settings). */
export const RATES_ATTRIBUTION_URL = 'https://www.exchangerate-api.com';

const FETCH_TIMEOUT_MS = 6000;
/** Providers publish once a day — there is nothing newer to fetch sooner. */
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Wait after a failed automatic attempt, so a flaky connection doesn't hammer the providers. */
const RETRY_INTERVAL_MS = 30 * 60 * 1000;

const quoteTable = z.record(z.string(), z.number());

interface Provider {
  source: RateSource;
  url: string;
  quotes: (data: unknown) => Record<string, number>;
}

const currencyApiQuotes = (data: unknown) => z.object({ sar: quoteTable }).parse(data).sar;

const PROVIDERS: Provider[] = [
  {
    source: 'exchangerate-api',
    url: 'https://open.er-api.com/v6/latest/SAR',
    quotes: (data) =>
      z
        .object({ result: z.literal('success'), base_code: z.literal('SAR'), rates: quoteTable })
        .parse(data).rates,
  },
  {
    source: 'currency-api',
    url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/sar.json',
    quotes: currencyApiQuotes,
  },
  {
    // The same data on Cloudflare — the currency-api project asks apps to fall back to it.
    source: 'currency-api',
    url: 'https://latest.currency-api.pages.dev/v1/currencies/sar.json',
    quotes: currencyApiQuotes,
  },
];

/**
 * Units-per-SAR quotes → SAR-per-unit rates for the app's currencies. Throws, rejecting the
 * whole response, when one of the original 20 currencies is missing or any quote isn't a
 * positive number. Other currencies it lacks are left out and keep their last known rate.
 */
export function toAppRates(quotes: Record<string, number>): Record<string, number> {
  const rates: Record<string, number> = { SAR: 1 };
  for (const { code } of CURRENCIES) {
    if (code === 'SAR') continue;
    // currency-api keys are lowercase.
    const quote = quotes[code] ?? quotes[code.toLowerCase()];
    if (quote === undefined) {
      if (CORE_CURRENCY_CODES.includes(code)) throw new Error(`Rates response is missing ${code}`);
      continue;
    }
    if (!Number.isFinite(quote) || quote <= 0) {
      throw new Error(`Rates response has an invalid ${code} quote`);
    }
    rates[code] = 1 / quote;
  }
  return rates;
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

/** Tries each provider in order and returns the first usable table; throws when none gave one. */
export async function downloadRates(): Promise<RatesSnapshot> {
  let lastError: unknown = new Error('No exchange-rate provider responded');
  for (const provider of PROVIDERS) {
    try {
      const rates = toAppRates(provider.quotes(await fetchJson(provider.url)));
      return { rates, fetchedAt: new Date().toISOString(), source: provider.source };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const snapshotSchema = z.object({
  rates: z.record(z.string(), z.number().positive()),
  fetchedAt: z.string(),
  source: z.enum(['exchangerate-api', 'currency-api']),
});

export function readCachedRates(): RatesSnapshot | undefined {
  const parsed = snapshotSchema.safeParse(getJSON(StorageKeys.ratesCache));
  return parsed.success ? parsed.data : undefined;
}

/** Stores a download over the cached table, so a currency it lacks keeps its last known rate. */
export function cacheRates(next: RatesSnapshot): RatesSnapshot {
  const merged: RatesSnapshot = { ...next, rates: { ...readCachedRates()?.rates, ...next.rates } };
  setJSON(StorageKeys.ratesCache, merged);
  return merged;
}

/** On unless the user turned it off in Settings. */
export function readOnlineRatesEnabled(): boolean {
  return storage.getBoolean(StorageKeys.ratesOnline) ?? true;
}

export function writeOnlineRatesEnabled(enabled: boolean): void {
  storage.set(StorageKeys.ratesOnline, enabled);
}

function isWithin(timestamp: number | undefined, windowMs: number, now: number): boolean {
  if (timestamp === undefined || Number.isNaN(timestamp)) return false;
  const age = now - timestamp;
  // A clock set backwards gives a negative age — treat it as stale rather than waiting it out.
  return age >= 0 && age < windowMs;
}

/** An automatic download is due when the rates in use are missing or a day old, and no attempt ran in the last half hour. */
export function isRefreshDue(now = Date.now()): boolean {
  const cached = readCachedRates();
  if (cached && isWithin(Date.parse(cached.fetchedAt), REFRESH_INTERVAL_MS, now)) return false;
  return !isWithin(storage.getNumber(StorageKeys.ratesLastAttempt), RETRY_INTERVAL_MS, now);
}

export function markRefreshAttempt(now = Date.now()): void {
  storage.set(StorageKeys.ratesLastAttempt, now);
}
