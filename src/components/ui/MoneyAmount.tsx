import React from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import { useCurrency } from '@/context/CurrencyContext';
import { RiyalSymbol } from '@/components/RiyalSymbol';
import { FONTS } from '@/constants/theme';

// A faithful port of MoneyStatCard's money typography — the *exact* sizes it
// uses at full scale (symbol 13, integer 40, decimal 16, decimal opacity
// 0.55), expressed as ratios of the integer size so the shared component can
// render at any size while staying pixel-identical to MoneyStatCard at 40.
const SYMBOL_RATIO = 13 / 40;
// A lone glyph ($, €, ₪) reads lighter than a 3-letter code (KWD, USD) even
// at the *identical* point size — it's one thin shape instead of three
// characters' worth of ink, so matching the point size isn't enough to
// match the perceived weight. Short symbols (≤2 characters) get a
// noticeably bigger ratio, not just a bigger floor, to actually compensate.
const SHORT_SYMBOL_RATIO = 24 / 40;
// The Riyal glyph is a full drawn mark, not a font character riding the
// same cap-height as everything else — it needs to be bigger again than
// even the short-text-symbol bump above to read with real presence next to
// a bold number, not as an afterthought.
const RIYAL_RATIO = 30 / 40;
const DECIMAL_RATIO = 16 / 40;
const DECIMAL_OPACITY = 0.55;
// Pure ratios break down at small overall sizes — 0.325 of a 14px integer is
// ~4.5px, unreadable on a phone regardless of how mathematically consistent
// the ratio is. Two floors, not one: short symbols get a higher floor than
// text codes for the same reason their ratio is bigger — matching point
// size still isn't matching perceived weight, so they need a bigger number.
const MIN_SYMBOL_SIZE = 11;
const MIN_SHORT_SYMBOL_SIZE = 14;
const MIN_DECIMAL_SIZE = 10;

// The official Saudi Riyal symbol (U+20C1) isn't in any shipped font yet —
// not even system fallback fonts — so it renders as a missing-glyph box on
// real devices. currencies.ts sets both symbolAr/symbolEn to this character;
// MoneyAmount detects it here and swaps in the drawn RiyalSymbol instead of
// treating it as displayable text.
const RIYAL_SYMBOL = '⃁';

interface MoneyAmountProps {
  amount: number;
  /** Defaults to the base currency, same as useCurrency's formatMoney. */
  currencyCode?: string;
  color?: string;
  /** The integer's font size — symbol and decimal scale from it (default 40). */
  size?: number;
  /** Text alignment of the whole amount block. */
  align?: 'left' | 'center' | 'right';
  /** Truncate to one line (for fixed-width slots, e.g. compact tiles). */
  numberOfLines?: number;
  /** Scale the font down to stay within the parent's width instead of
   * wrapping/overflowing — for slots with a hard width ceiling (e.g. a
   * DonutChart's center) where a big number must never spill past it. */
  shrinkToFit?: boolean;
  /** Replace the integer/decimal digits with a fixed-length dot run (real
   * currency symbol stays visible). Fixed-length, not sized off the real
   * digit count — matching the digit count would leak the balance's rough
   * magnitude even while "hidden", which defeats the point of masking. */
  masked?: boolean;
}

/**
 * The "big number" money typography from MoneyStatCard, made reusable: the
 * currency symbol smaller than the amount, the integer at full size, and the
 * decimal portion smaller and dimmed relative to the integer. Locale-aware via
 * formatMoneyParts — the symbol side and sign placement flip for Arabic
 * automatically. A single nested Text tree, not a flex row of siblings (see
 * MoneyStatCard for why that matters on Android) — except for the Riyal
 * symbol specifically, which is an SVG and physically can't nest inside a
 * Text run, so that one case gets its own flex-row composition below.
 */
export function MoneyAmount({
  amount,
  currencyCode,
  color,
  size = 50,
  align = 'center',
  numberOfLines,
  shrinkToFit,
  masked,
}: MoneyAmountProps) {
  const { theme } = useTheme();
  const { formatMoneyParts } = useCurrency();
  const parts = formatMoneyParts(amount, currencyCode);
  const valueColor = color ?? theme.textPrimary;
  const integerDisplay = masked ? '••••' : parts.integer;
  const decimalDisplay = masked ? '••' : parts.decimal;

  const symbolIsShort = [...parts.symbol].length <= 2;
  const symbolSize = Math.max(
    symbolIsShort ? MIN_SHORT_SYMBOL_SIZE : MIN_SYMBOL_SIZE,
    Math.round(size * (symbolIsShort ? SHORT_SYMBOL_RATIO : SYMBOL_RATIO)),
  );
  const decimalSize = Math.max(MIN_DECIMAL_SIZE, Math.round(size * DECIMAL_RATIO));

  if (parts.symbol === RIYAL_SYMBOL) {
    const justifyContent =
      align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
    const riyalSize = Math.round(size * RIYAL_RATIO);
    return (
      <View
        style={{
          // Forced LTR (not just "row", which the app's native RTL flip
          // would otherwise mirror into "row-reverse" in Arabic) — the glyph
          // is a graphic mark, not locale-ordered text, so it stays at the
          // same physical leading edge in every amount everywhere rather
          // than flipping with symbolFirst or the app's language.
          direction: 'ltr',
          flexDirection: 'row',
          // Vertically centered against the number, not baseline/flex-end —
          // it doesn't sit on a text baseline the way a font glyph would.
          alignItems: 'center',
          justifyContent,
          gap: Math.max(4, Math.round(size * 0.1)),
        }}
      >
        <RiyalSymbol size={riyalSize} color={valueColor} />
        <Text
          // flexShrink/minWidth:0 only when shrinkToFit is actually
          // requested — applying them unconditionally let this Text get
          // squeezed narrower than its content without numberOfLines/
          // adjustsFontSizeToFit to handle that gracefully, which was
          // wrapping the decimal onto its own line and overlapping the
          // integer above it (the "strikethrough" glitch).
          style={shrinkToFit ? { flexShrink: 1, minWidth: 0 } : undefined}
          numberOfLines={shrinkToFit ? (numberOfLines ?? 1) : numberOfLines}
          adjustsFontSizeToFit={shrinkToFit}
          minimumFontScale={shrinkToFit ? 0.4 : undefined}
        >
          <Text style={{ fontSize: size, fontFamily: FONTS.display, color: valueColor }}>
            {!masked && parts.isNegative ? '-' : ''}
            {integerDisplay}
          </Text>
          <Text
            style={{
              fontSize: decimalSize,
              fontFamily: FONTS.displayRegular,
              color: valueColor,
              opacity: DECIMAL_OPACITY,
            }}
          >
            .{decimalDisplay}
          </Text>
        </Text>
      </View>
    );
  }

  const symbolRun = (
    <Text style={{ fontSize: symbolSize, fontFamily: FONTS.display, color: valueColor }}>
      {parts.symbol}
    </Text>
  );

  return (
    <Text
      // Forced LTR: the minus sign always attaches to the integer's own
      // left edge below, and symbolFirst still governs which *side* the
      // currency symbol sits on — but without an explicit direction, the
      // app's native RTL flip (LanguageContext's I18nManager.forceRTL)
      // mirrors this whole nested-Text run in Arabic, dragging the sign
      // away from the number it belongs to instead of just relocating the
      // symbol the way symbolFirst intends.
      style={{ textAlign: align, direction: 'ltr' }}
      numberOfLines={shrinkToFit ? (numberOfLines ?? 1) : numberOfLines}
      adjustsFontSizeToFit={shrinkToFit}
      minimumFontScale={shrinkToFit ? 0.4 : undefined}
    >
      {parts.symbolFirst ? symbolRun : null}
      {parts.symbolFirst ? ' ' : ''}
      <Text style={{ fontSize: size, fontFamily: FONTS.display, color: valueColor }}>
        {!masked && parts.isNegative ? '-' : ''}
        {integerDisplay}
      </Text>
      <Text
        style={{
          fontSize: decimalSize,
          fontFamily: FONTS.displayRegular,
          color: valueColor,
          opacity: DECIMAL_OPACITY,
        }}
      >
        .{decimalDisplay}
      </Text>
      {!parts.symbolFirst ? ' ' : ''}
      {!parts.symbolFirst ? symbolRun : null}
    </Text>
  );
}
