/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability --
 * Reanimated shared values are mutated via `.value =` by design (not React
 * state), and this sheet's mount/unmount must lag one animation behind the
 * `visible` prop — both are false positives against the intended pattern. */
import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/context/ThemeContext';
import { GLASS, RADII, TEXT } from '@/constants/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 800;

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
      translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
      backdropOpacity.value = withTiming(1, { duration: 220 });
    } else if (mounted) {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 220 });
      backdropOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
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
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
        backdropOpacity.value = withTiming(0, { duration: 200 }, (finished) => {
          if (finished) {
            runOnJS(setMounted)(false);
            runOnJS(closeNow)();
          }
        });
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
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
              maxHeight: '90%',
              borderTopLeftRadius: RADII.sheet,
              borderTopRightRadius: RADII.sheet,
              borderTopWidth: 3,
              borderTopColor: theme.fab,
              backgroundColor: theme.surface,
              paddingHorizontal: 18,
              paddingTop: 14,
              paddingBottom: insets.bottom + 22,
              gap: 14,
            },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={pan}>
            <View style={{ paddingVertical: 6 }}>
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
          </GestureDetector>
          {title ? (
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: TEXT.primary,
                textAlign: 'center',
                marginTop: -8,
              }}
            >
              {title}
            </Text>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
