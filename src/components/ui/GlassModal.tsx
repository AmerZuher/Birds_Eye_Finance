/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability --
 * Reanimated shared values are mutated via `.value =` by design (not React
 * state), and this sheet's mount/unmount must lag one animation behind the
 * `visible` prop — both are false positives against the intended pattern. */
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  BackHandler,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  useKeyboardHandler,
  useReanimatedFocusedInput,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/context/ThemeContext';
import { useChrome } from '@/context/ChromeContext';
import { useModalPortal } from '@/context/ModalPortalContext';
import { ANDROID_BLUR_METHOD, GLASS_BLUR_INTENSITY, RADII, getThemeGlass } from '@/constants/theme';
import { CHROME_GROUND_ALPHA, hexToRgb } from '@/utils/color';
import { HIDDEN_SCROLLBARS } from '@/lib/scroll';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 800;
// The sheet may grow to this share of the space above the keyboard (the whole
// container when the keyboard is closed) — the old static `maxHeight: '96%'`.
const SHEET_MAX_HEIGHT_RATIO = 0.96;
// Breathing room kept between a focused field and the keyboard's top edge.
const FOCUSED_INPUT_MARGIN = 24;
// Lets the lifted sheet's new size commit to layout before measuring against it.
const ENSURE_VISIBLE_DELAY_MS = 60;
// The sheet travels on the same curve and duration in both directions —
// cubic-bezier(0.22, 1, 0.36, 1) over 350ms — while the backdrop fades on a
// plain 300ms ease, exactly as the approved motion spec describes it. The
// curve is shared with the Fade Rise page transition (PageTransition.tsx) so
// screens and sheets move on one motion language rather than two.
const SHEET_TIMING = { duration: 350, easing: Easing.bezier(0.22, 1, 0.36, 1) };
const BACKDROP_TIMING = { duration: 300, easing: Easing.ease };

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
  const themeGlass = getThemeGlass(theme);
  const insets = useSafeAreaInsets();
  const { blurTarget } = useChrome();
  const { showModal, hideModal } = useModalPortal();
  const modalId = useId();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  // Set when an open is armed but the sheet hasn't been laid out yet; the
  // sheet's own onLayout is what actually starts the travel. See below.
  const openPending = useRef(false);

  useEffect(() => {
    if (visible && !mounted) {
      // Deliberately does NOT start the animation here. This sheet doesn't
      // render itself — it hands `content` to ModalPortalContext, which means
      // it only reaches the screen after this render, then the portal's
      // showModal effect, then ModalPortalOutlet's own re-render, then layout
      // of whatever form it's wrapping (DebtModal/ExpenseModal are big
      // react-hook-form trees). A timing started here runs on the UI thread
      // through all of those frames while there's still nothing on screen, so
      // the sheet first becomes visible already most of the way to 0 and
      // reads as a pop-in rather than a slide.
      //
      // Same hazard the reference implementation solves with `void
      // modal.offsetWidth` — the initial offscreen state has to be committed
      // before the transition is allowed to run. Here the honest signal that
      // the sheet exists at its start position is its own onLayout, so the
      // travel is armed now and started there.
      translateY.value = SCREEN_HEIGHT;
      backdropOpacity.value = 0;
      openPending.current = true;
      setMounted(true);
    } else if (visible) {
      // Already on screen — reopened mid-close, so the view is real and
      // there's nothing to wait for.
      openPending.current = false;
      translateY.value = withTiming(0, SHEET_TIMING);
      backdropOpacity.value = withTiming(1, BACKDROP_TIMING);
    } else if (mounted) {
      // Unmount is gated on the *sheet*, not the backdrop — the sheet is now
      // the longer of the two (350ms vs 300ms), so hanging it off the
      // backdrop would cut the slide-out short by its last 50ms.
      openPending.current = false;
      translateY.value = withTiming(SCREEN_HEIGHT, SHEET_TIMING, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
      backdropOpacity.value = withTiming(0, BACKDROP_TIMING);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  /**
   * The sheet exists and has been measured at its offscreen start position —
   * only now can the slide actually be seen, so this is where it starts. The
   * ref guard means later layout passes (keyboard opening, the form growing)
   * don't restart it.
   */
  const onSheetLayout = () => {
    if (!openPending.current) return;
    openPending.current = false;
    translateY.value = withTiming(0, SHEET_TIMING);
    backdropOpacity.value = withTiming(1, BACKDROP_TIMING);
  };

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
        translateY.value = withTiming(SCREEN_HEIGHT, SHEET_TIMING, (finished) => {
          if (finished) {
            runOnJS(setMounted)(false);
            runOnJS(closeNow)();
          }
        });
        backdropOpacity.value = withTiming(0, BACKDROP_TIMING);
      } else {
        translateY.value = withTiming(0, SHEET_TIMING);
      }
    });

  // Keyboard (FEATURE_SPEC 0.9). The app is edge-to-edge on Android, where
  // `adjustResize` no longer shrinks the window, and this sheet renders in the
  // root view via the portal — so nothing would move on its own. Instead the
  // sheet lifts itself: its bottom margin tracks the keyboard's live height and
  // its max height shrinks by the same amount, keeping the whole sheet (and its
  // scroll viewport) above the keyboard on every frame of the animation. The
  // focused field is then scrolled into that viewport. Deliberately not a
  // KeyboardAwareScrollView as well — both would compensate for the same
  // keyboard and over-scroll.
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const { input: focusedInput } = useReanimatedFocusedInput();
  const [containerHeight, setContainerHeight] = useState(SCREEN_HEIGHT);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const viewportHeight = useRef(0);
  const visibleRef = useRef(visible);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const ensureFocusedInputVisible = useCallback(() => {
    const scroll = scrollRef.current;
    const inner = scroll?.getInnerViewNode();
    const input = TextInput.State.currentlyFocusedInput();
    if (!visibleRef.current || !scroll || !inner || !input) return;
    input.measureLayout(
      inner,
      (_x, y, _width, height) => {
        const top = scrollOffset.current;
        const viewport = viewportHeight.current;
        if (y + height + FOCUSED_INPUT_MARGIN > top + viewport) {
          scroll.scrollTo({ y: y + height + FOCUSED_INPUT_MARGIN - viewport, animated: true });
        } else if (y - FOCUSED_INPUT_MARGIN < top) {
          scroll.scrollTo({ y: Math.max(0, y - FOCUSED_INPUT_MARGIN), animated: true });
        }
      },
      () => {
        // The focused input isn't inside this sheet's scroll view (e.g. it
        // belongs to a nested sheet on top) — not this sheet's to scroll.
      },
    );
  }, []);

  const scheduleEnsureVisible = useCallback(() => {
    setTimeout(ensureFocusedInputVisible, ENSURE_VISIBLE_DELAY_MS);
  }, [ensureFocusedInputVisible]);

  useKeyboardHandler(
    {
      onEnd: (e) => {
        'worklet';
        if (e.height > 0) runOnJS(scheduleEnsureVisible)();
      },
    },
    [scheduleEnsureVisible],
  );

  // Moving focus between fields while the keyboard stays open fires no
  // keyboard event, so the focused input's identity is watched as well.
  useAnimatedReaction(
    () => focusedInput.value?.target ?? -1,
    (target, previous) => {
      if (target !== -1 && target !== previous && keyboardHeight.value !== 0) {
        runOnJS(scheduleEnsureVisible)();
      }
    },
    [scheduleEnsureVisible],
  );

  const onContainerLayout = (e: LayoutChangeEvent) => {
    setContainerHeight(e.nativeEvent.layout.height);
  };
  const onViewportLayout = (e: LayoutChangeEvent) => {
    viewportHeight.current = e.nativeEvent.layout.height;
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = e.nativeEvent.contentOffset.y;
  };

  const sheetStyle = useAnimatedStyle(() => {
    // Sign-agnostic: only the keyboard's magnitude matters here.
    const lift = Math.abs(keyboardHeight.value);
    return {
      transform: [{ translateY: translateY.value }],
      marginBottom: lift,
      maxHeight: containerHeight * SHEET_MAX_HEIGHT_RATIO - lift,
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const content = mounted ? (
    <View style={{ position: 'absolute', inset: 0, zIndex: 100 }}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }} onLayout={onContainerLayout}>
        <Animated.View
          style={[
            { position: 'absolute', inset: 0, backgroundColor: themeGlass.overlay },
            backdropStyle,
          ]}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View
          onLayout={onSheetLayout}
          style={[
            {
              borderTopLeftRadius: RADII.sheet,
              borderTopRightRadius: RADII.sheet,
              borderWidth: 1,
              borderBottomWidth: 0,
              // theme.glow.b, not GLASS.border's neutral white — matches
              // GlassHeader's edge stroke so the sheet reads as the same
              // material as the header/navbar rather than a separate one.
              // (Navbar's own edge is still at 0.32, not yet brought down to
              // this 0.15 — the three aren't fully reconciled with each
              // other yet, this just stops the modal from being the one
              // most different of the three.)
              borderColor: `rgba(${theme.glow.b},0.15)`,
              overflow: 'hidden',
              backgroundColor: theme.surface,
            },
            sheetStyle,
          ]}
        >
          {/* Same glass material as the header/navbar (rule 8): a real
              BlurView (now possible — this sheet lives in the main window,
              sharing `blurTarget`) washed the same way. Deliberately no
              `elevation` anywhere on this sheet — combined with BlurView +
              overflow:hidden, elevation is what caused the FAB's native
              crash earlier (see Navbar.tsx); the border above carries the
              visual separation instead. */}
          <BlurView
            intensity={GLASS_BLUR_INTENSITY}
            tint={theme.isLight ? 'light' : 'dark'}
            blurMethod={ANDROID_BLUR_METHOD}
            blurTarget={blurTarget}
            style={StyleSheet.absoluteFill}
          />
          {/* theme.ground at CHROME_GROUND_ALPHA — the exact wash Header and
              Navbar use (see GlassHeader.tsx), not theme.surface: this sheet
              is meant to read as the same material as those two floating
              bars, not as a lighter panel sitting on top of the page. No
              LinearGradient layered on top either, for the same reason —
              Header/Navbar skip that white gradient entirely (see the
              CHROME_GROUND_ALPHA comment in utils/color.ts); adding it here
              was what made this sheet look like a visibly different,
              lighter material even with the wash color itself matching. */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: `rgba(${hexToRgb(theme.ground)},${CHROME_GROUND_ALPHA})` },
            ]}
          />
          {/* flexShrink/minHeight:0 on every link in this chain down to the
              ScrollView itself — without it, Yoga sizes each View to its
              content's natural (unbounded) height and only the outermost
              `overflow:hidden` clips the excess, which *hides* overflow
              content instead of making it reachable by scrolling. maxHeight
              on the sheet above only caps the box; these are what let the
              ScrollView inside actually shrink into that box and scroll. */}
          <View style={{ paddingTop: 14, flexShrink: 1, minHeight: 0 }}>
            {/* Handle + title share the swipe zone — a bigger, easier target
                than the 4px pill alone, and the pill's only purpose is to
                signal that this whole area drags. */}
            <GestureDetector gesture={pan}>
              <View style={{ width: '100%' }}>
                <View style={{ paddingVertical: 14 }}>
                  <View
                    style={{
                      width: 50,
                      height: 4,
                      borderRadius: RADII.pill,
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
                      color: theme.textPrimary,
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
            <View style={{ flexShrink: 1, minHeight: 0 }}>
              {scrollable ? (
                <ScrollView
                  ref={scrollRef}
                  style={{ flexShrink: 1 }}
                  keyboardShouldPersistTaps="handled"
                  {...HIDDEN_SCROLLBARS}
                  scrollEventThrottle={16}
                  onScroll={onScroll}
                  onLayout={onViewportLayout}
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
            </View>
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
