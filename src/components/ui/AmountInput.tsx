import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import { RADII, SEMANTIC } from '@/constants/theme';
import { withAlpha } from '@/utils/color';

interface AmountInputProps {
  value: string;
  onChangeValue: (value: string) => void;
  currencyCode: string;
  onPressCurrency?: () => void;
  label?: string;
  /** Tints the border/currency label — e.g. DebtModal's type toggle (FEATURE_SPEC 1.7). Omit for the neutral default. */
  tint?: 'positive' | 'negative';
}

/** Amount field with an embedded currency indicator (tap to open a CustomSelect elsewhere). */
export function AmountInput({
  value,
  onChangeValue,
  currencyCode,
  onPressCurrency,
  label = 'Amount',
  tint,
}: AmountInputProps) {
  const { theme } = useTheme();
  const tintColor = tint ? SEMANTIC[tint] : undefined;

  return (
    <View
      style={{
        borderRadius: RADII.field,
        padding: 12,
        backgroundColor: theme.surfaceAlt,
        borderWidth: 1,
        borderColor: tintColor ? withAlpha(tintColor, 0.33) : theme.border,
        gap: 2,
      }}
    >
      <Text
        style={{
          fontSize: 9.5,
          fontWeight: '700',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: theme.textTertiary,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
        <Pressable onPress={onPressCurrency} hitSlop={6}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: tintColor ?? theme.accent2 }}>
            {currencyCode}
          </Text>
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChangeValue}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={theme.textTertiary}
          style={{ flex: 1, fontSize: 16, fontWeight: '600', color: theme.textPrimary, padding: 0 }}
        />
      </View>
    </View>
  );
}
