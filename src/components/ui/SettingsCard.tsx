import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import { BORDER, RADII, TEXT } from '@/constants/theme';

interface SettingsCardProps {
  title?: string;
  children: React.ReactNode;
}

/** Rounded surface card used to group Settings rows/sections. */
export function SettingsCard({ title, children }: SettingsCardProps) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        borderRadius: RADII.card,
        padding: 16,
        paddingTop: 18,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: BORDER.hairline,
      }}
    >
      {title ? (
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: TEXT.tertiary,
            marginBottom: 10,
          }}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  value?: React.ReactNode;
  onPress?: () => void;
  showTopBorder?: boolean;
}

/** icon tile + label + trailing value/control — one row inside a SettingsCard. */
export function SettingsRow({ icon, label, value, onPress, showTopBorder }: SettingsRowProps) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 9,
        borderTopWidth: showTopBorder ? 1 : 0,
        borderTopColor: BORDER.hairlineSoft,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        {icon}
        <Text style={{ fontSize: 12, fontWeight: '600', color: TEXT.primary }}>{label}</Text>
      </View>
      {value}
    </Wrapper>
  );
}
