import React from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/context/ThemeContext';
import { IconTile } from '@/components/ui/IconTile';
import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { FONTS, RADII } from '@/constants/theme';

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  /** Tint used for the icon tile AND the money value (defaults to theme accent). */
  accent?: string;
  /** Plain-text value (e.g. a count) — used when `amount` is not supplied. */
  value?: string;
  /** Money amount — rendered with MoneyAmount's three-tier typography, tinted by `accent`. */
  amount?: number;
  /** Currency code for `amount` (defaults to base currency). */
  currencyCode?: string;
  /** Optional small hint line under the value. */
  hint?: string;
}

/**
 * Compact "icon + label + value" stat tile for dashboards/analytics grids.
 * Money values go through the same MoneyAmount typography as MoneyStatCard
 * (small symbol, full integer, dimmed decimal) so the number reads exactly
 * like the hero card's. Nothing is hardcoded — the value is either a caller
 * string or a numeric amount formatted locale-aware via useCurrency.
 */
export function StatTile({
  icon: Icon,
  label,
  accent,
  value,
  amount,
  currencyCode,
  hint,
}: StatTileProps) {
  const { theme } = useTheme();
  const iconColor = accent ?? theme.accent2;

  return (
    <LinearGradient
      colors={[theme.surfaceAlt, theme.surface]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: RADII.statCard,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 14,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconTile size={32} radius={RADII.iconTile} backgroundColor={`rgba(${theme.glow.a},0.16)`}>
          <Icon size={16} color={iconColor} />
        </IconTile>
      </View>
      <View style={{ gap: 3 }}>
        <Text
          style={{
            fontSize: 9.5,
            fontWeight: '700',
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: theme.textTertiary,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
        {amount !== undefined ? (
          <MoneyAmount
            amount={amount}
            currencyCode={currencyCode}
            color={accent}
            size={26}
            align="left"
            shrinkToFit
          />
        ) : (
          // Matches MoneyAmount's own integer treatment (FONTS.display,
          // same 26 size, tinted by `accent`) even though this isn't money —
          // a bare count previously read as a plain, unstyled afterthought
          // next to the other three bold colored tiles in the same grid.
          <Text
            style={{ fontSize: 26, fontFamily: FONTS.display, color: accent ?? theme.textPrimary }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {value}
          </Text>
        )}
        {hint ? (
          <Text style={{ fontSize: 9.5, color: theme.textTertiary }} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
    </LinearGradient>
  );
}
