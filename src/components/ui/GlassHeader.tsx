import React from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/context/ThemeContext';
import { useChrome } from '@/context/ChromeContext';
import { ANDROID_BLUR_METHOD, GLASS } from '@/constants/theme';
import { CHROME_GROUND_ALPHA, hexToRgb } from '@/utils/color';

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
        borderBottomWidth: 1,
        borderBottomColor: GLASS.border,
      }}
    >
      <BlurView
        intensity={GLASS.blurIntensity}
        tint="dark"
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
          paddingVertical: 12,
          paddingHorizontal: 18,
        }}
      >
        {children}
      </View>
    </View>
  );
}
