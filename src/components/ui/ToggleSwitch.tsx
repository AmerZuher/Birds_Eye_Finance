import React, { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/context/ThemeContext';

interface ToggleSwitchProps {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/** Themed on/off switch — the visual base is decorative-only where noted (e.g. Notifications row, Phase 1). */
export function ToggleSwitch({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: ToggleSwitchProps) {
  const { theme } = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 200 });
  }, [value, progress]);

  const knobStyle = useAnimatedStyle(() => ({
    start: 2 + progress.value * 15,
    backgroundColor: progress.value > 0.5 ? '#ffffff' : 'rgba(165,154,138,1)',
  }));

  return (
    <Pressable
      disabled={disabled}
      onPress={() => onValueChange?.(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={{
        width: 34,
        height: 19,
        borderRadius: 999,
        backgroundColor: value ? theme.accent1 : theme.surfaceAlt,
        borderWidth: value ? 0 : 1,
        borderColor: 'rgba(255,255,255,0.08)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Animated.View
        style={[
          { width: 13, height: 13, borderRadius: 999, position: 'absolute', top: 2 },
          knobStyle,
        ]}
      />
    </Pressable>
  );
}
