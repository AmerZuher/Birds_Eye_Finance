import React from 'react';
import { Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Inbox } from 'lucide-react-native';

import { useTheme } from '@/context/ThemeContext';
import { RADII } from '@/constants/theme';

interface EmptyStateProps {
  icon?: LucideIcon;
  caption: string;
}

/** Dashed border + muted icon + caption — used by every empty list, never reimplemented. */
export function EmptyState({ icon: Icon = Inbox, caption }: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 32,
        borderRadius: RADII.txList,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.border,
      }}
    >
      <Icon size={26} color={theme.textTertiary} />
      <Text style={{ fontSize: 12, color: theme.textTertiary, textAlign: 'center', maxWidth: 220 }}>
        {caption}
      </Text>
    </View>
  );
}
