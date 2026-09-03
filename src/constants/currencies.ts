export interface CurrencyDef {
  code: string;
  symbolAr: string;
  symbolEn: string;
  nameAr: string;
  nameEn: string;
  locale: string;
  /** Static rate: value of 1 unit of this currency expressed in SAR (the base). */
  rate: number;
}

// Static reference table, SAR = 1.0 base. No live rates (see CLAUDE.md rule 1 / FEATURE_SPEC 0.5).
export const CURRENCIES: CurrencyDef[] = [
  {
    code: 'SAR',
    symbolAr: 'ر.س',
    symbolEn: 'SAR',
    nameAr: 'ريال سعودي',
    nameEn: 'Saudi Riyal',
    locale: 'ar-SA',
    rate: 1,
  },
  {
    code: 'USD',
    symbolAr: '$',
    symbolEn: '$',
    nameAr: 'دولار أمريكي',
    nameEn: 'US Dollar',
    locale: 'en-US',
    rate: 3.75,
  },
  {
    code: 'EUR',
    symbolAr: '€',
    symbolEn: '€',
    nameAr: 'يورو',
    nameEn: 'Euro',
    locale: 'de-DE',
    rate: 4.07,
  },
  {
    code: 'GBP',
    symbolAr: '£',
    symbolEn: '£',
    nameAr: 'جنيه إسترليني',
    nameEn: 'British Pound',
    locale: 'en-GB',
    rate: 4.75,
  },
  {
    code: 'AED',
    symbolAr: 'د.إ',
    symbolEn: 'AED',
    nameAr: 'درهم إماراتي',
    nameEn: 'UAE Dirham',
    locale: 'ar-AE',
    rate: 1.02,
  },
  {
    code: 'KWD',
    symbolAr: 'د.ك',
    symbolEn: 'KWD',
    nameAr: 'دينار كويتي',
    nameEn: 'Kuwaiti Dinar',
    locale: 'ar-KW',
    rate: 12.2,
  },
  {
    code: 'BHD',
    symbolAr: 'د.ب',
    symbolEn: 'BHD',
    nameAr: 'دينار بحريني',
    nameEn: 'Bahraini Dinar',
    locale: 'ar-BH',
    rate: 9.95,
  },
  {
    code: 'QAR',
    symbolAr: 'ر.ق',
    symbolEn: 'QAR',
    nameAr: 'ريال قطري',
    nameEn: 'Qatari Riyal',
    locale: 'ar-QA',
    rate: 1.03,
  },
  {
    code: 'OMR',
    symbolAr: 'ر.ع',
    symbolEn: 'OMR',
    nameAr: 'ريال عماني',
    nameEn: 'Omani Rial',
    locale: 'ar-OM',
    rate: 9.75,
  },
  {
    code: 'EGP',
    symbolAr: 'ج.م',
    symbolEn: 'EGP',
    nameAr: 'جنيه مصري',
    nameEn: 'Egyptian Pound',
    locale: 'ar-EG',
    rate: 0.076,
  },
  {
    code: 'JOD',
    symbolAr: 'د.أ',
    symbolEn: 'JOD',
    nameAr: 'دينار أردني',
    nameEn: 'Jordanian Dinar',
    locale: 'ar-JO',
    rate: 5.29,
  },
  {
    code: 'TRY',
    symbolAr: '₺',
    symbolEn: '₺',
    nameAr: 'ليرة تركية',
    nameEn: 'Turkish Lira',
    locale: 'tr-TR',
    rate: 0.108,
  },
  {
    code: 'INR',
    symbolAr: '₹',
    symbolEn: '₹',
    nameAr: 'روبية هندية',
    nameEn: 'Indian Rupee',
    locale: 'en-IN',
    rate: 0.045,
  },
  {
    code: 'PKR',
    symbolAr: '₨',
    symbolEn: 'Rs',
    nameAr: 'روبية باكستانية',
    nameEn: 'Pakistani Rupee',
    locale: 'ur-PK',
    rate: 0.0134,
  },
  {
    code: 'PHP',
    symbolAr: '₱',
    symbolEn: '₱',
    nameAr: 'بيزو فلبيني',
    nameEn: 'Philippine Peso',
    locale: 'en-PH',
    rate: 0.065,
  },
  {
    code: 'CNY',
    symbolAr: '¥',
    symbolEn: '¥',
    nameAr: 'يوان صيني',
    nameEn: 'Chinese Yuan',
    locale: 'zh-CN',
    rate: 0.52,
  },
  {
    code: 'JPY',
    symbolAr: '¥',
    symbolEn: '¥',
    nameAr: 'ين ياباني',
    nameEn: 'Japanese Yen',
    locale: 'ja-JP',
    rate: 0.0245,
  },
  {
    code: 'CAD',
    symbolAr: 'C$',
    symbolEn: 'C$',
    nameAr: 'دولار كندي',
    nameEn: 'Canadian Dollar',
    locale: 'en-CA',
    rate: 2.72,
  },
  {
    code: 'AUD',
    symbolAr: 'A$',
    symbolEn: 'A$',
    nameAr: 'دولار أسترالي',
    nameEn: 'Australian Dollar',
    locale: 'en-AU',
    rate: 2.44,
  },
  {
    code: 'CHF',
    symbolAr: 'CHF',
    symbolEn: 'CHF',
    nameAr: 'فرنك سويسري',
    nameEn: 'Swiss Franc',
    locale: 'de-CH',
    rate: 4.28,
  },
];

export const DEFAULT_CURRENCY_CODE = 'SAR';

export function getCurrency(code: string): CurrencyDef {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}
