import React from 'react';
import { Pressable, Text } from 'react-native';
import type { ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/context/ThemeContext';
import { RADII } from '@/constants/theme';
import { withAlpha } from '@/utils/color';

interface SecondaryButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  icon?: LucideIcon;
  /** Replaces `icon` with any leading glyph — e.g. a BrandGlyph for a third-party service. */
  leading?: React.ReactNode;
  /** A glyph after the label — e.g. ExternalLink on a button that leaves the app. */
  trailingIcon?: LucideIcon;
  /**
   * Gives the button a meaning color: the label, icon, and (outline/pill) a soft
   * fill and border of it — e.g. SEMANTIC.positive for "Record payment",
   * SEMANTIC.negative for a destructive link.
   */
  color?: string;
  /**
   * 'outline' (default): full-width button — a neutral ghost alongside GradientButton
   * (e.g. Cancel), or a tinted action when `color` is set.
   * 'link': borderless, content-width text action ("Change", "Delete Debt").
   * 'pill': full-width rounded pill — the About page's contact, support and
   * repository buttons.
   */
  variant?: 'outline' | 'link' | 'pill';
  /** Pill only, when no `color` is set: 'accent' (default) tints it with the theme accent; 'neutral' is a quiet surface pill. */
  tone?: 'accent' | 'neutral';
  accessibilityLabel?: string;
}

interface Look {
  container: ViewStyle;
  foreground: string;
  trailingColor: string;
  iconSize: number;
  iconStroke?: number;
  trailingSize: number;
  fontSize: number;
}

/** Outline, link and pill buttons — one implementation for every secondary action in the app. */
export function SecondaryButton({
  label,
  onPress,
  disabled,
  icon: Icon,
  leading,
  trailingIcon: TrailingIcon,
  color,
  variant = 'outline',
  tone = 'accent',
  accessibilityLabel,
}: SecondaryButtonProps) {
  const { theme } = useTheme();
  const opacity = disabled ? 0.5 : 1;
  const row = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  } as const;

  let look: Look;
  if (variant === 'link') {
    const foreground = color ?? theme.accent2;
    look = {
      container: { ...row, alignSelf: 'center', gap: 6, paddingVertical: 4, opacity },
      foreground,
      trailingColor: foreground,
      iconSize: 14,
      iconStroke: 2.4,
      trailingSize: 13,
      fontSize: 12.5,
    };
  } else if (variant === 'pill' && (color || tone === 'accent')) {
    // A soft wash of the tint with a matching hairline. Without an explicit
    // color it's the theme's accent pill (glow wash, accent2 label).
    const foreground = color ?? theme.accent2;
    look = {
      container: {
        ...row,
        width: '100%',
        gap: 8,
        paddingVertical: 13,
        borderRadius: RADII.pill,
        backgroundColor: color ? withAlpha(color, 0.14) : `rgba(${theme.glow.a},0.14)`,
        borderWidth: 1,
        borderColor: color ? withAlpha(color, 0.3) : `rgba(${theme.glow.a},0.3)`,
        opacity,
      },
      foreground,
      trailingColor: foreground,
      iconSize: 15,
      trailingSize: 14,
      fontSize: 12.5,
    };
  } else if (variant === 'pill') {
    // Neutral: a surface slightly recessed into its card.
    look = {
      container: {
        ...row,
        width: '100%',
        gap: 10,
        paddingVertical: 14,
        borderRadius: RADII.pill,
        backgroundColor: theme.isLight
          ? withAlpha(theme.textPrimary, 0.05)
          : withAlpha(theme.ground, 0.35),
        borderWidth: 1,
        borderColor: theme.border,
        opacity,
      },
      foreground: theme.textPrimary,
      trailingColor: theme.textTertiary,
      iconSize: 15,
      trailingSize: 14,
      fontSize: 13,
    };
  } else {
    // Outline. Neutral: a faint wash of the theme's text color, a ghost button on
    // dark and light surfaces alike. Tinted: a soft wash of the meaning color with
    // a matching border — same recipe as the large SegmentedControl's selected option.
    const foreground = color ?? theme.textPrimary;
    look = {
      container: {
        ...row,
        width: '100%',
        gap: 8,
        paddingVertical: 14,
        borderRadius: RADII.field,
        backgroundColor: color
          ? withAlpha(color, 0.1)
          : withAlpha(theme.textPrimary, theme.isLight ? 0.03 : 0.05),
        borderWidth: 1,
        borderColor: color ? withAlpha(color, 0.35) : theme.border,
        opacity,
      },
      foreground,
      trailingColor: foreground,
      iconSize: 15,
      iconStroke: 2.4,
      trailingSize: 14,
      fontSize: 14,
    };
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={variant === 'link' ? 6 : undefined}
      style={look.container}
    >
      {leading ??
        (Icon ? (
          <Icon size={look.iconSize} color={look.foreground} strokeWidth={look.iconStroke} />
        ) : null)}
      <Text style={{ color: look.foreground, fontWeight: '700', fontSize: look.fontSize }}>
        {label}
      </Text>
      {TrailingIcon ? <TrailingIcon size={look.trailingSize} color={look.trailingColor} /> : null}
    </Pressable>
  );
}
