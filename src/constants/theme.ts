// FROZEN — do not edit without explicit user sign-off (see CLAUDE.md rule 3).
// Exact values transcribed from docs/PHASES.md (Phase 1) and the approved
// design preview (theme-studio.html). Every component in src/components/ui/
// reads colors/radii from this file only.

export const THEMES = {
  platinum: {
    label: { en: 'Platinum', ar: 'بلاتين' },
    ground: '#0c0e11',
    surface: '#14171c',
    surfaceAlt: '#1b1f26',
    accent1: '#9fb0c4',
    accent2: '#e3e8ee',
    fab: '#9fb0c4',
    buttonText: '#0d1013',
    glow: { a: '159,176,196', b: '227,232,238' },
  },
  emerald: {
    label: { en: 'Emerald', ar: 'زمرد' },
    ground: '#070f0c',
    surface: '#0d1a15',
    surfaceAlt: '#12231c',
    accent1: '#0f9d6c',
    accent2: '#4fe3ab',
    fab: '#14b881',
    buttonText: '#f3fff9',
    glow: { a: '15,157,108', b: '79,227,171' },
  },
  obsidian: {
    label: { en: 'Obsidian', ar: 'أوبسيديان' },
    ground: '#040405',
    surface: '#08090b',
    surfaceAlt: '#0e1013',
    accent1: '#3c4fc4',
    accent2: '#aebdf5',
    fab: '#3c4fc4',
    buttonText: '#ffffff',
    glow: { a: '60,79,196', b: '174,189,245' },
  },
  sapphire: {
    label: { en: 'Sapphire', ar: 'سفير' },
    ground: '#060a14',
    surface: '#0c1426',
    surfaceAlt: '#111c34',
    accent1: '#2f6fff',
    accent2: '#00e0e0',
    fab: '#2f6fff',
    buttonText: '#ffffff',
    glow: { a: '47,111,255', b: '0,224,224' },
  },
} as const;

export type ThemeId = keyof typeof THEMES;
export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const DEFAULT_THEME_ID: ThemeId = 'platinum';

export const SEMANTIC = { positive: '#34d399', negative: '#fb7185' };

// Google Fonts via @expo-google-fonts/*: Fraunces (400/600/700), Manrope (400-800), IBM Plex Sans Arabic (400-700).
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

// Shared text/border tokens — identical across all 4 palettes (theme-studio.html :root).
export const TEXT = {
  primary: '#f3efe8',
  secondary: '#a59a8a',
  tertiary: '#6b6255',
};

export const BORDER = {
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.05)',
};

// Structural glassmorphism overlays — same across all themes, layered over BlurView (rule 8).
export const GLASS = {
  headerBorder: 'rgba(255,255,255,0.10)',
  headerGradientTop: 'rgba(255,255,255,0.09)',
  headerGradientBottom: 'rgba(255,255,255,0.03)',
  navBorder: 'rgba(255,255,255,0.09)',
  navGradientTop: 'rgba(255,255,255,0.07)',
  navGradientBottom: 'rgba(255,255,255,0.02)',
  cardGradientTop: 'rgba(255,255,255,0.05)',
  hairline: 'rgba(255,255,255,0.08)',
  hairlineSoft: 'rgba(255,255,255,0.05)',
  overlay: 'rgba(2,6,16,0.72)',
  surfaceWash: 'rgba(255,255,255,0.02)',
};

// Locked radii (docs/PHASES.md Phase 1 scope + design preview component measurements).
export const RADII = {
  pill: 999,
  sheet: 28, // sheet top corners
  card: 22,
  statCard: 18,
  txList: 20,
  quickChip: 16,
  field: 16,
  tileSm: 11, // small icon/logo tiles, back button
  tileLg: 14, // theme tile, seg btn container
  iconTile: 8, // settings row icon tile
};

export type ThemeShape = (typeof THEMES)[ThemeId];

export function getTheme(id: ThemeId): ThemeShape {
  return THEMES[id] ?? THEMES[DEFAULT_THEME_ID];
}
