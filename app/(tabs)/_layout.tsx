import React from 'react';
import { Tabs } from 'expo-router/js-tabs';

import { Navbar } from '@/components/Navbar';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <Navbar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="expenses" />
      <Tabs.Screen name="debts" />
    </Tabs>
  );
}
