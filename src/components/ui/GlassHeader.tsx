import React from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/context/ThemeContext';
import { useChrome } from '@/context/ChromeContext';
import { ANDROID_BLUR_METHOD, GLASS } from '@/constants/theme';

interface GlassHeaderProps {
  children: React.ReactNode;
}

/**
 * Generic floating glassmorphic bar shell (rule 8) — an absolutely-positioned
 * overlay pinned to the top so screen content scrolls underneath it (that's
 * what the BlurView actually blurs) instead of being pushed down by it.
 * Reports its own rendered height via ChromeContext so screens know how much
 * top padding they need. Content (brand row vs. back+title row) is supplied
 * by the app-specific Header.tsx composition.
 */
export function GlassHeader({ children }: GlassHeaderProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { setHeaderHeight, blurTarget } = useChrome();

  const onLayout = (e: LayoutChangeEvent) => {
    setHeaderHeight(insets.top + 12 + e.nativeEvent.layout.height);
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
        marginTop: insets.top + 12,
        marginHorizontal: 14,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: GLASS.border,
      }}
    >
      <BlurView
        intensity={GLASS.blurIntensity}
        tint="dark"
        blurMethod={ANDROID_BLUR_METHOD}
        blurTarget={blurTarget}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: `rgba(${theme.chromeTint},${GLASS.tintAlpha})` },
        ]}
      />
      <LinearGradient
        colors={[GLASS.gradientTop, GLASS.gradientBottom]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          paddingVertical: 10,
          paddingHorizontal: 14,
        }}
      >
        {children}
      </View>
    </View>
  );
}
