import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/context/ThemeContext';

const RISE_DISTANCE = 14;
const DURATION = 350;
// Matches CSS cubic-bezier(0.22, 1, 0.36, 1) — a quick, decisive settle for
// the transform half; the fade keeps the gentler standard ease curve. Shared
// with GlassModal's sheet so screens and sheets move on one curve.
const RISE_EASING = Easing.bezier(0.22, 1, 0.36, 1);

interface PageTransitionProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * "Fade Rise" screen-entrance, replayed every time this page regains focus —
 * not just on first mount. Tab screens stay mounted after their first visit
 * (react-navigation's bottom-tabs navigator, see app/(tabs)/_layout.tsx) and
 * only toggle focus when Navbar switches tabs, so a mount-only `entering`
 * animation would fire once and never again; `useIsFocused` (re-exported by
 * expo-router) fires on every focus change regardless of whether the screen
 * actually remounted.
 *
 * Two deliberate departures from the reference CSS, both to keep the cards
 * intact — a page here is not a flat DOM subtree the compositor can fade as
 * one layer:
 *
 * 1. No `scale`. MoneyStatCard's Android `elevation` shadow is drawn by HWUI
 *    from the view's outline and doesn't track a parent scale, so shadow and
 *    card decouple mid-swap; the 1px tinted borders and money type also get
 *    resampled off the pixel grid. And since the glass Header/Navbar are
 *    siblings *outside* this wrapper (app/_layout.tsx) they don't scale with
 *    it, so cards drift out of alignment with the chrome framing them.
 *
 * 2. The fade is a ground-colored veil drawn *over* the page, ramping 1 → 0 —
 *    not `opacity` on the page itself. Animating the subtree's alpha is what
 *    made the hero card flash a hard bright rectangle: Android applies a
 *    parent's alpha per-child rather than to one composited layer, and
 *    MoneyStatCard's elevation shadow (tinted `theme.glow.a`, so *bright*)
 *    is drawn from its outer view's opaque background — which a fade stops
 *    being. Over an opaque ground the veil is mathematically the same blend
 *    (content·a + ground·(1−a)), but every card keeps its resting opacity, so
 *    shadows, gradients and hairlines composite exactly as they always do.
 */
export function PageTransition({ children, style }: PageTransitionProps) {
  const { theme } = useTheme();
  const isFocused = useIsFocused();
  const veilOpacity = useSharedValue(1);
  const translateY = useSharedValue(RISE_DISTANCE);

  useEffect(() => {
    if (isFocused) {
      veilOpacity.value = withTiming(0, { duration: DURATION, easing: Easing.ease });
      translateY.value = withTiming(0, { duration: DURATION, easing: RISE_EASING });
    } else {
      // Snapped instantly rather than animated out — the screen is already
      // hidden by the navigator at this point, so this just re-arms the
      // hidden state for the next time it's focused.
      veilOpacity.value = 1;
      translateY.value = RISE_DISTANCE;
    }
  }, [isFocused, veilOpacity, translateY]);

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const veilStyle = useAnimatedStyle(() => ({
    opacity: veilOpacity.value,
  }));

  return (
    <View style={[{ flex: 1, backgroundColor: theme.ground }, style]}>
      <Animated.View style={[{ flex: 1 }, contentStyle]}>{children}</Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.ground }, veilStyle]}
      />
    </View>
  );
}
