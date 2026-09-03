/** Converts a `#rrggbb` hex color to an `"r,g,b"` string for use in `rgba(...)`. */
export function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

// Chrome surfaces (header/navbar/FAB/modals) wash their blur with this same
// alpha over `theme.surface` so they read as the exact same material as the
// cards (rule: "match the card theme while staying glassy") — high enough
// that the blurred backdrop barely tints the color, unlike the old
// lower-alpha chromeTint wash which read as a visibly different hue.
export const CHROME_SURFACE_ALPHA = 0.86;
