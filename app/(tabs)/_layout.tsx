import React from 'react';
import { Tabs } from 'expo-router/js-tabs';

import { useTheme } from '@/context/ThemeContext';

// `tabBar` renders nothing here — Navbar is rendered separately, as a root
// sibling in app/_layout.tsx alongside Header, instead of as this Tabs'
// own tabBar slot. Reason: this whole (tabs) route lives inside the root
// layout's `BlurTargetView`, so a BlurView rendered as *this* Tabs'
// built-in tabBar would be nested inside the very content it's supposed to
// blur, which on Android silently no-ops to a flat tint instead of a real
// blur — Header doesn't have this problem because it renders as a sibling
// *after* BlurTargetView, not inside it.
export default function TabsLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.ground } }}
      tabBar={() => null}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="analytics" />
      <Tabs.Screen name="expenses" />
      <Tabs.Screen name="debts" />
    </Tabs>
  );
}
