import React from 'react';
import { Stack } from 'expo-router';

import { useTheme } from '@/context/ThemeContext';

export default function SettingsLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Same reasoning as the root Stack — PageTransition owns the motion,
        // so this nested navigator mustn't add a platform push animation of
        // its own on top of it (this is what edit-profile/data were still
        // sliding in with).
        animation: 'none',
        contentStyle: { backgroundColor: theme.ground },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="data" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
