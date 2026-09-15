import { SEMANTIC } from '@/constants/theme';
import type { ThemeShape } from '@/constants/theme';
import type { FinancialHealthTier } from '@/context/FinanceContext';

/**
 * Maps a financial-health tier to a theme-derived accent. The polar tiers lean
 * on SEMANTIC (green/red — the same status colors InlineBanner uses), while
 * the middle tiers use the theme's own accents, so the health badge and gauge
 * re-color with whichever palette is active instead of a fixed hex ramp.
 */
export function healthTierColor(tier: FinancialHealthTier, theme: ThemeShape): string {
  switch (tier) {
    case 'excellent':
      return SEMANTIC.positive;
    case 'good':
      return theme.accent2;
    case 'fair':
      return theme.accent1;
    case 'critical':
      return SEMANTIC.negative;
  }
}

/** Converts a `#rrggbb` hex color to an `"r,g,b"` string for use in `rgba(...)`. */
export function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

/** A token color at the given opacity — the one way to derive a tint/wash from a `#rrggbb` token instead of hand-writing an `rgba(...)` literal. */
export function withAlpha(hex: string, alpha: number): string {
  return `rgba(${hexToRgb(hex)},${alpha})`;
}

/** Converts a `#rrggbb` hex color to an HSL tuple — h in 0..360, s/l in 0..100. */
export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).split(',').map(Number);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

/** Converts an HSL tuple (h 0..360, s/l 0..100) back to a `#rrggbb` hex color. */
export function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Builds a `count`-color categorical ramp from a base color's **hue** only —
 * the base's own saturation and lightness are preserved and the hues are
 * spread evenly around the wheel. This is how charts stay on-theme: pass
 * `theme.accent1` and the whole categorical palette shifts to harmonize with
 * whichever theme is active, with no hardcoded hex anywhere.
 */
export function categoricalRamp(baseHex: string, count: number): string[] {
  if (count <= 0) return [];
  const [h, s, l] = hexToHsl(baseHex);
  const step = 360 / count;
  return Array.from({ length: count }, (_, i) => hslToHex((h + i * step) % 360, s, l));
}

// Chrome surfaces (header/navbar/FAB/modals) wash their blur with this same
// alpha over `theme.surface` so they read as the exact same material as the
// cards (rule: "match the card theme while staying glassy") — high enough
// that the blurred backdrop barely tints the color, unlike the old
// lower-alpha chromeTint wash which read as a visibly different hue.
export const CHROME_SURFACE_ALPHA = 0.86;

// Header/navbar only. They wash their blur over `theme.ground` rather than
// `theme.surface`, and skip the white GLASS gradient entirely, so the floating
// bars read as the same darkness as the page behind them instead of a lighter
// slab sitting on top of it. (Modals keep CHROME_SURFACE_ALPHA above — they
// sit over a dimmed backdrop, where matching the cards is the right call.)
export const CHROME_GROUND_ALPHA = 0.82;
