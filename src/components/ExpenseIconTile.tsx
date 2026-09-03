import React from 'react';
import { Text } from 'react-native';

import { IconTile } from '@/components/ui/IconTile';
import { BrandGlyph } from '@/components/BrandGlyph';
import { useTheme } from '@/context/ThemeContext';
import { FONTS } from '@/constants/theme';
import { resolveExpenseIcon } from '@/utils/expenseIcon';

interface ExpenseIconTileProps {
  icon: string;
  name: string;
  size?: number;
}

/** Renders an expense's icon — brand logo, generic category icon, or an auto-generated initial-letter tile (CLAUDE.md rule 7: every expense renders *something*). */
export function ExpenseIconTile({ icon, name, size = 34 }: ExpenseIconTileProps) {
  const { theme } = useTheme();
  const resolved = resolveExpenseIcon(icon, name);

  if (resolved.kind === 'brand' && resolved.brandSlug) {
    return (
      <IconTile size={size} tint="surface">
        <BrandGlyph slug={resolved.brandSlug} size={Math.round(size * 0.5)} />
      </IconTile>
    );
  }

  if (resolved.kind === 'lucide' && resolved.LucideIcon) {
    const Icon = resolved.LucideIcon;
    return (
      <IconTile size={size}>
        <Icon size={Math.round(size * 0.48)} color={theme.accent2} />
      </IconTile>
    );
  }

  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <IconTile size={size}>
      <Text style={{ fontFamily: FONTS.display, fontSize: size * 0.4, color: theme.accent2 }}>
        {initial}
      </Text>
    </IconTile>
  );
}
