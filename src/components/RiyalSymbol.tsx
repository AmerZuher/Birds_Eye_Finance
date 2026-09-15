import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/context/ThemeContext';

// Path data copied verbatim from assets/Saudi_Riyal_Symbol.svg (SAMA's
// official mark) — not retyped/approximated. See RiyalSymbol below for why
// this has to be a drawn shape rather than the Unicode character (U+20C1)
// as text.
const VIEWBOX = '0 0 1124.14 1256.39';
const PATHS = [
  'M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z',
  'M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z',
];
// viewBox is 1124.14 × 1256.39 — not square, taller than wide.
const ASPECT = 1124.14 / 1256.39;

interface RiyalSymbolProps {
  /** Rendered height in px — width derives from the mark's own aspect
   * ratio, not a caller-supplied value, so it never renders distorted. */
  size?: number;
  color?: string;
}

/**
 * The official Saudi Riyal currency symbol (SAMA, 2025) as SVG path data.
 * No font — not even system fallback fonts — ships U+20C1 yet, so the
 * Unicode character renders as a missing-glyph box on real devices. Same
 * fix as BrandGlyph uses for brand marks lucide/simple-icons don't cover
 * as an icon font (CLAUDE.md rule 7): draw it instead of relying on text.
 */
export function RiyalSymbol({ size = 16, color }: RiyalSymbolProps) {
  const { theme } = useTheme();
  const fill = color ?? theme.textPrimary;
  return (
    <Svg width={size * ASPECT} height={size} viewBox={VIEWBOX}>
      {PATHS.map((d) => (
        <Path key={d} d={d} fill={fill} />
      ))}
    </Svg>
  );
}
