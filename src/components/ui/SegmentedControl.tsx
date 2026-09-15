import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/context/ThemeContext';
import { RADII } from '@/constants/theme';
import { withAlpha } from '@/utils/color';

export interface SegmentOption<T extends string> {
  label: string;
  value: T;
  /** Large size only — shown before the label. */
  icon?: LucideIcon;
  /** Large size only — the option's color while selected (defaults to the theme accent). */
  tint?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * 'compact' (default): small pills — tabs and filters.
   * 'large': full-width, equal-width options for a form's key either/or choice
   * ("I owe / Owed to me", "I paid / Add to debt"), each tinted by its own meaning.
   */
  size?: 'compact' | 'large';
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'compact',
}: SegmentedControlProps<T>) {
  const { theme } = useTheme();

  if (size === 'large') {
    return (
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {options.map((opt) => {
          const active = opt.value === value;
          const color = opt.tint ?? theme.accent1;
          const Icon = opt.icon;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                paddingVertical: 14,
                paddingHorizontal: 10,
                borderRadius: RADII.field,
                backgroundColor: active ? withAlpha(color, 0.13) : theme.surfaceAlt,
                borderWidth: 1.5,
                borderColor: active ? color : theme.border,
              }}
            >
              {Icon ? (
                <Icon size={16} color={active ? color : theme.textTertiary} strokeWidth={2.4} />
              ) : null}
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 13.5,
                  fontWeight: '800',
                  color: active ? color : theme.textSecondary,
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
              borderRadius: RADII.iconTile,
              backgroundColor: active ? theme.accent1 : theme.surfaceAlt,
              borderWidth: active ? 0 : 1,
              borderColor: theme.border,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: active ? theme.buttonText : theme.textTertiary,
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
