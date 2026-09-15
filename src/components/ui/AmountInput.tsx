import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { RADII, SEMANTIC } from '@/constants/theme';
import { withAlpha } from '@/utils/color';

interface AmountInputProps {
  value: string;
  onChangeValue: (value: string) => void;
  currencyCode: string;
  /** Makes the currency a button (it opens a CustomSelect elsewhere). Omit when the currency is fixed. */
  onPressCurrency?: () => void;
  label?: string;
  /** Tints the border/currency — e.g. DebtModal's type toggle (FEATURE_SPEC 1.7). Omit for the neutral default. */
  tint?: 'positive' | 'negative';
}

/**
 * Amount field with its currency beside it. When the currency can be changed it is a pill
 * button — tinted fill, hairline border, code and a chevron — so it reads as tappable (users
 * didn't realise the plain code was one). A fixed currency (e.g. an adjustment, always in its
 * debt's currency) is plain text with no chevron.
 */
export function AmountInput({
  value,
  onChangeValue,
  currencyCode,
  onPressCurrency,
  label = 'Amount',
  tint,
}: AmountInputProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  // Pressed state lives in React, not in a `style={({ pressed }) => …}` function: NativeWind's
  // JSX transform drops function styles on Pressable, which left this pill unstyled.
  const [pressed, setPressed] = useState(false);
  const tintColor = tint ? SEMANTIC[tint] : undefined;
  const currencyColor = tintColor ?? theme.accent2;

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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
        {onPressCurrency ? (
          <Pressable
            onPress={onPressCurrency}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.changeCurrency', { code: currencyCode })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              height: 30,
              paddingStart: 11,
              paddingEnd: 8,
              borderRadius: RADII.pill,
              borderWidth: 1,
              borderColor: withAlpha(currencyColor, pressed ? 0.5 : 0.28),
              backgroundColor: withAlpha(currencyColor, pressed ? 0.24 : 0.13),
            }}
          >
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '700',
                letterSpacing: 0.4,
                color: currencyColor,
              }}
            >
              {currencyCode}
            </Text>
            <ChevronDown size={13} color={currencyColor} strokeWidth={2.6} />
          </Pressable>
        ) : (
          <Text
            style={{ fontSize: 12.5, fontWeight: '700', color: tintColor ?? theme.textSecondary }}
          >
            {currencyCode}
          </Text>
        )}
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
