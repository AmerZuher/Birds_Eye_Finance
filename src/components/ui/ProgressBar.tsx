import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/context/ThemeContext';

interface ProgressBarProps {
  /** Progress in 0..1 (clamped). */
  progress: number;
  /** Bar thickness. */
  height?: number;
  /** Corner radius of the filled track (defaults to pill). */
  radius?: number;
  /** Colors for the fill gradient (defaults to the theme's accent gradient). */
  colors?: [string, string];
}

/**
 * Animated horizontal progress bar — a soft themed track with a gradient fill
 * whose width eases from 0 → value on mount and whenever `progress` changes.
 */
export function ProgressBar({ progress, height = 8, radius = 999, colors }: ProgressBarProps) {
  const { theme } = useTheme();
  const clamped = Math.min(1, Math.max(0, progress));
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(clamped, { duration: 700 });
  }, [clamped, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  const [from, to] = colors ?? [`rgb(${theme.glow.a})`, `rgb(${theme.glow.b})`];

  return (
    <View
      style={{
        height,
        borderRadius: radius,
        backgroundColor: theme.borderSoft,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[{ height: '100%', borderRadius: radius, overflow: 'hidden' }, fillStyle]}
      >
        <LinearGradient
          colors={[from, to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}
