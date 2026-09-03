/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability --
 * Reanimated shared values are mutated via `.value =` by design (not React
 * state), and this sheet's mount/unmount must lag one animation behind the
 * `visible` prop — both are false positives against the intended pattern. */
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/context/ThemeContext';
import { GLASS, RADII, TEXT } from '@/constants/theme';

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
}

/**
 * Bottom sheet: drag handle, swipe-to-dismiss, backdrop (rule 8 — Reanimated).
 * Callers control `visible`; GlassModal manages its own mount/unmount timing
 * so the close animation can finish before the content unmounts.
 */
export function GlassModal({ visible, onClose, title, children }: GlassModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
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

  if (!mounted) return null;

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose}>
      {/* RN's Modal renders into its own native window, outside the app's
          root GestureHandlerRootView — without this nested one, gesture-handler
          gestures (the pan below) silently never fire inside a Modal at all. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
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
                backgroundColor: theme.surface,
                paddingTop: 14,
              },
              sheetStyle,
            ]}
          >
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
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
