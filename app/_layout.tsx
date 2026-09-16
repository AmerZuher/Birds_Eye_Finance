import 'react-native-reanimated';
import '../global.css';

import React, { useCallback, useEffect } from 'react';
import { BackHandler, View } from 'react-native';
import { Stack, usePathname, useNavigationContainerRef } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { BlurTargetView } from 'expo-blur';
import { NavigationBar } from 'expo-navigation-bar';
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
import { ChromeProvider, useChrome } from '@/context/ChromeContext';
import { ModalPortalProvider, ModalPortalOutlet } from '@/context/ModalPortalContext';
import { Header } from '@/components/Header';
import { Navbar } from '@/components/Navbar';
import { PendingPhotoRecovery } from '@/components/PendingPhotoRecovery';
import { NotificationRouting } from '@/components/NotificationRouting';
import { RemindersProvider } from '@/context/RemindersContext';
import { THEMES } from '@/constants/theme';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { DatabaseProvider } from '@/context/DatabaseContext';
import { DebtsProvider } from '@/context/DebtsContext';
import { removeRetiredKeys } from '@/lib/mmkv';

SplashScreen.preventAutoHideAsync().catch(() => {});
removeRetiredKeys();

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
  const { blurTarget } = useChrome();

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

  // Dark system-bar icons on light themes, light ones on dark themes.
  const systemBarStyle = theme.isLight ? 'dark' : 'light';

  return (
    <View style={{ flex: 1, backgroundColor: theme.ground }}>
      <AndroidBackHandler />
      <PendingPhotoRecovery />
      <NotificationRouting />
      {/* On Android, expo-blur's real blur methods need an explicit target to
          sample — they can't automatically blur "whatever's behind" a view
          the way iOS's system blur can. This wraps all route content as that
          shared target; GlassHeader's and Navbar's BlurViews both point at
          `blurTarget` from ChromeContext. No-ops to a plain View on iOS/web. */}
      <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            // `none`, not a native push animation — every screen runs the
            // shared Fade Rise itself (PageTransition), and a native
            // slide/fade underneath it would play a second, different
            // transition on top of that. Settings/About looked unchanged
            // until this came off. `contentStyle` below means the incoming
            // screen is already the right ground color on frame one, so
            // there's nothing to see before the fade starts.
            animation: 'none',
            contentStyle: { backgroundColor: theme.ground },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="about" />
        </Stack>
      </BlurTargetView>
      {/* Rendered after Stack so it paints above screen content — GlassHeader
          floats as an absolute overlay (rule 8) rather than pushing content
          down; see ChromeContext for how screens get clearance padding. */}
      <Header />
      {/* Same reasoning as Header: rendered as a sibling *after*
          BlurTargetView, not as (tabs)'s own tabBar slot (which would nest
          it inside the very content its BlurView needs to blur — see
          app/(tabs)/_layout.tsx). Navbar reads the active route/navigates
          itself now instead of receiving BottomTabBarProps. */}
      <Navbar />
      {/* GlassModal-based sheets render here (via ModalPortalContext) instead
          of wherever they're declared in the tree, so they paint above the
          header/navbar too and their BlurView can share `blurTarget`. */}
      <ModalPortalOutlet />
      <StatusBar style={systemBarStyle} />
      {/* The Android navigation bar stays transparent with no contrast layer
          (app.json: expo-navigation-bar `enforceContrast: false`) so the tab
          bar shows through under the gesture handle — MagicOS (Honor) drew a
          grey band there otherwise. Its icons follow the theme like the status bar. */}
      <NavigationBar style={systemBarStyle} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: initialGround }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          {/* Edge-to-edge on Android (gradle.properties) — both bars are translucent. */}
          <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
            <ThemeProvider>
              <LanguageProvider>
                <CurrencyProvider>
                  <UserProvider>
                    <DatabaseProvider>
                      <DebtsProvider>
                        <FinanceProvider>
                          <ChromeProvider>
                            <RemindersProvider>
                              <ModalPortalProvider>
                                <RootLayoutInner />
                              </ModalPortalProvider>
                            </RemindersProvider>
                          </ChromeProvider>
                        </FinanceProvider>
                      </DebtsProvider>
                    </DatabaseProvider>
                  </UserProvider>
                </CurrencyProvider>
              </LanguageProvider>
            </ThemeProvider>
          </KeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </View>
  );
}
