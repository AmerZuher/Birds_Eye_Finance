import React from 'react';
import { Image, Text, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import { FONTS, SEMANTIC } from '@/constants/theme';

export type AvatarRing = 'positive' | 'negative' | 'settled' | 'flat' | 'accent' | 'none';

interface AvatarProps {
  name?: string;
  photoUri?: string;
  size?: number;
  ring?: AvatarRing;
}

function initialsOf(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function ringColor(ring: AvatarRing, theme: { glow: { a: string } }): string | null {
  switch (ring) {
    case 'positive':
      return 'rgba(52,211,153,0.6)';
    case 'negative':
      return 'rgba(251,113,133,0.6)';
    case 'settled':
      return 'rgba(165,154,138,0.55)';
    case 'flat':
      return 'rgba(255,255,255,0.2)';
    case 'accent':
      return `rgba(${theme.glow.a},0.7)`;
    default:
      return null;
  }
}

/** Photo or initials, circular, with an optional status ring — used for people and the profile. */
export function Avatar({ name, photoUri, size = 44, ring = 'none' }: AvatarProps) {
  const { theme } = useTheme();
  const ringRgba = ringColor(ring, theme);
  const outerSize = size + 6;

  return (
    <View
      style={{
        width: outerSize,
        height: outerSize,
        borderRadius: outerSize / 2,
        backgroundColor: theme.ground,
        alignItems: 'center',
        justifyContent: 'center',
        ...(ringRgba ? { borderWidth: 2, borderColor: ringRgba } : null),
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: size * 0.34,
              color: '#f3efe8',
            }}
          >
            {initialsOf(name)}
          </Text>
        )}
      </View>
    </View>
  );
}

export const AVATAR_SEMANTIC = SEMANTIC;
