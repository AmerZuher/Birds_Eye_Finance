import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import { TEXT } from '@/constants/theme';

export interface SegmentOption<T extends string> {
  label: string;
  value: T;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { theme } = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              paddingVertical: 5,
              paddingHorizontal: 8,
              borderRadius: 8,
              backgroundColor: active ? theme.accent1 : theme.surfaceAlt,
              borderWidth: active ? 0 : 1,
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: active ? theme.buttonText : TEXT.tertiary,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
