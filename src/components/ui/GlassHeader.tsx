import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/context/ThemeContext';
import { GLASS } from '@/constants/theme';

interface GlassHeaderProps {
  children: React.ReactNode;
}

/**
 * Generic floating glassmorphic bar shell (rule 8) — pinned to top, respects
 * safe-area insets. Content (brand row vs. back+title row) is supplied by
 * the app-specific Header.tsx composition.
 */
export function GlassHeader({ children }: GlassHeaderProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <View
      style={{
        marginTop: insets.top + 12,
        marginHorizontal: 14,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: GLASS.headerBorder,
      }}
    >
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(${theme.glow.a},0.14)` }]} />
      <LinearGradient
        colors={[GLASS.headerGradientTop, GLASS.headerGradientBottom]}
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
