import React from 'react';
import { Pressable, Text } from 'react-native';

import { TEXT, BORDER } from '@/constants/theme';

interface SecondaryButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}

/** Ghost/outline button — used alongside GradientButton (e.g. Cancel). */
export function SecondaryButton({ label, onPress, disabled }: SecondaryButtonProps) {
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
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: BORDER.hairline,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: TEXT.primary, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}
