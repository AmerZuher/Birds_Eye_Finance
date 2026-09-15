import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import { FONTS, SEMANTIC } from '@/constants/theme';
import type { ThemeShape } from '@/constants/theme';
import { withAlpha } from '@/utils/color';

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

function ringColor(ring: AvatarRing, theme: ThemeShape): string | null {
  switch (ring) {
    case 'positive':
      return withAlpha(SEMANTIC.positive, 0.6);
    case 'negative':
      return withAlpha(SEMANTIC.negative, 0.6);
    case 'settled':
      return withAlpha(theme.textSecondary, 0.55);
    case 'flat':
      // A neutral grey on either kind of theme — the ring sits on the light
      // `ground` of a light theme, where a white wash would vanish.
      return withAlpha(theme.textPrimary, theme.isLight ? 0.18 : 0.2);
    case 'accent':
      return `rgba(${theme.glow.a},0.7)`;
    default:
      return null;
  }
}

/** Photo or initials, circular, with an optional status ring — used for people and the profile.
 * A remote `photoUri` (e.g. a GitHub avatar URL) that fails to load — offline,
 * most likely, for an offline-first app — falls back to initials instead of
 * a blank circle. Local/data-URI photos essentially never hit this; it's
 * specifically for the remote case. */
export function Avatar({ name, photoUri, size = 44, ring = 'none' }: AvatarProps) {
  const { theme } = useTheme();
  const ringRgba = ringColor(ring, theme);
  const outerSize = size + 6;
  // Which uri last failed to load, not a plain boolean — comparing against
  // the *current* photoUri means a changed prop clears the failure on its
  // own during render, no effect (and no set-state-in-effect cascade)
  // needed to "reset" anything.
  const [erroredUri, setErroredUri] = useState<string | null>(null);
  const showPhoto = !!photoUri && photoUri !== erroredUri;

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
        {showPhoto ? (
          <Image
            source={{ uri: photoUri }}
            style={{ width: '100%', height: '100%' }}
            onError={() => setErroredUri(photoUri ?? null)}
          />
        ) : (
          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: size * 0.34,
              // Was a hardcoded near-white, unreadable against a light
              // theme's own light surfaceAlt (what this circle's
              // background is, immediately above). textPrimary is already
              // built to contrast against surfaces on either kind of theme.
              color: theme.textPrimary,
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
