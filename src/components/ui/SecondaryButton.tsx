import React from 'react';
import { Pressable, Text } from 'react-native';

import { useTheme } from '@/context/ThemeContext';

interface SecondaryButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}

/** Ghost/outline button — used alongside GradientButton (e.g. Cancel). */
export function SecondaryButton({ label, onPress, disabled }: SecondaryButtonProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        width: '100%',
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        // Same light/dark split as ListRow's wash — a white fill would sit
        // flush with a light surface instead of reading as a ghost button.
        backgroundColor: theme.isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: theme.border,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}
