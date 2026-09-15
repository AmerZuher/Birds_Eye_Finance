import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { IconTile } from '@/components/ui/IconTile';
import { useTheme } from '@/context/ThemeContext';
import { RADII } from '@/constants/theme';

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
        borderColor: theme.border,
      }}
    >
      {title ? (
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: theme.textTertiary,
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

const ROW_TILE_SIZE = 32;
const ROW_GAP = 12;

interface SettingsRowProps {
  icon: LucideIcon;
  label: string;
  /** A second, muted line under the label — a status or a short explanation. */
  subtitle?: string;
  value?: React.ReactNode;
  /** Extra content under the row, spanning the card's full width (e.g. a status panel). */
  footer?: React.ReactNode;
  onPress?: () => void;
  showTopBorder?: boolean;
}

/** Accent icon tile + label (+ subtitle) + trailing value/control — one row inside a SettingsCard. */
export function SettingsRow({
  icon: Icon,
  label,
  subtitle,
  value,
  footer,
  onPress,
  showTopBorder,
}: SettingsRowProps) {
  const { theme } = useTheme();
  const Wrapper = onPress ? Pressable : View;
  return (
    <View
      style={{
        paddingVertical: 12,
        borderTopWidth: showTopBorder ? 1 : 0,
        borderTopColor: theme.borderSoft,
      }}
    >
      <Wrapper
        onPress={onPress}
        style={{ flexDirection: 'row', alignItems: 'center', gap: ROW_GAP }}
      >
        <IconTile size={ROW_TILE_SIZE}>
          <Icon size={16} color={theme.accent2} strokeWidth={2.2} />
        </IconTile>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary }}>{label}</Text>
          {subtitle ? (
            <Text
              numberOfLines={2}
              style={{ fontSize: 11, color: theme.textTertiary, marginTop: 2 }}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {value}
      </Wrapper>
      {footer ? <View style={{ marginTop: 12 }}>{footer}</View> : null}
    </View>
  );
}
