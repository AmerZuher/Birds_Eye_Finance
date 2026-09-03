import React from 'react';
import { Pressable, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useLanguage } from '@/context/LanguageContext';
import { TEXT } from '@/constants/theme';

interface IconButtonProps {
  icon: LucideIcon;
  onPress?: () => void;
  accessibilityLabel: string;
  size?: number;
  iconSize?: number;
  color?: string;
  variant?: 'ghost' | 'surface';
  /** Mirror the icon horizontally in RTL — for back arrows / chevrons. */
  directional?: boolean;
}

/** Circular icon tap target — back/edit/delete/chevron — with RTL flip built in. */
export function IconButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  size = 32,
  iconSize = 16,
  color,
  variant = 'surface',
  directional = false,
}: IconButtonProps) {
  const { isRTL } = useLanguage();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={{
        width: size,
        height: size,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: variant === 'surface' ? 'rgba(255,255,255,0.08)' : 'transparent',
        borderWidth: variant === 'surface' ? 1 : 0,
        borderColor: 'rgba(255,255,255,0.12)',
      }}
    >
      <View style={directional && isRTL ? { transform: [{ scaleX: -1 }] } : undefined}>
        <Icon size={iconSize} color={color ?? TEXT.primary} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}
