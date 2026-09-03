import 'react-native-reanimated';
import '../global.css';

import React, { useCallback, useEffect } from 'react';
import { BackHandler, View } from 'react-native';
import { Stack, usePathname, useNavigationContainerRef } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Fraunces_400Regular,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import { Manrope_400Regular, Manrope_500Medium, Manrope_700Bold } from '@expo-google-fonts/manrope';
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';

import { ThemeProvider, readInitialThemeId, useTheme } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { CurrencyProvider } from '@/context/CurrencyContext';
import { UserProvider } from '@/context/UserContext';
import { FinanceProvider } from '@/context/FinanceContext';
import { Header } from '@/components/Header';
import { THEMES } from '@/constants/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Rule 2: theme is read synchronously from MMKV before the first paint, so
// the ground color below is correct on frame one — no flash of wrong colors.
const initialGround = THEMES[readInitialThemeId()].ground;

function AndroidBackHandler() {
  const pathname = usePathname();
  const navigationRef = useNavigationContainerRef();

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const canGoBack = navigationRef?.isReady() && navigationRef.canGoBack();
      if (!canGoBack && pathname === '/') {
        // Dashboard root — swallow back press to prevent accidental exit (FEATURE_SPEC 0.2).
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [pathname, navigationRef]);

  return null;
}

function RootLayoutInner() {
  const { theme } = useTheme();

  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_700Bold,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_700Bold,
  });

  const onLayout = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    onLayout();
  }, [onLayout]);

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.ground }}>
      <AndroidBackHandler />
      <Header />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="about" />
      </Stack>
      <StatusBar style="light" />
    </View>
  );
}

export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: initialGround }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <LanguageProvider>
              <CurrencyProvider>
                <UserProvider>
                  <FinanceProvider>
                    <RootLayoutInner />
                  </FinanceProvider>
                </UserProvider>
              </CurrencyProvider>
            </LanguageProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </View>
  );
}
