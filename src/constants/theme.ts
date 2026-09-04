export const THEMES = {
  // --- 1. DARK PURPLE (Original 1 - Preserved) ---
  obsidian: {
    label: { en: 'Obsidian', ar: 'أوبسيديان' },
    isLight: false,
    ground: '#040405',
    surface: '#08090b',
    surfaceAlt: '#0e1013',
    accent1: '#3747b0',
    accent2: '#7889cb',
    fab: '#3747b0',
    buttonText: '#ffffff',
    textPrimary: '#f3efe8',
    textSecondary: '#a59a8a',
    textTertiary: '#5c6258',
    border: 'rgba(255,255,255,0.08)',
    borderSoft: 'rgba(255,255,255,0.04)',
    glow: { a: '55,71,176', b: '120,137,203' },
    chromeTint: '28,36,88',
    cardShadow: 'rgba(0,0,0,0.5)',
  },

  // --- 2. DARK BLUE / COBALT (Original 2 - Preserved) ---
  sapphire: {
    label: { en: 'Sapphire', ar: 'سفير' },
    isLight: false,
    ground: '#060a14',
    surface: '#0c1426',
    surfaceAlt: '#111c34',
    accent1: '#2b5fd9',
    accent2: '#2892b0',
    fab: '#2b5fd9',
    buttonText: '#ffffff',
    textPrimary: '#f3efe8',
    textSecondary: '#94a3b8',
    textTertiary: '#475569',
    border: 'rgba(255,255,255,0.08)',
    borderSoft: 'rgba(255,255,255,0.04)',
    glow: { a: '43,50,176', b: '40,146,176' },
    chromeTint: '22,48,109',
    cardShadow: 'rgba(0,0,0,0.5)',
  },

  // --- 3. LIGHT CRISP SLATE (Popular Sleek Minimalist Light) ---
  porcelain: {
    label: { en: 'Porcelain', ar: 'بورسلين' },
    isLight: true,
    ground: '#f1f5f9', // Distinct slate-100 ground makes white cards POP
    surface: '#ffffff', // Crisp white elevated cards
    surfaceAlt: '#e2e8f0', // Soft elevated surface
    accent1: '#4338ca', // Deep rich indigo primary
    accent2: '#6366f1', // Bright violet secondary
    fab: '#4338ca',
    buttonText: '#ffffff',
    textPrimary: '#0f172a', // High-contrast dark slate text
    textSecondary: '#475569', // Muted slate body
    textTertiary: '#94a3b8', // Subtle slate text
    border: 'rgba(15, 23, 42, 0.08)', // Dark subtle hairline border for light mode
    borderSoft: 'rgba(15, 23, 42, 0.04)',
    glow: { a: '67,56,202', b: '99,102,241' },
    chromeTint: '226,232,240',
    cardShadow: 'rgba(15, 23, 42, 0.06)', // Ambient light shadow for depth
  },

  // --- 4. LIGHT WARM EDITORIAL (Warm Linen & Terracotta) ---
  sandstone: {
    label: { en: 'Sandstone', ar: 'حجر رملي' },
    isLight: true,
    ground: '#f5f2eb', // Warm sand background
    surface: '#ffffff', // Crisp white surface cards
    surfaceAlt: '#e8e2d5', // Soft warm stone surface
    accent1: '#c2410c', // Deep burnt terracotta
    accent2: '#ea580c', // Warm amber orange
    fab: '#c2410c',
    buttonText: '#ffffff',
    textPrimary: '#1c1917', // Dark warm espresso text
    textSecondary: '#57534e', // Warm stone secondary
    textTertiary: '#a8a29e', // Muted warm stone
    border: 'rgba(28, 25, 23, 0.09)',
    borderSoft: 'rgba(28, 25, 23, 0.04)',
    glow: { a: '194,65,12', b: '234,88,12' },
    chromeTint: '232,226,213',
    cardShadow: 'rgba(28, 25, 23, 0.06)',
  },

  // --- 5. LIGHT CALM ORGANIC (Eucalyptus & Sage Green) ---
  sage: {
    label: { en: 'Sage', ar: 'مرمية' },
    isLight: true,
    ground: '#edf2ee', // Calming herbal mist ground
    surface: '#ffffff', // Clean white card surface
    surfaceAlt: '#d8e3da', // Muted sage container
    accent1: '#0f766e', // Deep eucalyptus teal
    accent2: '#14b8a6', // Crisp mint teal
    fab: '#0f766e',
    buttonText: '#ffffff',
    textPrimary: '#062c24', // Deep forest dark green text
    textSecondary: '#2d5a50', // Forest slate secondary text
    textTertiary: '#789a91', // Light forest tertiary text
    border: 'rgba(6, 44, 36, 0.09)',
    borderSoft: 'rgba(6, 44, 36, 0.04)',
    glow: { a: '15,118,110', b: '20,184,166' },
    chromeTint: '216,227,218',
    cardShadow: 'rgba(6, 44, 36, 0.06)',
  },

  // --- 6. DARK CYBER / TOKYO NIGHT (Neon Violet & Sky Blue) ---
  tokyoNight: {
    label: { en: 'Tokyo Night', ar: 'طوكيو' },
    isLight: false,
    ground: '#0f0f17',
    surface: '#161622',
    surfaceAlt: '#1f1f30',
    accent1: '#7aa2f7', // Electric blue
    accent2: '#bb9af7', // Neon lavender
    fab: '#7aa2f7',
    buttonText: '#0f0f17',
    textPrimary: '#c0caf5',
    textSecondary: '#787c99',
    textTertiary: '#444b6a',
    border: 'rgba(255,255,255,0.08)',
    borderSoft: 'rgba(255,255,255,0.04)',
    glow: { a: '122,162,247', b: '187,154,247' },
    chromeTint: '31,31,48',
    cardShadow: 'rgba(0,0,0,0.6)',
  },

  // --- 7. DARK LUSH FOREST (Emerald Obsidian) ---
  emerald: {
    label: { en: 'Emerald', ar: 'زمرد' },
    isLight: false,
    ground: '#05120c',
    surface: '#0a1f16',
    surfaceAlt: '#102d20',
    accent1: '#059669', // Emerald green
    accent2: '#34d399', // Bright mint glow
    fab: '#059669',
    buttonText: '#ffffff',
    textPrimary: '#f0fdf4',
    textSecondary: '#86efac',
    textTertiary: '#374151',
    border: 'rgba(255,255,255,0.08)',
    borderSoft: 'rgba(255,255,255,0.04)',
    glow: { a: '5,150,105', b: '52,211,153' },
    chromeTint: '10,31,22',
    cardShadow: 'rgba(0,0,0,0.6)',
  },

  // --- 8. DARK WARM BRONZE (Amber Coffee & Gold Glow) ---
  amberGlow: {
    label: { en: 'Amber Glow', ar: 'وهج الكهرمان' },
    isLight: false,
    ground: '#120a04',
    surface: '#1c1208',
    surfaceAlt: '#2a1b0d',
    accent1: '#d97706', // Deep bronze amber
    accent2: '#fbbf24', // Warm metallic gold
    fab: '#d97706',
    buttonText: '#ffffff',
    textPrimary: '#fffbeb',
    textSecondary: '#fde68a',
    textTertiary: '#78350f',
    border: 'rgba(255,255,255,0.08)',
    borderSoft: 'rgba(255,255,255,0.04)',
    glow: { a: '217,119,6', b: '251,191,36' },
    chromeTint: '28,18,8',
    cardShadow: 'rgba(0,0,0,0.6)',
  },

  // --- 9. TRUE OLED BLACK (Monochrome Pitch Black) ---
  oledBlack: {
    label: { en: 'OLED Black', ar: 'أسود مطلق' },
    isLight: false,
    ground: '#000000', // Pure pitch black for OLED battery saving
    surface: '#0c0c0e',
    surfaceAlt: '#16161a',
    accent1: '#38bdf8', // Electric sky blue
    accent2: '#818cf8', // Vibrant indigo
    fab: '#38bdf8',
    buttonText: '#000000',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    textTertiary: '#475569',
    border: 'rgba(255,255,255,0.12)',
    borderSoft: 'rgba(255,255,255,0.05)',
    glow: { a: '56,189,248', b: '129,140,248' },
    chromeTint: '12,12,14',
    cardShadow: 'rgba(0,0,0,0.8)',
  },

  // --- 10. DARK VELVET ROSÉ (Muted Rosé & Crimson) ---
  rosePine: {
    label: { en: 'Velvet Rosé', ar: 'مخملي وردي' },
    isLight: false,
    ground: '#120b10',
    surface: '#1d121b',
    surfaceAlt: '#2a1a27',
    accent1: '#e11d48', // Dusky crimson
    accent2: '#f43f5e', // Coral blush
    fab: '#e11d48',
    buttonText: '#ffffff',
    textPrimary: '#fff1f2',
    textSecondary: '#fecdd3',
    textTertiary: '#881337',
    border: 'rgba(255,255,255,0.08)',
    borderSoft: 'rgba(255,255,255,0.04)',
    glow: { a: '225,29,72', b: '244,63,94' },
    chromeTint: '29,18,27',
    cardShadow: 'rgba(0,0,0,0.6)',
  },
} as const;

export type ThemeId = keyof typeof THEMES;
export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const DEFAULT_THEME_ID: ThemeId = 'obsidian';

export type ThemeShape = (typeof THEMES)[ThemeId];

export function getTheme(id: ThemeId): ThemeShape {
  return THEMES[id] ?? THEMES[DEFAULT_THEME_ID];
}

export const SEMANTIC = { positive: '#10b981', negative: '#f43f5e' };

// Google Fonts via @expo-google-fonts/*
export const FONTS = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  displayRegular: 'Fraunces_400Regular',
  body: 'Manrope_500Medium',
  bodyBold: 'Manrope_700Bold',
  bodyRegular: 'Manrope_400Regular',
  arabic: 'IBMPlexSansArabic_500Medium',
  arabicBold: 'IBMPlexSansArabic_700Bold',
  arabicRegular: 'IBMPlexSansArabic_400Regular',
};

// TEXT/BORDER/GLASS (the static, non-theme-aware versions) are deliberately
// gone, not just deprecated — they were each a snapshot of Obsidian's colors
// computed once at module load, so any component still reading them stayed
// pinned to dark-theme values forever regardless of which theme was active.
// That's what made every light theme render with near-invisible text: a
// light ground with `theme.textPrimary` still painting Obsidian's near-white.
// Read `theme.textPrimary`/`textSecondary`/`textTertiary`/`border`/
// `borderSoft` directly (via `useTheme()`), and `getThemeGlass(theme)` for
// the color parts of the glass treatment. `ANDROID_BLUR_METHOD`,
// `GLASS_BLUR_INTENSITY`, and `GLASS_TINT_ALPHA` below are the only pieces
// of the old GLASS object that were never colors and don't vary by theme, so
// they're kept as plain constants.

export const ANDROID_BLUR_METHOD = 'dimezisBlurViewSdk31Plus' as const;
export const GLASS_BLUR_INTENSITY = 20;
export const GLASS_TINT_ALPHA = 0.35;

// Dynamic helper to construct theme-aware Glass & Card styles for UI components
export function getThemeGlass(theme: ThemeShape) {
  if (theme.isLight) {
    return {
      border: theme.border,
      gradientTop: 'rgba(255,255,255,0.85)',
      gradientBottom: 'rgba(255,255,255,0.45)',
      cardGradientTop: 'rgba(255,255,255,0.95)',
      surfaceWash: 'rgba(0,0,0,0.02)',
      overlay: 'rgba(15,23,42,0.45)',
      shadow: {
        shadowColor: theme.cardShadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      },
    };
  }
  return {
    border: theme.border,
    gradientTop: 'rgba(255,255,255,0.09)',
    gradientBottom: 'rgba(255,255,255,0.03)',
    cardGradientTop: 'rgba(255,255,255,0.05)',
    surfaceWash: 'rgba(255,255,255,0.02)',
    overlay: 'rgba(2,6,16,0.72)',
    shadow: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 6,
    },
  };
}

// Locked radii
export const RADII = {
  pill: 999,
  sheet: 28,
  card: 22,
  statCard: 18,
  txList: 20,
  quickChip: 16,
  field: 16,
  tileSm: 11,
  tileLg: 14,
  iconTile: 8,
};
