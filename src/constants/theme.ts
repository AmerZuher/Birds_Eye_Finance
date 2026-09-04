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
    accent1: '#8ba0b8', // Softened from #9fb0c4
    accent2: '#b8c4d1', // Tamed down from harsh white-blue #e3e8ee
    fab: '#8ba0b8',
    buttonText: '#0d1013',
    glow: { a: '115,130,150', b: '160,175,192' }, // Reduced intensity channels
    chromeTint: '70,80,92', // Header/navbar glass tint only — accent1 darkened ~50% toward black
  },
  emerald: {
    label: { en: 'Emerald', ar: 'زمرد' },
    ground: '#070f0c',
    surface: '#0d1a15',
    surfaceAlt: '#12231c',
    accent1: '#128c62', // Slightly deeper emerald
    accent2: '#2aa67c', // Tone down harsh mint #4fe3ab to stable jade
    fab: '#128c62',
    buttonText: '#f3fff9',
    glow: { a: '18,140,98', b: '42,166,124' },
    chromeTint: '9,70,49', // Header/navbar glass tint only — accent1 darkened ~50% toward black
  },
  obsidian: {
    label: { en: 'Obsidian', ar: 'أوبسيديان' },
    ground: '#040405',
    surface: '#08090b',
    surfaceAlt: '#0e1013',
    accent1: '#3747b0', // Softened dark indigo
    accent2: '#7889cb', // Darkened bright violet #aebdf5
    fab: '#3747b0',
    buttonText: '#ffffff',
    glow: { a: '55,71,176', b: '120,137,203' },
    chromeTint: '28,36,88', // Header/navbar glass tint only — accent1 darkened ~50% toward black
  },
  sapphire: {
    label: { en: 'Sapphire', ar: 'سفير' },
    ground: '#060a14',
    surface: '#0c1426',
    surfaceAlt: '#111c34',
    accent1: '#2b5fd9', // Muted deep cobalt
    accent2: '#2892b0', // Replaced neon cyan #00e0e0 with muted teal-slate
    fab: '#2b5fd9',
    buttonText: '#ffffff',
    glow: { a: '43,95,217', b: '40,146,176' },
    chromeTint: '22,48,109', // Header/navbar glass tint only — accent1 darkened ~50% toward black
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

// expo-blur only renders a real blur on Android when `blurMethod` is passed
// explicitly — it defaults to 'none' (a flat translucent View, no actual
// blur). The SDK31+ variant gives a real blur on modern devices and safely
// falls back to 'none' below API 31. Pass this to every BlurView (rule 8).
export const ANDROID_BLUR_METHOD = 'dimezisBlurViewSdk31Plus' as const;

// Structural glassmorphism overlays — same across all themes, layered over BlurView (rule 8).
// GlassHeader and Navbar share this one glass treatment (border, gradient,
// blur intensity, and — most importantly — `tintAlpha`, the alpha at which
// each theme's own `chromeTint` washes over the blur) so the two surfaces
// read as the same material. `chromeTint` is a per-theme RGB triple in
// THEMES, deliberately separate from `glow` (which many other components
// already read for unrelated washes/borders/shadows) — tune it per theme
// there, not here, since each palette needs its own hand-picked value.
export const GLASS = {
  border: 'rgba(255,255,255,0.10)',
  gradientTop: 'rgba(255,255,255,0.09)',
  gradientBottom: 'rgba(255,255,255,0.03)',
  blurIntensity: 20,
  tintAlpha: 0.35,
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
