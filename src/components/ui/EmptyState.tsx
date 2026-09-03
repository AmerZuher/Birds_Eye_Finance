import React from 'react';
import { Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Inbox } from 'lucide-react-native';

import { TEXT } from '@/constants/theme';

interface EmptyStateProps {
  icon?: LucideIcon;
  caption: string;
}

/** Dashed border + muted icon + caption — used by every empty list, never reimplemented. */
export function EmptyState({ icon: Icon = Inbox, caption }: EmptyStateProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 32,
        borderRadius: 20,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(255,255,255,0.12)',
      }}
    >
      <Icon size={26} color={TEXT.tertiary} />
      <Text style={{ fontSize: 12, color: TEXT.tertiary, textAlign: 'center', maxWidth: 220 }}>
        {caption}
      </Text>
    </View>
  );
}
