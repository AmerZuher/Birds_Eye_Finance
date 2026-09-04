import React from 'react';
import { Pressable, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { TEXT } from '@/constants/theme';

interface IconButtonProps {
  icon: LucideIcon;
  onPress?: () => void;
  accessibilityLabel: string;
  size?: number;
  iconSize?: number;
  color?: string;
  /**
   * 'surface': the plain neutral chip used for inline row actions (edit,
   * delete, chevron) — deliberately unbranded so it doesn't compete with
   * whatever list content it sits next to.
   * 'tinted': theme.glow.a background/border, same alpha values already used
   * for the Settings row icon tiles (0.16) and the Debts installment pill's
   * border (0.28) — reused rather than invented so this reads as the same
   * material, not a new one. For section-level navigation actions that sit
   * directly on the glass chrome (back, history) — everywhere else in that
   * chrome (GlassHeader's border, Navbar's edge stroke, MoneyStatCard's
   * border) already ties itself to theme.glow, and 'surface' was the one
   * piece that didn't, which is what made these particular buttons read as
   * generic rather than part of the app.
   * 'ghost': no background/border at all.
   */
  variant?: 'ghost' | 'surface' | 'tinted';
  /** Mirror the icon horizontally in RTL — for back arrows / chevrons. */
  directional?: boolean;
}

/**
 * Circular icon tap target — back/edit/delete/chevron — with RTL flip built
 * in. Default size=40/iconSize=20 (a 50% glyph-to-target ratio, same
 * proportion iOS's ~44pt and Material's ~48dp icon-button guidance both use,
 * just scaled to this app's more compact chrome) — moved up from 32/16 so
 * the default reads as a normal-sized nav icon button rather than a small
 * one padded out to an accessible tap size via `hitSlop` alone. Explicit
 * per-call sizes (the 28/12-13 edit/delete buttons, the 22/11 decorative
 * chevrons) are unaffected by this and stay smaller on purpose — this only
 * changes call sites that don't override size/iconSize, which is every
 * back/history button in the app (Header, ContactsPicker, Debts).
 */
export function IconButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  size = 40,
  iconSize = 20,
  color,
  variant = 'surface',
  directional = false,
}: IconButtonProps) {
  const { isRTL } = useLanguage();
  const { theme } = useTheme();

  const background =
    variant === 'surface'
      ? 'rgba(255,255,255,0.08)'
      : variant === 'tinted'
        ? `rgba(${theme.glow.a},0.16)`
        : 'transparent';
  const border =
    variant === 'surface'
      ? 'rgba(255,255,255,0.12)'
      : variant === 'tinted'
        ? `rgba(${theme.glow.a},0.28)`
        : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={{
        width: size,
        height: size,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: background,
        borderWidth: variant === 'ghost' ? 0 : 1,
        borderColor: border,
      }}
    >
      <View style={directional && isRTL ? { transform: [{ scaleX: -1 }] } : undefined}>
        <Icon
          size={iconSize}
          color={color ?? (variant === 'tinted' ? theme.accent2 : TEXT.primary)}
          strokeWidth={2.4}
        />
      </View>
    </Pressable>
  );
}
