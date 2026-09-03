/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability --
 * Reanimated shared values are mutated via `.value =` by design (not React
 * state), and this sheet's mount/unmount must lag one animation behind the
 * `visible` prop — both are false positives against the intended pattern. */
import React, { useEffect, useId, useState } from 'react';
import {
  BackHandler,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/context/ThemeContext';
import { useChrome } from '@/context/ChromeContext';
import { useModalPortal } from '@/context/ModalPortalContext';
import { ANDROID_BLUR_METHOD, GLASS, RADII, TEXT } from '@/constants/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 800;
// Plain timing beats a spring here — a bottom sheet that opens/closes on
// every tap shouldn't bounce or linger; quick and settled reads faster.
const OPEN_TIMING = { duration: 180, easing: Easing.out(Easing.cubic) };
const CLOSE_TIMING = { duration: 140, easing: Easing.in(Easing.cubic) };

interface GlassModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** False when children manage their own scrolling (e.g. a FlatList) — skips the internal ScrollView, since nesting a VirtualizedList inside one breaks virtualization. */
  scrollable?: boolean;
}

/**
 * Bottom sheet: drag handle, swipe-to-dismiss, backdrop, real glass blur
 * (rule 8 — Reanimated + expo-blur). Renders via ModalPortalContext instead
 * of RN's own `Modal` — a Modal's separate native window can't reach the
 * app's shared `blurTarget`, so this sheet needs to live in the main window
 * (like the header/navbar) for its blur to actually sample real content.
 * That also means Android back is handled manually here (Modal normally
 * does this via onRequestClose) and gestures work through the app's own
 * root GestureHandlerRootView with no extra wrapper needed.
 *
 * Callers control `visible`; GlassModal manages its own mount/unmount
 * timing so the close animation can finish before content unmounts.
 */
export function GlassModal({
  visible,
  onClose,
  title,
  children,
  scrollable = true,
}: GlassModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { blurTarget } = useChrome();
  const { showModal, hideModal } = useModalPortal();
  const modalId = useId();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = withTiming(0, OPEN_TIMING);
      backdropOpacity.value = withTiming(1, { duration: 140 });
    } else if (mounted) {
      translateY.value = withTiming(SCREEN_HEIGHT, CLOSE_TIMING);
      backdropOpacity.value = withTiming(0, { duration: 140 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Registered only while visible, so nested sheets (e.g. a currency
  // CustomSelect opened from inside DebtModal) close innermost-first via
  // RN's LIFO BackHandler stack — same pattern as the Debts screen's own
  // person-detail/history back-handling.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const closeNow = () => onClose();

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        translateY.value = withTiming(SCREEN_HEIGHT, CLOSE_TIMING);
        backdropOpacity.value = withTiming(0, { duration: 140 }, (finished) => {
          if (finished) {
            runOnJS(setMounted)(false);
            runOnJS(closeNow)();
          }
        });
      } else {
        translateY.value = withTiming(0, OPEN_TIMING);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const content = mounted ? (
    <View style={{ position: 'absolute', inset: 0, zIndex: 100 }}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={[
            { position: 'absolute', inset: 0, backgroundColor: GLASS.overlay },
            backdropStyle,
          ]}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            {
              maxHeight: '94%',
              borderTopLeftRadius: RADII.sheet,
              borderTopRightRadius: RADII.sheet,
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: GLASS.border,
              overflow: 'hidden',
              backgroundColor: theme.surface,
            },
            sheetStyle,
          ]}
        >
          {/* Same glass material as the header/navbar (rule 8): a real
              BlurView (now possible — this sheet lives in the main window,
              sharing `blurTarget`) plus the same chromeTint wash + gradient.
              Deliberately no `elevation` anywhere on this sheet — combined
              with BlurView + overflow:hidden, elevation is what caused the
              FAB's native crash earlier (see Navbar.tsx); the border above
              carries the visual separation instead. */}
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
          <View style={{ paddingTop: 14 }}>
            {/* Handle + title share the swipe zone — a bigger, easier target
                than the 4px pill alone, and the pill's only purpose is to
                signal that this whole area drags. */}
            <GestureDetector gesture={pan}>
              <View style={{ width: '100%' }}>
                <View style={{ paddingVertical: 14 }}>
                  <View
                    style={{
                      width: 36,
                      height: 4,
                      borderRadius: 4,
                      backgroundColor: `rgba(${theme.glow.a},0.5)`,
                      alignSelf: 'center',
                    }}
                  />
                </View>
                {title ? (
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: TEXT.primary,
                      textAlign: 'center',
                      marginBottom: 8,
                      paddingHorizontal: 18,
                    }}
                  >
                    {title}
                  </Text>
                ) : null}
              </View>
            </GestureDetector>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              {scrollable ? (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: 18,
                    paddingBottom: insets.bottom + 40,
                    gap: 14,
                  }}
                >
                  {children}
                </ScrollView>
              ) : (
                <View style={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 40, gap: 14 }}>
                  {children}
                </View>
              )}
            </KeyboardAvoidingView>
          </View>
        </Animated.View>
      </View>
    </View>
  ) : null;

  // Re-syncs the portal's copy of this sheet after every render (no dep
  // array) so it's never stale — cheap here since GlassModal itself only
  // re-renders on real prop/state changes, not on animation frames (those
  // mutate shared values directly, bypassing React entirely).
  useEffect(() => {
    if (content) {
      showModal(modalId, content);
    } else {
      hideModal(modalId);
    }
  });

  useEffect(() => {
    return () => hideModal(modalId);
  }, [modalId, hideModal]);

  return null;
}
