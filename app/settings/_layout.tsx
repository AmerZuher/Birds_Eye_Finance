import React from 'react';
import { Stack } from 'expo-router';

import { useTheme } from '@/context/ThemeContext';

export default function SettingsLayout() {
  const { theme } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.ground } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="data" />
    </Stack>
  );
}
