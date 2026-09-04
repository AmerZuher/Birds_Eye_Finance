import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/context/ThemeContext';

export interface DonutSlice {
  value: number;
  color: string;
  /** Optional label key or pre-translated text shown in the legend. */
  label: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  /** Overall diameter. */
  size?: number;
  /** Stroke thickness of the ring. */
  strokeWidth?: number;
  /** Center content, absolutely centered. */
  children?: React.ReactNode;
  /** Gap (in degrees) between slices. */
  gap?: number;
}

/**
 * Multi-segment donut chart. Each slice is a single `Circle` drawn with a
 * `strokeDasharray` offset by the running total of previous slices, so the
 * whole ring is assembled from round-capped arcs without any polar-coordinate
 * path math. `gap` is expressed in degrees and subtracted from each segment's
 * sweep so slices never touch — a cleaner read than flush wedges.
 */
export function DonutChart({
  slices,
  size = 160,
  strokeWidth = 16,
  children,
  gap = 3,
}: DonutChartProps) {
  const { theme } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const gapLength = total > 0 ? (gap / 360) * circumference : 0;

  let cumulative = 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* A faint track underneath so an empty/incomplete ring still reads as
            a gauge rather than scattered floating arcs. */}
        {total === 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={theme.border}
            strokeWidth={strokeWidth}
            fill="none"
          />
        ) : (
          slices.map((slice, index) => {
            const fraction = Math.max(0, slice.value) / total;
            const sweep = Math.max(0, fraction * circumference - gapLength);
            // Offset by the running total; the -90° rotation starts the ring
            // at 12 o'clock and sweeps clockwise.
            const offset = cumulative * circumference;
            cumulative += fraction;
            return (
              <Circle
                key={`${slice.label}-${index}`}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${sweep} ${circumference - sweep}`}
                strokeDashoffset={-offset}
                rotation="-90"
                origin={`${size / 2}, ${size / 2}`}
              />
            );
          })
        )}
      </Svg>
      {/* Constrained to the ring's own inner diameter — without this, center
          content (e.g. a big MoneyAmount) has nothing stopping it from
          growing past the ring for a large number of digits. Paired with
          MoneyAmount's `shrinkToFit`, big numbers shrink to stay inside
          instead of spilling outside it. */}
      <View
        style={{ position: 'absolute', width: size - strokeWidth * 2, alignItems: 'center' }}
      >
        {children}
      </View>
    </View>
  );
}
