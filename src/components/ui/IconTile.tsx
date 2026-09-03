import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';

interface IconTileProps {
  children: React.ReactNode;
  size?: number;
  radius?: number;
  tint?: 'accent' | 'surface' | 'transparent';
  backgroundColor?: string;
}

/** Square/rounded tinted tile for a category icon or brand logo — distinct from Avatar. */
export function IconTile({
  children,
  size = 34,
  radius = 11,
  tint = 'accent',
  backgroundColor,
}: IconTileProps) {
  const { theme } = useTheme();

  const bg =
    backgroundColor ??
    (tint === 'accent'
      ? `rgba(${theme.glow.a},0.16)`
      : tint === 'surface'
        ? theme.surface
        : 'transparent');

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </View>
  );
}
