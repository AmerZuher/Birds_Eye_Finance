/**
 * Regenerates src/constants/currencyTable.ts: every currency the app offers, with English and
 * Arabic names and symbols, plus the built-in fallback rates (FEATURE_SPEC 0.5).
 *
 * Run with `npm run currencies`. Needs network access (it downloads today's rates once, at build
 * time) and Node's full ICU data (the default in official Node builds) for names and symbols.
 *
 * Which currencies: the ISO 4217 codes that both rate providers the app uses quote, minus a few a
 * provider still lists but nobody can hold any more. The app's original 20 keep their hand-picked
 * names and symbols and stay first in every list; the rest follow by code.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PRIMARY_URL = 'https://open.er-api.com/v6/latest/SAR';
const SECONDARY_URL =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/sar.json';

/** Still quoted by a provider, but replaced, or not a currency anyone holds. */
const EXCLUDED = new Set([
  'ANG', // replaced by XCG (2025)
  'HRK', // Croatia adopted the euro (2023)
  'SLL', // replaced by SLE
  'XDR', // IMF accounting unit
  'ZWL', // replaced by ZWG (2024)
]);

interface Entry {
  code: string;
  symbolAr: string;
  symbolEn: string;
  nameAr: string;
  nameEn: string;
}

/** The app's original currencies, exactly as they were hand-written before this table was generated. */
const CURATED: Entry[] = [
  { code: 'SAR', symbolAr: '⃁', symbolEn: '⃁', nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal' },
  { code: 'USD', symbolAr: '$', symbolEn: '$', nameAr: 'دولار أمريكي', nameEn: 'US Dollar' },
  { code: 'EUR', symbolAr: '€', symbolEn: '€', nameAr: 'يورو', nameEn: 'Euro' },
  { code: 'GBP', symbolAr: '£', symbolEn: '£', nameAr: 'جنيه إسترليني', nameEn: 'British Pound' },
  { code: 'AED', symbolAr: 'د.إ', symbolEn: 'AED', nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham' },
  { code: 'KWD', symbolAr: 'د.ك', symbolEn: 'KWD', nameAr: 'دينار كويتي', nameEn: 'Kuwaiti Dinar' },
  {
    code: 'BHD',
    symbolAr: 'د.ب',
    symbolEn: 'BHD',
    nameAr: 'دينار بحريني',
    nameEn: 'Bahraini Dinar',
  },
  { code: 'QAR', symbolAr: 'ر.ق', symbolEn: 'QAR', nameAr: 'ريال قطري', nameEn: 'Qatari Riyal' },
  { code: 'OMR', symbolAr: 'ر.ع', symbolEn: 'OMR', nameAr: 'ريال عماني', nameEn: 'Omani Rial' },
  { code: 'EGP', symbolAr: 'ج.م', symbolEn: 'EGP', nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound' },
  {
    code: 'JOD',
    symbolAr: 'د.أ',
    symbolEn: 'JOD',
    nameAr: 'دينار أردني',
    nameEn: 'Jordanian Dinar',
  },
  { code: 'TRY', symbolAr: '₺', symbolEn: '₺', nameAr: 'ليرة تركية', nameEn: 'Turkish Lira' },
  { code: 'INR', symbolAr: '₹', symbolEn: '₹', nameAr: 'روبية هندية', nameEn: 'Indian Rupee' },
  {
    code: 'PKR',
    symbolAr: '₨',
    symbolEn: 'Rs',
    nameAr: 'روبية باكستانية',
    nameEn: 'Pakistani Rupee',
  },
  { code: 'PHP', symbolAr: '₱', symbolEn: '₱', nameAr: 'بيزو فلبيني', nameEn: 'Philippine Peso' },
  { code: 'CNY', symbolAr: '¥', symbolEn: '¥', nameAr: 'يوان صيني', nameEn: 'Chinese Yuan' },
  { code: 'JPY', symbolAr: '¥', symbolEn: '¥', nameAr: 'ين ياباني', nameEn: 'Japanese Yen' },
  { code: 'CAD', symbolAr: 'C$', symbolEn: 'C$', nameAr: 'دولار كندي', nameEn: 'Canadian Dollar' },
  {
    code: 'AUD',
    symbolAr: 'A$',
    symbolEn: 'A$',
    nameAr: 'دولار أسترالي',
    nameEn: 'Australian Dollar',
  },
  { code: 'CHF', symbolAr: 'CHF', symbolEn: 'CHF', nameAr: 'فرنك سويسري', nameEn: 'Swiss Franc' },
];

const namesEn = new Intl.DisplayNames(['en'], { type: 'currency' });
const namesAr = new Intl.DisplayNames(['ar'], { type: 'currency' });
/** Bidi marks ICU wraps around Arabic symbols (ALM, LRM, RLM) — built from code points so they stay visible in source. */
const BIDI_MARKS = new RegExp(`[${String.fromCharCode(0x061c, 0x200e, 0x200f)}]`, 'g');

function symbolIn(locale: string, code: string): string {
  const part = new Intl.NumberFormat(locale, { style: 'currency', currency: code })
    .formatToParts(1)
    .find((p) => p.type === 'currency');
  const symbol = (part?.value ?? '')
    .replace(BIDI_MARKS, '') // the bidi marks ICU puts around Arabic symbols
    .replace(/\.$/, '') // "د.م." → "د.م", like the hand-picked ones
    .trim();
  // A multi-word symbol ("F CFA") can't sit flush against the digits the way the app prints money.
  return symbol && !/\s/.test(symbol) ? symbol : code;
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

function quotesOf(data: Record<string, unknown>, key: string): Record<string, number> {
  const quotes = data[key];
  if (!quotes || typeof quotes !== 'object')
    throw new Error(`Rates response has no "${key}" table`);
  return Object.fromEntries(
    Object.entries(quotes as Record<string, number>).map(([code, value]) => [
      code.toUpperCase(),
      value,
    ]),
  );
}

async function main() {
  const [primary, secondary] = await Promise.all([getJson(PRIMARY_URL), getJson(SECONDARY_URL)]);
  const primaryQuotes = quotesOf(primary, 'rates');
  const secondaryCodes = new Set(Object.keys(quotesOf(secondary, 'sar')));
  const iso = new Set(Intl.supportedValuesOf('currency'));
  const updatedUnix =
    typeof primary.time_last_update_unix === 'number'
      ? primary.time_last_update_unix
      : Date.now() / 1000;
  const ratesDate = new Date(updatedUnix * 1000).toISOString().slice(0, 10);

  const curatedCodes = new Set(CURATED.map((entry) => entry.code));
  const generated: Entry[] = Object.keys(primaryQuotes)
    .filter(
      (code) =>
        iso.has(code) && secondaryCodes.has(code) && !EXCLUDED.has(code) && !curatedCodes.has(code),
    )
    .sort()
    .map((code) => ({
      code,
      symbolAr: symbolIn('ar', code),
      symbolEn: symbolIn('en-US', code),
      nameAr: namesAr.of(code) ?? code,
      nameEn: namesEn.of(code) ?? code,
    }));

  const lines = [...CURATED, ...generated].map((entry) => {
    const quote = primaryQuotes[entry.code];
    if (!(quote > 0)) throw new Error(`No usable rate for ${entry.code}`);
    // Quotes are units per 1 SAR; the table stores SAR per 1 unit.
    const rate = entry.code === 'SAR' ? 1 : Number((1 / quote).toPrecision(6));
    const fields = (['code', 'symbolAr', 'symbolEn', 'nameAr', 'nameEn'] as const)
      .map((field) => `${field}: ${JSON.stringify(entry[field])}`)
      .join(', ');
    return `  { ${fields}, rate: ${rate} },`;
  });

  const output = [
    '// AUTO-GENERATED by scripts/buildCurrencies.ts — do not edit by hand.',
    '// Regenerate with `npm run currencies`. See FEATURE_SPEC 0.5.',
    '',
    "import type { CurrencyDef } from './currencies';",
    '',
    '/** The market date of the built-in rates below — the fallback until the app has downloaded rates. */',
    `export const BUILT_IN_RATES_DATE = '${ratesDate}';`,
    '',
    'export const CURRENCY_TABLE: CurrencyDef[] = [',
    ...lines,
    '];',
    '',
  ].join('\n');

  writeFileSync(resolve(process.cwd(), 'src/constants/currencyTable.ts'), output);
  console.log(`Wrote ${lines.length} currencies (built-in rates from ${ratesDate}).`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
