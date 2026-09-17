import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Eye, EyeOff } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { GlowBlob } from '@/components/ui/GlowBlob';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { RiyalSymbol } from '@/components/RiyalSymbol';
import { FONTS, RADII, SEMANTIC } from '@/constants/theme';
import { withAlpha } from '@/utils/color';

// Mirrors MoneyAmount's own check — no font ships U+20C1 yet, so it has to
// be drawn instead of rendered as text here too, since this masked-state
// symbol is composed independently of MoneyAmount.
const RIYAL_SYMBOL = '⃁';

// icon.png's mark (bird/wallet/coin) sits on a genuinely transparent
// background — 63% of its pixels are alpha 0 — so it can be shown large and
// faint as a corner watermark without dragging a filled square along with
// it. Placed behind the content (first in paint order) and kept out of the
// text/dots' footprint so it never competes with what's actually being read.
const APP_ICON = require('../../../assets/icon.png');

/** The expected-vs-actual line under the figure (FEATURE_SPEC 7.3). */
export interface BalanceVariance {
  /** Signed, in base currency. Null reads as "matched what was expected" — no number, neutral color. */
  amount: number | null;
  label: string;
  onPress?: () => void;
}

interface BalanceRevealCardProps {
  label: string;
  amount: number;
  /** Where the figure comes from — "Logged 3 days ago", "From your accounts" (7.3). */
  caption?: string;
  /** The logged figure itself, appended to the caption only once revealed (it's money). */
  captionDetail?: string;
  variance?: BalanceVariance | null;
  /** An inline action in the card's bottom slot, in place of the tap hint — e.g. "Log balance". */
  actionLabel?: string;
  onAction?: () => void;
}

/** A chip-card silhouette — small gradient tile with three contact lines,
 * built from the theme's own accent1/accent2 (rule 3: no hardcoded brand
 * hex), not a literal EMV chip render. Reads as "this is a card" at a
 * glance, which a plain wallet icon never will. */
function ChipGlyph({ theme }: { theme: { accent1: string; accent2: string; ground: string } }) {
  return (
    <View style={{ width: 30, height: 21, borderRadius: 5, overflow: 'hidden' }}>
      <LinearGradient
        colors={[theme.accent2, theme.accent1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flex: 1,
          paddingVertical: 4,
          paddingHorizontal: 3,
          justifyContent: 'space-between',
        }}
      >
        <View
          style={{ height: 1.4, borderRadius: 1, backgroundColor: withAlpha(theme.ground, 0.4) }}
        />
        <View
          style={{ height: 1.4, borderRadius: 1, backgroundColor: withAlpha(theme.ground, 0.4) }}
        />
        <View
          style={{ height: 1.4, borderRadius: 1, backgroundColor: withAlpha(theme.ground, 0.4) }}
        />
      </LinearGradient>
    </View>
  );
}

function MaskedDots({ color }: { color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{ width: 11, height: 11, borderRadius: 5.5, backgroundColor: color }}
        />
      ))}
    </View>
  );
}

/**
 * Home's "Current Balance" hero — the app's flagship card. A real diagonal
 * wash of the theme's own two glow colors carries the color the whole way
 * across (kept saturated corner-to-corner, not faded out to `theme.ground`
 * partway through), kept to a minimal alpha so it reads as a tint, not a
 * loud color block. `GlowBlob` (the same tuned ambient-glow primitive used
 * on every other hero card) adds one soft highlight on top, rather than a
 * second hand-rolled gradient layer. A chip glyph gives it an actual "this
 * is a card" silhouette, and `icon.png`'s mark sits as a large, faint
 * corner watermark, kept clear of the text/dots so it never competes with
 * them. No texture overlay — that read as visual noise, not polish, so
 * it's gone rather than re-tuned.
 *
 * Masked by default (real dot glyphs, fixed at exactly 4 regardless of the
 * real digit count — see MoneyAmount's `masked` prop for why proportional
 * dots would leak the balance's rough magnitude even while "hidden"). Tap
 * anywhere to reveal. Resets hidden on every mount — no MMKV persistence —
 * so re-opening the app never leaves a balance sitting exposed
 * (docs/ENHANCEMENT_PLAN.md §6, decision 1).
 */
export function BalanceRevealCard({
  label,
  amount,
  caption,
  captionDetail,
  variance,
  actionLabel,
  onAction,
}: BalanceRevealCardProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { formatMoneyParts } = useCurrency();
  const [revealed, setRevealed] = useState(false);

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRevealed((r) => !r);
  };

  const parts = formatMoneyParts(amount);

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={revealed ? t('dashboard.tapToHide') : t('dashboard.tapToReveal')}
    >
      {/* Outer view carries the shadow against its own opaque background —
          Android's elevation shadow follows a view's own bg, not a clipped
          gradient child's (same pattern as MoneyStatCard/GlowBlob hosts). */}
      <View
        style={{
          borderRadius: RADII.card,
          backgroundColor: theme.surface,
          shadowColor: `rgb(${theme.glow.a})`,
          shadowOpacity: 0.38,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 14 },
          elevation: 10,
        }}
      >
        <View
          style={{
            aspectRatio: 1.75,
            borderRadius: RADII.card,
            borderWidth: 1,
            borderColor: `rgba(${theme.glow.a},0.4)`,
            overflow: 'hidden',
          }}
        >
          {/* Stays saturated corner-to-corner — both stops are theme color,
              neither fades out to a neutral/ground tone — but at a minimal
              alpha now: a tint, not a color block. */}
          <LinearGradient
            colors={[`rgba(${theme.glow.a},0.14)`, `rgba(${theme.glow.b},0.1)`, theme.surface]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <GlowBlob color={`rgb(${theme.glow.b})`} corner="bottomEnd" />

          {/* Large corner watermark — icon.png's mark is genuinely
              transparent (see the const above), so it can sit big without
              dragging a filled square along with it. Sits behind the
              content (painted first), fully inset (not bled past the card
              edge). Fixed at the physical bottom-right regardless of
              language, not mirrored for RTL — same exception CLAUDE.md
              rule 9 already makes for the FAB: it's decorative, not
              directional content, and isRTL-conditional positioning here
              (left/right, and separately flex-start/flex-end) kept landing
              on the wrong side because this app's native RTL mirror state
              is unpredictable mid-session (swapLeftAndRightInRTL/forceRTL
              are called on language switch but nothing reloads afterward),
              so anything conditioned on isRTL risks double-flipping against
              whatever that stale native state happens to be. Fixed
              position sidesteps the whole problem. */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { justifyContent: 'flex-end', alignItems: 'flex-end' },
            ]}
            pointerEvents="none"
          >
            <Image
              source={APP_ICON}
              resizeMode="contain"
              style={{ width: 120, height: 120, margin: 8, opacity: 0.18 }}
            />
          </View>

          <View style={{ flex: 1, padding: 20, justifyContent: 'space-between' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ChipGlyph theme={theme} />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    color: theme.textSecondary,
                  }}
                >
                  {label}
                </Text>
              </View>
              {revealed ? (
                <Eye size={17} color={theme.textSecondary} />
              ) : (
                <EyeOff size={17} color={theme.textSecondary} />
              )}
            </View>

            {/* Keyed by `revealed` so each toggle is a fresh mount —
                Reanimated's entering/exiting only fire on mount/unmount, not
                on a prop change within the same instance. */}
            {/* Centered, not edge-anchored — sidesteps needing isRTL to pick
                a start/end edge at all here (this app's native RTL mirror
                state is unpredictable mid-session, see the watermark note
                below), and reads as more deliberate for a hero figure. */}
            <Animated.View
              key={revealed ? 'shown' : 'hidden'}
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(140)}
              style={{
                width: '100%',
                flexDirection: parts.symbolFirst ? 'row' : 'row-reverse',
                justifyContent: 'center',
                alignItems: 'flex-end',
                gap: 8,
              }}
            >
              {revealed ? (
                <MoneyAmount amount={amount} size={52} align="center" shrinkToFit />
              ) : (
                <>
                  {parts.symbol === RIYAL_SYMBOL ? (
                    <RiyalSymbol size={20} color={theme.textPrimary} />
                  ) : (
                    <Text
                      style={{
                        fontFamily: FONTS.display,
                        fontSize: 20,
                        color: theme.textPrimary,
                      }}
                    >
                      {parts.symbol}
                    </Text>
                  )}
                  <MaskedDots color={theme.textPrimary} />
                </>
              )}
            </Animated.View>

            {caption || variance ? (
              <View style={{ gap: 3, alignItems: 'center' }}>
                {caption ? (
                  <Text style={{ fontSize: 11, color: theme.textSecondary, textAlign: 'center' }}>
                    {revealed && captionDetail ? `${caption} · ${captionDetail}` : caption}
                  </Text>
                ) : null}
                {variance ? (
                  // The amount follows the card's own reveal state (masked
                  // dots, not a hidden row) so the card never changes height
                  // when it's tapped.
                  <Pressable
                    onPress={variance.onPress}
                    disabled={!variance.onPress}
                    accessibilityRole={variance.onPress ? 'button' : undefined}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    {variance.amount === null ? null : (
                      <MoneyAmount
                        amount={variance.amount}
                        size={13}
                        color={variance.amount >= 0 ? SEMANTIC.positive : SEMANTIC.negative}
                        masked={!revealed}
                        numberOfLines={1}
                      />
                    )}
                    <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                      {variance.label}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {actionLabel && onAction ? (
              <SecondaryButton variant="link" label={actionLabel} onPress={onAction} />
            ) : (
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '600',
                  letterSpacing: 0.5,
                  color: theme.textTertiary,
                  textAlign: 'center',
                }}
              >
                {revealed ? t('dashboard.tapToHide') : t('dashboard.tapToReveal')}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}
