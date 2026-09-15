import React from 'react';
import { Pressable, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/context/ThemeContext';
import { RADII } from '@/constants/theme';

interface GradientButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  icon?: LucideIcon;
}

/** Primary submit button — filled with the theme's accent gradient. */
export function GradientButton({ label, onPress, disabled, icon: Icon }: GradientButtonProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <LinearGradient
        colors={[theme.accent1, theme.accent2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: '100%',
          flexDirection: 'row',
          gap: 8,
          paddingVertical: 14,
          borderRadius: RADII.field,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {Icon ? <Icon size={15} color={theme.buttonText} /> : null}
        <Text style={{ color: theme.buttonText, fontWeight: '700', fontSize: 14 }}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}
