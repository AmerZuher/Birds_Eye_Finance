import React from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/context/ThemeContext';
import { useCurrency } from '@/context/CurrencyContext';
import { FONTS, RADII, TEXT } from '@/constants/theme';

const labelStyle = {
  fontSize: 10,
  fontWeight: '700' as const,
  letterSpacing: 1.5,
  textTransform: 'uppercase' as const,
  color: TEXT.tertiary,
};

// Integer stays at the size the amount has always been; symbol and decimal
// are typed down from that baseline rather than the other way around, so the
// integer is still what a glance lands on first.
const INTEGER_SIZE = 40;
const SYMBOL_SIZE = 13;
const DECIMAL_SIZE = 16;
const DECIMAL_OPACITY = 0.55;

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

const GLOW_SIZE = 180;

/** One soft radial blob — a smooth center-to-transparent fade stands in for a
 * true Gaussian blur (RN has no `filter: blur()` for a plain color shape),
 * and reads just as soft at this size. */
function GlowBlob({ color, corner }: { color: string; corner: 'topStart' | 'bottomEnd' }) {
  const id = `glow-${corner}`;
  return (
    <Svg
      width={GLOW_SIZE}
      height={GLOW_SIZE}
      style={[
        { position: 'absolute' },
        // Purely decorative ambient lighting, not directional UI — left/right
        // corners rather than RTL start/end (same exception rule 9 already
        // makes for the FAB's fixed position).
        corner === 'topStart' ? { top: -GLOW_SIZE * 0.4, left: -GLOW_SIZE * 0.35 } : null,
        corner === 'bottomEnd' ? { bottom: -GLOW_SIZE * 0.45, right: -GLOW_SIZE * 0.3 } : null,
      ]}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={0.32} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

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
 * Balance. Same locale-aware amount as useCurrency's formatMoney (via
 * formatMoneyParts, not a re-derivation), just typed as three differently
 * weighted runs instead of one flat string:
 *  - a dual-layer ambient glow — two soft radial blobs in accent1/accent2 at
 *    low opacity, tucked into opposite corners and clipped by the card
 *  - a theme-tinted border instead of a neutral hairline
 *  - a wider-tracked micro label
 *  - a soft, low-intensity ambient shadow lifting the card off the page
 *  - the currency symbol smaller than the amount, and the decimal portion
 *    smaller and dimmed relative to the integer
 * One shared component so both screens' hero card looks and evolves
 * identically.
 */
export function MoneyStatCard({ label, amount, currencyCode, color, footer }: MoneyStatCardProps) {
  const { theme } = useTheme();
  const { formatMoneyParts } = useCurrency();
  const parts = formatMoneyParts(amount, currencyCode);
  const valueColor = color ?? TEXT.primary;

  // Mirrors formatMoney's own sign placement exactly (English: "-SAR 1,234.56";
  // Arabic: "1,234.56- ر.س").
  //
  // One single Text tree with nested runs, not a flex `row` of sibling Text
  // elements — that was the actual bug. A flex row containing multiple
  // differently-sized Text siblings can have its own intrinsic width
  // misreported on Android (worse on short strings, since a long string's
  // true width already happens to be close to whatever Android
  // over-measured, hiding the bug), which left `justifyContent: 'center'`
  // centering nothing while the real glyphs sat flush left. A single Text
  // with nested runs is exactly how `label` above already renders — and that
  // one has never had a centering problem — so this collapses the amount
  // into the same reliable shape and centers it the same simple way, via the
  // parent's `alignItems: 'center'`, no row/flex involved at all.
  //
  // FONTS.display — the same font the rest of the app already uses for money
  // (ExpenseRow's own amount text) and screen titles. It's a real
  // named-weight font file (Fraunces_600SemiBold), so there's no numeric
  // fontWeight stacked on top to risk synthetic-bold mismeasurement; the
  // decimal uses the Regular file for its de-emphasis instead.
  const symbolRun = (
    <Text style={{ fontSize: SYMBOL_SIZE, fontFamily: FONTS.display, color: valueColor }}>
      {parts.symbolFirst && parts.isNegative ? '-' : ''}
      {parts.symbol}
    </Text>
  );
  const amountBlock = (
    <Text style={{ textAlign: 'center' }}>
      {parts.symbolFirst ? symbolRun : null}
      {parts.symbolFirst ? ' ' : ''}
      <Text style={{ fontSize: INTEGER_SIZE, fontFamily: FONTS.display, color: valueColor }}>
        {parts.integer}
      </Text>
      <Text
        style={{
          fontSize: DECIMAL_SIZE,
          fontFamily: FONTS.displayRegular,
          color: valueColor,
          opacity: DECIMAL_OPACITY,
        }}
      >
        .{parts.decimal}
        {!parts.symbolFirst && parts.isNegative ? '-' : ''}
      </Text>
      {!parts.symbolFirst ? ' ' : ''}
      {!parts.symbolFirst ? symbolRun : null}
    </Text>
  );

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
            <Text style={labelStyle}>{label}</Text>
          </View>
          {/* Explicit width, not shrink-wrap-then-center-by-parent — Android
              can misjudge a mixed-font-size nested-run Text's own intrinsic
              width (this is the actual bug: it was never about flex vs.
              single-Text, it's about relying on Yoga to *measure* text with
              multiple sizes in it at all). A definite-width box makes
              `textAlign: 'center'` a plain text-layout operation instead of
              depending on that measurement. The margin is equal top and
              bottom — an asymmetric one here would push the number off the
              centre line just as surely as unequal slots would. */}
          <View style={{ width: '100%', marginVertical: 4 }}>{amountBlock}</View>
          <View style={{ minHeight: SIDE_SLOT_HEIGHT, justifyContent: 'center' }}>{footer}</View>
        </LinearGradient>
      </View>
    </View>
  );
}
