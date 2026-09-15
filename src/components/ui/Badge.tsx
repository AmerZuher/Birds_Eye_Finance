import React from 'react';
import { Pressable, Text } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import type { ThemeShape } from '@/constants/theme';
import { RADII, SEMANTIC } from '@/constants/theme';
import { withAlpha } from '@/utils/color';

export type BadgeVariant = 'neutral' | 'accent' | 'positive' | 'warning' | 'negative';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

function badgeColors(variant: BadgeVariant, theme: ThemeShape): { bg: string; fg: string } {
  switch (variant) {
    case 'accent':
      return { bg: `rgba(${theme.glow.a},0.16)`, fg: theme.accent2 };
    case 'positive':
      return { bg: withAlpha(SEMANTIC.positive, 0.16), fg: SEMANTIC.positive };
    case 'warning':
      return { bg: withAlpha(SEMANTIC.warning, 0.16), fg: SEMANTIC.warning };
    case 'negative':
      return { bg: withAlpha(SEMANTIC.negative, 0.16), fg: SEMANTIC.negative };
    default:
      // A faint wash of the theme's own text color — reads as a neutral chip on
      // dark and light themes alike (dark themes need slightly more of it).
      return {
        bg: withAlpha(theme.textPrimary, theme.isLight ? 0.04 : 0.06),
        fg: theme.textSecondary,
      };
  }
}

/** Category/period/status pill — read-only. Status tones come from SEMANTIC, so every status pill in the app (Open / Partially paid / Paid) shares one look. */
export function Badge({ label, variant = 'neutral' }: BadgeProps) {
  const { theme } = useTheme();
  const { bg, fg } = badgeColors(variant, theme);

  return (
    <Text
      style={{
        fontSize: 8.5,
        fontWeight: '700',
        paddingVertical: 2,
        paddingHorizontal: 7,
        borderRadius: RADII.pill,
        overflow: 'hidden',
        backgroundColor: bg,
        color: fg,
      }}
    >
      {label}
    </Text>
  );
}

interface FilterChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  /** Leading glyph — an icon or brand mark (e.g. a person's contact chips). */
  leading?: React.ReactNode;
  /** Dashed outline for an "add something" chip. */
  dashed?: boolean;
  /** Keep the label left-to-right in Arabic too (phone numbers, email addresses). */
  ltr?: boolean;
  accessibilityLabel?: string;
}

/** Tappable chip variant of Badge — category filters, and a person's contact chips. */
export function FilterChip({
  label,
  active,
  onPress,
  leading,
  dashed,
  ltr,
  accessibilityLabel,
}: FilterChipProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: RADII.pill,
        backgroundColor: active ? theme.accent1 : theme.surface,
        borderWidth: active ? 0 : 1,
        borderStyle: dashed ? 'dashed' : 'solid',
        borderColor: theme.border,
      }}
    >
      {leading ?? null}
      <Text
        style={{
          fontSize: 10.5,
          fontWeight: '700',
          color: active ? theme.buttonText : theme.textSecondary,
          ...(ltr ? { writingDirection: 'ltr' as const } : null),
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
