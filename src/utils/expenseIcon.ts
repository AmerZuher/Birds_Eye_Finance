import {
  Baby,
  Bus,
  Car,
  Coffee,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Music,
  PawPrint,
  Phone,
  Plane,
  Popcorn,
  Salad,
  Scissors,
  ShieldAlert,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Tv,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { findBrandIcon } from '@/constants/brandIcons';
import type { Period } from '@/lib/period';

/**
 * CLAUDE.md rule 7: every expense renders *something*, offline,
 * deterministically. The `icon` column (text, notNull) stores one of:
 *   "brand:<slug>"   — a curated simple-icons match (BrandGlyph)
 *   "lucide:<key>"   — one of the 26 generic category icons below
 *   "initial"        — auto-generated colored initial-letter tile (fallback)
 */
export type ExpenseIconValue = string;

export const BRAND_ICON_PREFIX = 'brand:';
export const LUCIDE_ICON_PREFIX = 'lucide:';
export const INITIAL_ICON_VALUE = 'initial';

// The 26 generic category icons FEATURE_SPEC 2.7 calls for, offered
// alongside brandIcons.ts matches in ExpenseModal's icon picker grid.
export const GENERIC_EXPENSE_ICONS: { key: string; Icon: LucideIcon }[] = [
  { key: 'Home', Icon: Home },
  { key: 'ShoppingBag', Icon: ShoppingBag },
  { key: 'ShoppingCart', Icon: ShoppingCart },
  { key: 'Utensils', Icon: Utensils },
  { key: 'Coffee', Icon: Coffee },
  { key: 'Salad', Icon: Salad },
  { key: 'Car', Icon: Car },
  { key: 'Fuel', Icon: Fuel },
  { key: 'Bus', Icon: Bus },
  { key: 'Plane', Icon: Plane },
  { key: 'Zap', Icon: Zap },
  { key: 'Wifi', Icon: Wifi },
  { key: 'Phone', Icon: Phone },
  { key: 'Tv', Icon: Tv },
  { key: 'Music', Icon: Music },
  { key: 'Popcorn', Icon: Popcorn },
  { key: 'Gamepad2', Icon: Gamepad2 },
  { key: 'Dumbbell', Icon: Dumbbell },
  { key: 'HeartPulse', Icon: HeartPulse },
  { key: 'GraduationCap', Icon: GraduationCap },
  { key: 'Gift', Icon: Gift },
  { key: 'Shirt', Icon: Shirt },
  { key: 'Scissors', Icon: Scissors },
  { key: 'PawPrint', Icon: PawPrint },
  { key: 'Baby', Icon: Baby },
  { key: 'Wrench', Icon: Wrench },
  { key: 'ShieldAlert', Icon: ShieldAlert },
  { key: 'Sparkles', Icon: Sparkles },
  { key: 'Wallet', Icon: Wallet },
];

export function lucideIconFor(key: string): LucideIcon | undefined {
  return GENERIC_EXPENSE_ICONS.find((i) => i.key === key)?.Icon;
}

export function brandIconValue(slug: string): ExpenseIconValue {
  return `${BRAND_ICON_PREFIX}${slug}`;
}

export function lucideIconValue(key: string): ExpenseIconValue {
  return `${LUCIDE_ICON_PREFIX}${key}`;
}

export interface ResolvedExpenseIcon {
  kind: 'brand' | 'lucide' | 'initial';
  brandSlug?: string;
  LucideIcon?: LucideIcon;
}

/** Resolves a stored icon value, falling back to a generic icon or initials — never nothing (rule 7). */
export function resolveExpenseIcon(icon: string, name: string): ResolvedExpenseIcon {
  if (icon.startsWith(BRAND_ICON_PREFIX)) {
    const slug = icon.slice(BRAND_ICON_PREFIX.length);
    if (findBrandIcon(slug)) return { kind: 'brand', brandSlug: slug };
  }
  if (icon.startsWith(LUCIDE_ICON_PREFIX)) {
    const key = icon.slice(LUCIDE_ICON_PREFIX.length);
    const Icon = lucideIconFor(key);
    if (Icon) return { kind: 'lucide', LucideIcon: Icon };
  }
  // A raw brand slug typed by autocomplete matching, or an unrecognized
  // value — try one more brand lookup before falling back to initials.
  const brand = findBrandIcon(name) ?? findBrandIcon(icon);
  if (brand) return { kind: 'brand', brandSlug: brand.slug };
  return { kind: 'initial' };
}

export type ExpenseCategory =
  'essential' | 'personal' | 'subscriptions' | 'entertainment' | 'emergency';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'essential',
  'personal',
  'subscriptions',
  'entertainment',
  'emergency',
];

export interface ExpenseTemplate {
  name: string;
  category: ExpenseCategory;
  defaultPeriod: Period;
  defaultPriceUSD: number;
  icon: ExpenseIconValue;
  /** The ~10 most universally-relevant entries — used to bias ordering
   * toward the top of the Templates browse list before any search. */
  universal?: boolean;
}

// FEATURE_SPEC 2.3 — a curated catalog of real, common expenses that backs
// ExpenseModal's Templates tab (browse/search) and its Custom-tab name
// autocomplete. Prices convert to base currency at add-time only (2.3/Part
// 6) — never retroactively.
export const EXPENSE_TEMPLATES: ExpenseTemplate[] = [
  // Essential
  {
    name: 'Rent',
    category: 'essential',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 1200,
    icon: lucideIconValue('Home'),
    universal: true,
  },
  {
    name: 'Mortgage',
    category: 'essential',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 1500,
    icon: lucideIconValue('Home'),
  },
  {
    name: 'Electricity',
    category: 'essential',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 80,
    icon: lucideIconValue('Zap'),
    universal: true,
  },
  {
    name: 'Water',
    category: 'essential',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 40,
    icon: lucideIconValue('Wallet'),
  },
  {
    name: 'Internet',
    category: 'essential',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 60,
    icon: lucideIconValue('Wifi'),
    universal: true,
  },
  {
    name: 'Mobile Bill',
    category: 'essential',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 35,
    icon: lucideIconValue('Phone'),
    universal: true,
  },
  {
    name: 'Gas',
    category: 'essential',
    defaultPeriod: 'weekly',
    defaultPriceUSD: 30,
    icon: lucideIconValue('Fuel'),
    universal: true,
  },
  {
    name: 'Groceries',
    category: 'essential',
    defaultPeriod: 'weekly',
    defaultPriceUSD: 60,
    icon: lucideIconValue('ShoppingCart'),
    universal: true,
  },
  {
    name: 'Transport',
    category: 'essential',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 50,
    icon: lucideIconValue('Bus'),
  },
  {
    name: 'Car Payment',
    category: 'essential',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 350,
    icon: lucideIconValue('Car'),
  },
  {
    name: 'Car Insurance',
    category: 'essential',
    defaultPeriod: 'yearly',
    defaultPriceUSD: 800,
    icon: lucideIconValue('ShieldAlert'),
  },
  {
    name: 'Home Insurance',
    category: 'essential',
    defaultPeriod: 'yearly',
    defaultPriceUSD: 500,
    icon: lucideIconValue('ShieldAlert'),
  },
  {
    name: 'Health Insurance',
    category: 'essential',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 150,
    icon: lucideIconValue('HeartPulse'),
  },
  {
    name: 'Car Maintenance',
    category: 'essential',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 60,
    icon: lucideIconValue('Wrench'),
  },
  {
    name: 'Property Tax',
    category: 'essential',
    defaultPeriod: 'yearly',
    defaultPriceUSD: 2000,
    icon: lucideIconValue('Wallet'),
  },
  {
    name: 'Childcare',
    category: 'essential',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 400,
    icon: lucideIconValue('Baby'),
  },

  // Personal
  {
    name: 'Gym',
    category: 'personal',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 45,
    icon: lucideIconValue('Dumbbell'),
    universal: true,
  },
  {
    name: 'Barber',
    category: 'personal',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 20,
    icon: lucideIconValue('Scissors'),
  },
  {
    name: 'Dining Out',
    category: 'personal',
    defaultPeriod: 'weekly',
    defaultPriceUSD: 40,
    icon: lucideIconValue('Utensils'),
  },
  {
    name: 'Coffee',
    category: 'personal',
    defaultPeriod: 'weekly',
    defaultPriceUSD: 15,
    icon: lucideIconValue('Coffee'),
  },
  {
    name: 'Clothing',
    category: 'personal',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 60,
    icon: lucideIconValue('Shirt'),
  },
  {
    name: 'Pet Care',
    category: 'personal',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 30,
    icon: lucideIconValue('PawPrint'),
  },
  {
    name: 'Skincare & Cosmetics',
    category: 'personal',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 25,
    icon: lucideIconValue('Sparkles'),
  },
  {
    name: 'Dry Cleaning',
    category: 'personal',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 25,
    icon: lucideIconValue('Shirt'),
  },
  {
    name: 'Education & Tuition',
    category: 'personal',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 300,
    icon: lucideIconValue('GraduationCap'),
  },
  {
    name: 'Books',
    category: 'personal',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 20,
    icon: lucideIconValue('ShoppingBag'),
  },
  {
    name: 'Home Decor',
    category: 'personal',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 40,
    icon: lucideIconValue('ShoppingBag'),
  },
  {
    name: 'Charity & Donations',
    category: 'personal',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 50,
    icon: lucideIconValue('Gift'),
  },
  {
    name: 'Salon & Spa',
    category: 'personal',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 35,
    icon: lucideIconValue('Sparkles'),
  },
  {
    name: 'Home Cleaning Service',
    category: 'personal',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 60,
    icon: lucideIconValue('Sparkles'),
  },

  // Subscriptions
  {
    name: 'Netflix',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 15.49,
    icon: brandIconValue('netflix'),
    universal: true,
  },
  {
    name: 'Spotify',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 11.99,
    icon: brandIconValue('spotify'),
    universal: true,
  },
  {
    name: 'YouTube Premium',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 13.99,
    icon: brandIconValue('youtube'),
    universal: true,
  },
  {
    name: 'Apple Music',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 10.99,
    icon: brandIconValue('applemusic'),
  },
  {
    name: 'HBO Max',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 15.99,
    icon: brandIconValue('hbomax'),
  },
  {
    name: 'PlayStation Plus',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 17.99,
    icon: brandIconValue('playstation'),
  },
  {
    name: 'iCloud/Cloud Storage',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 2.99,
    icon: brandIconValue('icloud'),
  },
  {
    name: 'Software/SaaS Tools',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 20,
    icon: lucideIconValue('Wrench'),
  },
  {
    name: 'News Subscription',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 8,
    icon: lucideIconValue('Tv'),
  },
  {
    name: 'Gaming Subscription',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 15,
    icon: lucideIconValue('Gamepad2'),
  },
  {
    name: 'Claude',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 20,
    icon: brandIconValue('claude'),
  },
  {
    name: 'ChatGPT Plus',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 20,
    icon: lucideIconValue('Sparkles'),
  },
  {
    name: 'Notion',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 10,
    icon: brandIconValue('notion'),
  },
  {
    name: 'Dropbox',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 11.99,
    icon: brandIconValue('dropbox'),
  },
  {
    name: 'GitHub Copilot',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 10,
    icon: brandIconValue('githubcopilot'),
  },
  {
    name: 'Discord Nitro',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 9.99,
    icon: brandIconValue('discord'),
  },
  {
    name: 'Audible',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 14.95,
    icon: brandIconValue('audible'),
  },
  {
    name: 'Tidal',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 10.99,
    icon: brandIconValue('tidal'),
  },
  {
    name: 'Duolingo Plus',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 12.99,
    icon: brandIconValue('duolingo'),
  },
  {
    name: 'NordVPN',
    category: 'subscriptions',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 12.99,
    icon: brandIconValue('nordvpn'),
  },

  // Entertainment
  {
    name: 'Movies & Cinema',
    category: 'entertainment',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 25,
    icon: lucideIconValue('Popcorn'),
  },
  {
    name: 'Concerts & Events',
    category: 'entertainment',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 40,
    icon: lucideIconValue('Music'),
  },
  {
    name: 'Video Games',
    category: 'entertainment',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 30,
    icon: lucideIconValue('Gamepad2'),
  },
  {
    name: 'Hobbies',
    category: 'entertainment',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 50,
    icon: lucideIconValue('Sparkles'),
  },
  {
    name: 'Travel & Vacations',
    category: 'entertainment',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 150,
    icon: lucideIconValue('Plane'),
  },
  {
    name: 'Twitch',
    category: 'entertainment',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 5,
    icon: brandIconValue('twitch'),
  },

  // Emergency
  {
    name: 'Emergency Fund',
    category: 'emergency',
    defaultPeriod: 'monthly',
    defaultPriceUSD: 100,
    icon: lucideIconValue('ShieldAlert'),
  },
  {
    name: 'Car Repair',
    category: 'emergency',
    defaultPeriod: 'yearly',
    defaultPriceUSD: 400,
    icon: lucideIconValue('Wrench'),
  },
  {
    name: 'Home Repair',
    category: 'emergency',
    defaultPeriod: 'yearly',
    defaultPriceUSD: 500,
    icon: lucideIconValue('Wrench'),
  },
  {
    name: 'Medical Emergency',
    category: 'emergency',
    defaultPeriod: 'yearly',
    defaultPriceUSD: 300,
    icon: lucideIconValue('HeartPulse'),
  },
];

/** Catalog-only search backing both the Templates tab's browse/search and the Custom tab's name autocomplete — one lookup, two entry points. */
export function searchTemplates(query: string, limit = 50): ExpenseTemplate[] {
  const q = query.trim().toLowerCase();
  if (!q) return EXPENSE_TEMPLATES;
  return EXPENSE_TEMPLATES.filter((t) => t.name.toLowerCase().includes(q)).slice(0, limit);
}
