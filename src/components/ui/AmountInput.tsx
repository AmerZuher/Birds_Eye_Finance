import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import { RADII, TEXT, BORDER } from '@/constants/theme';

interface AmountInputProps {
  value: string;
  onChangeValue: (value: string) => void;
  currencyCode: string;
  onPressCurrency?: () => void;
  label?: string;
}

/** Amount field with an embedded currency indicator (tap to open a CustomSelect elsewhere). */
export function AmountInput({
  value,
  onChangeValue,
  currencyCode,
  onPressCurrency,
  label = 'Amount',
}: AmountInputProps) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        borderRadius: RADII.field,
        padding: 12,
        backgroundColor: theme.surfaceAlt,
        borderWidth: 1,
        borderColor: BORDER.hairline,
        gap: 2,
      }}
    >
      <Text
        style={{
          fontSize: 9.5,
          fontWeight: '700',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: TEXT.tertiary,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
        <Pressable onPress={onPressCurrency} hitSlop={6}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.accent2 }}>
            {currencyCode}
          </Text>
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChangeValue}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={TEXT.tertiary}
          style={{ flex: 1, fontSize: 16, fontWeight: '600', color: TEXT.primary, padding: 0 }}
        />
      </View>
    </View>
  );
}
