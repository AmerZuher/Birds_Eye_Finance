import React from 'react';
import { Pressable, Text } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';
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
   * 'outline' (default): full-width button — a theme-tinted secondary action alongside
   * GradientButton (e.g. Cancel), or a meaning-colored action when `color` is set.
   * 'link': borderless, content-width text action ("Change", "Delete Debt").
   * 'caption': a small, muted, start-aligned text link for fine print — e.g. a
   * data provider's attribution.
   * 'pill': full-width rounded pill — the About page's contact, support and
   * repository buttons.
   */
  variant?: 'outline' | 'link' | 'caption' | 'pill';
  /** Pill only, when no `color` is set: 'accent' (default) tints it with the theme accent; 'neutral' is a quiet surface pill. */
  tone?: 'accent' | 'neutral';
  /** Caption only: where the line sits (default 'start') — 'center' for a centered footnote, e.g. About's rates attribution. */
  align?: 'start' | 'center';
  accessibilityLabel?: string;
}

interface Look {
  container: ViewStyle;
  foreground: string;
  /** The leading icon's color when it differs from the label's. */
  iconColor?: string;
  trailingColor: string;
  iconSize: number;
  iconStroke?: number;
  trailingSize: number;
  fontSize: number;
  fontWeight?: TextStyle['fontWeight'];
}

/** Outline, link, caption and pill buttons — one implementation for every secondary action in the app. */
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
  align = 'start',
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
  } else if (variant === 'caption') {
    const foreground = color ?? theme.textTertiary;
    look = {
      container: {
        ...row,
        alignSelf: align === 'center' ? 'center' : 'flex-start',
        gap: 3,
        opacity,
      },
      foreground,
      trailingColor: foreground,
      iconSize: 11,
      iconStroke: 2.2,
      trailingSize: 10,
      fontSize: 10.5,
      fontWeight: '500',
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
    // Outline. Without `color`: a light wash and hairline of the theme's own glow
    // color with an accent icon — the same material as IconButton's tinted variant,
    // so a plain secondary action (Cancel, Import from Contacts) carries the theme.
    // It used to be a colorless white wash, which read as flat grey on every colored
    // theme. With `color`: a soft wash of the meaning color with a matching border —
    // same recipe as the large SegmentedControl's selected option.
    const foreground = color ?? theme.textPrimary;
    look = {
      container: {
        ...row,
        width: '100%',
        gap: 8,
        paddingVertical: 14,
        borderRadius: RADII.field,
        backgroundColor: color ? withAlpha(color, 0.1) : `rgba(${theme.glow.a},0.1)`,
        borderWidth: 1,
        borderColor: color ? withAlpha(color, 0.35) : `rgba(${theme.glow.a},0.28)`,
        opacity,
      },
      foreground,
      iconColor: color ?? theme.accent2,
      trailingColor: foreground,
      iconSize: 15,
      iconStroke: 2.4,
      trailingSize: 14,
      fontSize: 14,
    };
  }

  const textLink = variant === 'link' || variant === 'caption';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={variant === 'caption' ? 'link' : 'button'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={textLink ? 8 : undefined}
      style={look.container}
    >
      {leading ??
        (Icon ? (
          <Icon
            size={look.iconSize}
            color={look.iconColor ?? look.foreground}
            strokeWidth={look.iconStroke}
          />
        ) : null)}
      <Text
        numberOfLines={variant === 'caption' ? 1 : undefined}
        style={{
          color: look.foreground,
          fontWeight: look.fontWeight ?? '700',
          fontSize: look.fontSize,
        }}
      >
        {label}
      </Text>
      {TrailingIcon ? <TrailingIcon size={look.trailingSize} color={look.trailingColor} /> : null}
    </Pressable>
  );
}
