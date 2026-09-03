import React from 'react';
import { Tabs } from 'expo-router/js-tabs';

import { Navbar } from '@/components/Navbar';
import { useTheme } from '@/context/ThemeContext';

export default function TabsLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.ground } }}
      tabBar={(props) => <Navbar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="expenses" />
      <Tabs.Screen name="debts" />
    </Tabs>
  );
}
