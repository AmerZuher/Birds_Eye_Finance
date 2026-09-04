import React from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/context/ThemeContext';
import { GlowBlob } from '@/components/ui/GlowBlob';
import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { RADII } from '@/constants/theme';

// Color isn't here — this is a module-level constant (computed once, outside
// any component), so it has no theme to read. `theme.textTertiary` is added
// at the actual usage site below instead.
const labelStyle = {
  fontSize: 10,
  fontWeight: '700' as const,
  letterSpacing: 1.5,
  textTransform: 'uppercase' as const,
};

// The integer's size — MoneyAmount scales the symbol/decimal off this,
// same ratios everywhere it's used.
const INTEGER_SIZE = 40;

// The label above the amount and the footer below it get identical slots, so
// the amount always lands on the card's exact centre line — whatever either
// slot holds, or doesn't. Two things fall out of that:
//
//  - A card without a footer (Expenses' Monthly Total, or Debts' Net Balance
//    with no installments) still commits to the same total height as one with
//    the pill, so the two hero cards read as the same shape everywhere rather
//    than only when their content happens to match.
//  - Adding a footer can't shove the number upward, and a longer label can't
//    shove it down — neither slot is load-bearing for the centring.
//
// Sized off the taller occupant (the installments pill, ~24pt) plus breathing
// room; the label gets the same slot purely to keep the two sides symmetric.
// `minHeight`, not `height`, so a large fontScale grows the card instead of
// clipping the pill.
const SIDE_SLOT_HEIGHT = 32;

interface MoneyStatCardProps {
  label: string;
  amount: number;
  /** Defaults to the base currency, same as useCurrency's formatMoney. */
  currencyCode?: string;
  color?: string;
  /** Extra content below the amount (e.g. Debts' monthly-installment badge). */
  footer?: React.ReactNode;
}

/**
 * The "big number" hero card shared by Expenses' Monthly Total and Debts' Net
 * Balance. The amount typography itself is entirely delegated to
 * `MoneyAmount` — this card used to carry its own independent copy of that
 * exact rendering logic, which is exactly the kind of drift CLAUDE.md rule 4
 * warns about: MoneyAmount picked up fixes (the Riyal SVG glyph, short-symbol
 * sizing) that this card's own copy never got, because it was a second,
 * unsynced implementation. Now there's one source of truth; this component
 * only supplies the card chrome around it:
 *  - a dual-layer ambient glow — two soft radial blobs in accent1/accent2 at
 *    low opacity, tucked into opposite corners and clipped by the card
 *  - a theme-tinted border instead of a neutral hairline
 *  - a wider-tracked micro label
 *  - a soft, low-intensity ambient shadow lifting the card off the page
 * One shared component so both screens' hero card looks and evolves
 * identically.
 */
export function MoneyStatCard({ label, amount, currencyCode, color, footer }: MoneyStatCardProps) {
  const { theme } = useTheme();
  const valueColor = color ?? theme.textPrimary;

  return (
    // Outer view carries the shadow against a solid, matching background —
    // Android's `elevation` shadow follows a view's own opaque background,
    // not a clipped gradient child's, so it has to live here.
    <View
      style={{
        borderRadius: RADII.card,
        backgroundColor: theme.surface,
        shadowColor: `rgb(${theme.glow.a})`,
        shadowOpacity: 0.22,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      }}
    >
      <View
        style={{
          borderRadius: RADII.card,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: `rgba(${theme.glow.a},0.22)`,
        }}
      >
        <LinearGradient
          colors={[theme.surfaceAlt, theme.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingVertical: 20, paddingHorizontal: 20, alignItems: 'center' }}
        >
          <GlowBlob color={`rgb(${theme.glow.a})`} corner="topStart" />
          <GlowBlob color={`rgb(${theme.glow.b})`} corner="bottomEnd" />
          <View style={{ minHeight: SIDE_SLOT_HEIGHT, justifyContent: 'center' }}>
            <Text style={[labelStyle, { color: theme.textTertiary }]}>{label}</Text>
          </View>
          {/* Explicit width, not shrink-wrap-then-center-by-parent — Android
              can misjudge a mixed-font-size nested-run Text's own intrinsic
              width. MoneyAmount's own centering already relies on this same
              definite-width-box pattern internally, so wrapping it here too
              keeps it consistent rather than fighting it. */}
          <View style={{ width: '100%', marginVertical: 4 }}>
            <MoneyAmount
              amount={amount}
              currencyCode={currencyCode}
              color={valueColor}
              size={INTEGER_SIZE}
              align="center"
            />
          </View>
          <View style={{ minHeight: SIDE_SLOT_HEIGHT, justifyContent: 'center' }}>{footer}</View>
        </LinearGradient>
      </View>
    </View>
  );
}
