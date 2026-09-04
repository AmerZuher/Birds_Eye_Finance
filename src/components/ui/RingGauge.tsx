import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/context/ThemeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface RingGaugeProps {
  /** Progress in 0..1 (clamped). */
  progress: number;
  /** Overall diameter of the ring. */
  size?: number;
  /** Stroke thickness. */
  strokeWidth?: number;
  /** Center content, absolutely centered inside the ring. */
  children?: React.ReactNode;
  /** Colors for the progress arc (defaults to the theme's accent gradient). */
  colors?: [string, string];
}

/**
 * Animated circular progress ring. The progress arc animates from 0 → value
 * on mount (and whenever `progress` changes) with a smooth ease-out, using a
 * `strokeDasharray` on a single circle so there's no angular-path math.
 * Backed by a soft, barely-visible track in the theme's border color so the
 * ring reads as a gauge rather than a floating arc.
 */
export function RingGauge({
  progress,
  size = 120,
  strokeWidth = 10,
  children,
  colors,
}: RingGaugeProps) {
  const { theme } = useTheme();
  const clamped = Math.min(1, Math.max(0, progress));
  const animated = useSharedValue(0);

  useEffect(() => {
    animated.value = withTiming(clamped, { duration: 700 });
  }, [clamped, animated]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedProps = useAnimatedProps(() => {
    const len = circumference * animated.value;
    return { strokeDasharray: `${len} ${circumference - len}` };
  });

  const [from, to] = colors ?? [`rgb(${theme.glow.a})`, `rgb(${theme.glow.b})`];

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="ringGaugeFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={from} />
            <Stop offset="100%" stopColor={to} />
          </SvgGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc — rotated -90° so it starts at 12 o'clock and sweeps
            clockwise, the same orientation a gauge reads in both LTR and RTL. */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ringGaugeFill)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={{ position: 'absolute' }}>{children}</View>
    </View>
  );
}
