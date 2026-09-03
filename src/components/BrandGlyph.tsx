import React from 'react';
import Svg, { Path } from 'react-native-svg';

import { findBrandIcon } from '@/constants/brandIcons';

interface BrandGlyphProps {
  slug: string;
  size?: number;
  /** Overrides the brand's own hex color when provided. */
  color?: string;
}

/** Renders a curated simple-icons brand mark as SVG path data (CLAUDE.md rule 7) — no icon files, no transformer. */
export function BrandGlyph({ slug, size = 16, color }: BrandGlyphProps) {
  const icon = findBrandIcon(slug);
  if (!icon) return null;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={icon.path} fill={color ?? `#${icon.hex}`} />
    </Svg>
  );
}
