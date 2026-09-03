import React from 'react';
import { Pressable, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/context/ThemeContext';

interface GradientButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}

/** Primary submit button — filled with the theme's accent gradient. */
export function GradientButton({ label, onPress, disabled }: GradientButtonProps) {
  const { theme } = useTheme();

  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ opacity: disabled ? 0.5 : 1 }}>
      <LinearGradient
        colors={[theme.accent1, theme.accent2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: '100%',
          paddingVertical: 14,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: theme.buttonText, fontWeight: '700', fontSize: 14 }}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}
