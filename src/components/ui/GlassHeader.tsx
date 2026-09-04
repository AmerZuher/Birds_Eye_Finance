import React from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/context/ThemeContext';
import { useChrome } from '@/context/ChromeContext';
import { ANDROID_BLUR_METHOD, GLASS_BLUR_INTENSITY } from '@/constants/theme';
import { CHROME_GROUND_ALPHA, hexToRgb } from '@/utils/color';

/**
 * The content row's `minHeight` — meaning the row's whole box, its own
 * `paddingVertical: 12` (24px) included, since minHeight is set on that same
 * node. It has to be at least as tall as the tallest real row ever gets:
 * Header's settings-avatar Pressable — a 34px Avatar rendered with
 * `ring="accent"` (draws a 2px ring 3px outside the given size, so a 34px
 * avatar occupies 40px, matching the back arrow's IconButton — see
 * Header.tsx) inside a Pressable with `padding: 2` for its active-state tint
 * (40 + 2 + 2 = 44) — plus the row's own 24px of padding around it: 68.
 *
 * This number moves whenever that avatar's rendered size does (it has twice
 * already — 66 when the avatar was 32, this 68 now that it's 34 to match the
 * arrow) since it isn't derived from Header.tsx automatically, just kept in
 * sync by hand. The two prior attempts before that (36, then 42) both used
 * the avatar Pressable's own height alone, forgetting it sits *inside* a row
 * that adds another 24px of padding on top — since minHeight is a floor,
 * both landed below what either row already totalled unaided and so never
 * actually constrained anything, leaving the two rows their own, still
 * different, natural heights regardless of what this constant said.
 *
 * `minHeight`, not `height`: at a large fontScale a title is allowed to make
 * the bar taller rather than being clipped by the overflow:hidden below.
 */
const ROW_MIN_HEIGHT = 68;

interface GlassHeaderProps {
  children: React.ReactNode;
}

/**
 * Generic glassmorphic top bar shell (rule 8) — an absolutely-positioned
 * overlay pinned to the top so screen content scrolls underneath it (that's
 * what the BlurView actually blurs) instead of being pushed down by it.
 * Reports its own rendered height via ChromeContext so screens know how much
 * top padding they need. Content (brand row vs. back+title row) is supplied
 * by the app-specific Header.tsx composition.
 *
 * Obsidian refactor: full-bleed edge-to-edge bar rather than the old inset
 * floating rounded card — the glass now runs behind the status bar (safe-area
 * inset is padding *inside* the bar, not a margin above it) and is separated
 * from content by a single hairline bottom border instead of a full outline.
 */
export function GlassHeader({ children }: GlassHeaderProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { setHeaderHeight, blurTarget } = useChrome();

  const onLayout = (e: LayoutChangeEvent) => {
    setHeaderHeight(e.nativeEvent.layout.height);
  };

  return (
    <View
      onLayout={onLayout}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        paddingTop: insets.top,
        overflow: 'hidden',
        borderBottomWidth: 0.5,
        // Same accent-tinted stroke as the navbar's top edge (theme.glow.b at
        // 0.32), not GLASS.border's neutral white — the two floating bars
        // need matching borders to read as one material bookending the app.
        borderBottomColor: `rgba(${theme.glow.b},0.15)`,
      }}
    >
      <BlurView
        intensity={GLASS_BLUR_INTENSITY}
        // expo-blur's own tint, not just the color wash below it — a "dark"
        // tint on a light theme fights the light wash and muddies it. This
        // is the one BlurView prop that can't be expressed as a theme color
        // at all, so it has to branch on isLight directly.
        tint={theme.isLight ? 'light' : 'dark'}
        blurMethod={ANDROID_BLUR_METHOD}
        blurTarget={blurTarget}
        style={StyleSheet.absoluteFill}
      />
      {/* Based on `ground`, not `surface`, and with no white gradient over the
          top — see Navbar for the reasoning. The two bars have to derive their
          colour identically or they read as different materials. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: `rgba(${hexToRgb(theme.ground)},${CHROME_GROUND_ALPHA})` },
        ]}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          minHeight: ROW_MIN_HEIGHT,
          paddingVertical: 12,
          paddingHorizontal: 18,
        }}
      >
        {children}
      </View>
    </View>
  );
}
