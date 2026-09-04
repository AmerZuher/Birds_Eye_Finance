import React from 'react';
import { Pressable, Text } from 'react-native';

import { useTheme } from '@/context/ThemeContext';

interface BadgeProps {
  label: string;
  variant?: 'neutral' | 'accent';
}

/** Category/period/status pill — read-only. */
export function Badge({ label, variant = 'neutral' }: BadgeProps) {
  const { theme } = useTheme();

  return (
    <Text
      style={{
        fontSize: 8.5,
        fontWeight: '700',
        paddingVertical: 2,
        paddingHorizontal: 7,
        borderRadius: 999,
        overflow: 'hidden',
        backgroundColor:
          variant === 'accent'
            ? `rgba(${theme.glow.a},0.16)`
            : theme.isLight
              ? 'rgba(0,0,0,0.04)'
              : 'rgba(255,255,255,0.06)',
        color: variant === 'accent' ? theme.accent2 : theme.textSecondary,
      }}
    >
      {label}
    </Text>
  );
}

interface FilterChipProps extends BadgeProps {
  active?: boolean;
  onPress?: () => void;
}

/** Tappable filter-chip variant of Badge — used for category filters. */
export function FilterChip({ label, active, onPress }: FilterChipProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: active ? theme.accent1 : theme.surface,
        borderWidth: active ? 0 : 1,
        borderColor: theme.border,
      }}
    >
      <Text
        style={{
          fontSize: 10.5,
          fontWeight: '700',
          color: active ? theme.buttonText : theme.textSecondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
