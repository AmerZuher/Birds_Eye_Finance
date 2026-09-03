import React from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { CreditCard, Home, Plus, Wallet } from 'lucide-react-native';

import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useChrome } from '@/context/ChromeContext';
import { ANDROID_BLUR_METHOD, GLASS, TEXT } from '@/constants/theme';
import { CHROME_SURFACE_ALPHA, hexToRgb } from '@/utils/color';

const TABS: { path: '/' | '/expenses' | '/debts'; icon: typeof Home; labelKey: string }[] = [
  { path: '/', icon: Home, labelKey: 'nav.dashboard' },
  { path: '/expenses', icon: CreditCard, labelKey: 'nav.expenses' },
  { path: '/debts', icon: Wallet, labelKey: 'nav.debts' },
];

/**
 * App-specific bottom glassmorphic tab bar + FAB (FEATURE_SPEC 0.1, rule 8).
 * Rendered as a root-level sibling in app/_layout.tsx (like Header), *not*
 * as (tabs)'s own tabBar slot — see app/(tabs)/_layout.tsx for why: a
 * BlurView rendered as the tabBar would be nested inside the same
 * BlurTargetView subtree it needs to blur, which silently no-ops to a flat
 * tint on Android instead of a real blur. Being a plain sibling means it
 * reads the active route and navigates itself, rather than receiving
 * react-navigation's BottomTabBarProps.
 *
 * An absolutely-positioned overlay pinned to the bottom — tab content fills
 * the full screen and scrolls underneath it (what the BlurView blurs)
 * instead of being pushed up to make room for it. Reports its own rendered
 * height via ChromeContext so tab screens know how much bottom padding they
 * need.
 */
export function Navbar() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { setNavbarHeight, blurTarget, triggerFab } = useChrome();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Chrome (this bar + the FAB) only makes sense over the three tab
  // screens — Settings/About/etc. render their own back+title header and
  // have no tab bar at all.
  const isTabRoute = TABS.some((tab) => tab.path === pathname);
  if (!isTabRoute) return null;

  const fabHidden = pathname === '/';

  const onLayout = (e: LayoutChangeEvent) => {
    setNavbarHeight(e.nativeEvent.layout.height);
  };

  return (
    <View
      onLayout={onLayout}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        paddingBottom: Math.max(insets.bottom, 8) - 8,
      }}
    >
      <View
        style={{
          marginHorizontal: 14,
          marginBottom: 14,
          borderRadius: 22,
          overflow: 'visible',
        }}
      >
        {!fabHidden && (
          <View
            style={{
              position: 'absolute',
              left: 14,
              top: -56,
              zIndex: 10,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.add')}
              onPress={triggerFab}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                // Same surface color as the cards/navbar (rather than the
                // bright accent fill) so the FAB reads as part of the same
                // material. A solid color, not a second BlurView — an
                // earlier attempt at an actual blurred glass FAB, sitting
                // right next to the navbar's own BlurView on the same
                // blurTarget with elevation + overflow:hidden layered on
                // top, caused a native SIGSEGV (HWUI's computeTransformImpl
                // recursing until the RenderThread's stack overflowed) as
                // soon as the FAB rendered — i.e. on every screen but
                // Dashboard.
                backgroundColor: `rgba(${hexToRgb(theme.surface)},0.94)`,
                borderWidth: 1,
                borderColor: GLASS.border,
                shadowColor: `rgb(${theme.glow.a})`,
                shadowOpacity: 0.5,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 8 },
                elevation: 8,
              }}
            >
              <Plus size={22} color={TEXT.primary} strokeWidth={2.6} />
            </Pressable>
          </View>
        )}

        <View
          style={{
            borderRadius: 22,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: GLASS.border,
          }}
        >
          <BlurView
            intensity={GLASS.blurIntensity}
            tint="dark"
            blurMethod={ANDROID_BLUR_METHOD}
            blurTarget={blurTarget}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              // Same color as the cards (theme.surface) — see GlassHeader.
              { backgroundColor: `rgba(${hexToRgb(theme.surface)},${CHROME_SURFACE_ALPHA})` },
            ]}
          />
          <LinearGradient
            colors={[GLASS.gradientTop, GLASS.gradientBottom]}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-around',
              paddingTop: 10,
              paddingBottom: 6,
              paddingHorizontal: 10,
            }}
          >
            {TABS.map((tab) => {
              const isFocused = pathname === tab.path;
              const Icon = tab.icon;

              const onPress = () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (!isFocused) {
                  router.navigate(tab.path);
                }
              };

              return (
                <Pressable
                  key={tab.path}
                  onPress={onPress}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={t(tab.labelKey)}
                  style={{ alignItems: 'center', gap: 3, paddingVertical: 2, paddingHorizontal: 6 }}
                >
                  <Icon
                    size={19}
                    color={isFocused ? theme.accent2 : TEXT.tertiary}
                    strokeWidth={isFocused ? 2.4 : 2}
                  />
                  <Text
                    style={{
                      fontSize: 9.5,
                      fontWeight: isFocused ? '700' : '600',
                      color: isFocused ? TEXT.primary : TEXT.tertiary,
                    }}
                  >
                    {t(tab.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}
