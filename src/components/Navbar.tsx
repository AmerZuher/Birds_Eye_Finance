import React from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { CreditCard, Home, Plus, Wallet } from 'lucide-react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useChrome } from '@/context/ChromeContext';
import { ANDROID_BLUR_METHOD, GLASS, TEXT } from '@/constants/theme';

const TAB_META: Record<string, { icon: typeof Home; labelKey: string }> = {
  index: { icon: Home, labelKey: 'nav.dashboard' },
  expenses: { icon: CreditCard, labelKey: 'nav.expenses' },
  debts: { icon: Wallet, labelKey: 'nav.debts' },
};

/**
 * App-specific bottom glassmorphic tab bar + FAB (FEATURE_SPEC 0.1, rule 8).
 * Supplied to <Tabs screenOptions={{ tabBar: (props) => <Navbar {...props} /> }}>.
 * An absolutely-positioned overlay pinned to the bottom — tab content fills
 * the full screen and scrolls underneath it (what the BlurView blurs)
 * instead of being pushed up to make room for it. Reports its own rendered
 * height via ChromeContext so tab screens know how much bottom padding they
 * need.
 */
export function Navbar({ state, navigation, insets }: BottomTabBarProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { setNavbarHeight, blurTarget } = useChrome();

  const activeRouteName = state.routes[state.index]?.name;
  const fabHidden = activeRouteName === 'index';

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
              accessibilityLabel="Add"
              onPress={() => {
                // Wired to DebtModal/ExpenseModal in Phases 3-4.
              }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: theme.fab,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.25)',
                shadowColor: `rgb(${theme.glow.a})`,
                shadowOpacity: 0.7,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 8 },
                elevation: 8,
              }}
            >
              <Plus size={22} color={theme.buttonText} strokeWidth={2.6} />
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
              { backgroundColor: `rgba(${theme.chromeTint},${GLASS.tintAlpha})` },
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
            {state.routes.map((route, index) => {
              const meta = TAB_META[route.name];
              if (!meta) return null;
              const isFocused = state.index === index;
              const Icon = meta.icon;

              const onPress = () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              return (
                <Pressable
                  key={route.key}
                  onPress={onPress}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={t(meta.labelKey)}
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
                    {t(meta.labelKey)}
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
