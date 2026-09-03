import React from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import MaskedView from '@react-native-masked-view/masked-view';
import * as Haptics from 'expo-haptics';
import { ChartPie, HandCoins, LayoutDashboard, Plus, ReceiptText } from 'lucide-react-native';

import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useChrome } from '@/context/ChromeContext';
import { ANDROID_BLUR_METHOD, GLASS } from '@/constants/theme';
import { CHROME_GROUND_ALPHA, hexToRgb } from '@/utils/color';

// Neutral white-alpha icon greys rather than TEXT.tertiary (`#6b6255`), a warm
// brown-grey from the original palette that reads muddy against these cool
// (indigo/teal) themes.
const ICON_INACTIVE = 'rgba(255,255,255,0.42)';
const ICON_ACTIVE = '#ffffff';

type TabPath = '/' | '/analytics' | '/expenses' | '/debts';

interface TabDef {
  path: TabPath;
  icon: typeof LayoutDashboard;
  labelKey: string;
}

// Two tabs each side of the centre notch. Icons picked for what each screen
// actually is rather than FEATURE_SPEC 0.1's originals: a dashboard grid for
// the overview, an itemised receipt for spending, and coins changing hands for
// debts — a Wallet implied "my money", which is the wrong idea for a screen
// about who owes whom.
const LEFT_TABS: TabDef[] = [
  { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/analytics', icon: ChartPie, labelKey: 'nav.analytics' },
];

const RIGHT_TABS: TabDef[] = [
  { path: '/expenses', icon: ReceiptText, labelKey: 'nav.expenses' },
  { path: '/debts', icon: HandCoins, labelKey: 'nav.debts' },
];

const TABS = [...LEFT_TABS, ...RIGHT_TABS];

// Notch geometry, derived from the approved spec's SVG mask (viewBox width
// 390) and then tightened: the dip is deeper (34 vs 28) and narrower
// (x=145→245 vs 135→255) so it grips the button harder from the sides.
const VB_WIDTH = 390;
const NOTCH_DEPTH = 34;
const NOTCH_LEFT = 145;
const NOTCH_RIGHT = 245;
const NOTCH_CENTER = 195;

/** The bar's silhouette: flat top edge interrupted by the dip, square sides. */
function barMaskPath(height: number) {
  return (
    `M0,0 L${NOTCH_LEFT},0 ` +
    `C159,0 165,${NOTCH_DEPTH} ${NOTCH_CENTER},${NOTCH_DEPTH} ` +
    `C225,${NOTCH_DEPTH} 231,0 ${NOTCH_RIGHT},0 ` +
    `L${VB_WIDTH},0 L${VB_WIDTH},${height} L0,${height} Z`
  );
}

/** Just the top edge, stroked so the hairline follows the curve. */
const NOTCH_EDGE_PATH =
  `M0,0 L${NOTCH_LEFT},0 ` +
  `C159,0 165,${NOTCH_DEPTH} ${NOTCH_CENTER},${NOTCH_DEPTH} ` +
  `C225,${NOTCH_DEPTH} 231,0 ${NOTCH_RIGHT},0 ` +
  `L${VB_WIDTH},0`;

const FAB_SIZE = 58;
// Clearance between the button's arc and the notch curve.
const FAB_GAP = 7;
// Sits the button's lower arc `FAB_GAP` above the floor of the dip. The mask
// is drawn at a fixed 1:1 vertical scale precisely so this stays constant —
// letting it scale with the safe-area inset would swing the button's exposed
// height by ~10% between devices.
const FAB_OFFSET = NOTCH_DEPTH - FAB_GAP - FAB_SIZE;

const ICON_SIZE = 26;
const INDICATOR_HEIGHT = 3;
const INDICATOR_GAP = 5;
// Icon + gap + active-underline, i.e. the full height of one tab's content.
const TAB_CONTENT_HEIGHT = ICON_SIZE + INDICATOR_GAP + INDICATOR_HEIGHT;
const BAR_PADDING_TOP = 18;
const BAR_PADDING_BOTTOM_MIN = 16;

/**
 * App-specific bottom glassmorphic tab bar + notched FAB (FEATURE_SPEC 0.1,
 * rule 8). Rendered as a root-level sibling in app/_layout.tsx (like Header),
 * *not* as (tabs)'s own tabBar slot — see app/(tabs)/_layout.tsx for why: a
 * BlurView rendered as the tabBar would be nested inside the same
 * BlurTargetView subtree it needs to blur, which silently no-ops to a flat
 * tint on Android instead of a real blur. Being a plain sibling means it
 * reads the active route and navigates itself, rather than receiving
 * react-navigation's BottomTabBarProps.
 *
 * An absolutely-positioned full-bleed overlay pinned to the bottom — tab
 * content fills the full screen and scrolls underneath it (what the BlurView
 * blurs) instead of being pushed up to make room for it. Reports its own
 * rendered height via ChromeContext so tab screens know how much bottom
 * padding they need.
 */
export function Navbar() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { setNavbarHeight, blurTarget, triggerFab, requestDebtCreate } = useChrome();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Chrome (this bar + the FAB) only makes sense over the tab screens —
  // Settings/About render their own back+title header and have no tab bar.
  const isTabRoute = TABS.some((tab) => tab.path === pathname);
  if (!isTabRoute) return null;

  // Computed rather than measured: the mask's SVG needs a concrete height on
  // the very first frame, and every term here is under this component's
  // control anyway.
  const barHeight =
    BAR_PADDING_TOP + TAB_CONTENT_HEIGHT + Math.max(insets.bottom, BAR_PADDING_BOTTOM_MIN);

  const onLayout = (e: LayoutChangeEvent) => {
    setNavbarHeight(e.nativeEvent.layout.height);
  };

  // The FAB is global now (it sits in the notch on every tab), and defaults
  // to creating a *debt* — Expenses is the one screen where it creates an
  // expense instead. From Dashboard/Analytics neither screen owns a handler,
  // so it routes to Debts and leaves a request for it to open on arrival.
  const onFabPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (pathname === '/expenses' || pathname === '/debts') {
      triggerFab();
      return;
    }
    requestDebtCreate();
    router.navigate('/debts');
  };

  const renderTab = (tab: TabDef) => {
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
        // Labels are visual-only in the reference design (icons alone, no
        // captions), so the translated name moves here — screen readers still
        // announce every tab by name (rule 12).
        accessibilityLabel={t(tab.labelKey)}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: INDICATOR_GAP }}
      >
        {/* Active tab is white with the accent underline beneath it; inactive
            tabs are neutral translucent white. */}
        <Icon
          size={ICON_SIZE}
          color={isFocused ? ICON_ACTIVE : ICON_INACTIVE}
          strokeWidth={isFocused ? 1.5 : 1.2}
        />
        {/* Always rendered so the row's spacing doesn't shift between tabs. */}
        <View
          style={{
            height: INDICATOR_HEIGHT,
            width: 16,
            borderRadius: 2,
            backgroundColor: isFocused ? theme.accent1 : 'transparent',
          }}
        />
      </Pressable>
    );
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
      }}
    >
      {/* Centre action button, nested into the notch carved below. No opaque
          ring around it — the notch itself provides the separation, so the
          button reads as cradled by the bar's edge rather than as a disc
          pasted on top of it. */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: FAB_OFFSET,
          alignItems: 'center',
          zIndex: 10,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.add')}
          onPress={onFabPress}
          style={{
            width: FAB_SIZE,
            height: FAB_SIZE,
            borderRadius: FAB_SIZE / 2,
            alignItems: 'center',
            justifyContent: 'center',
            // A solid fill, not a second BlurView — an earlier attempt at an
            // actual blurred glass FAB, sitting right next to the navbar's
            // own BlurView on the same blurTarget with elevation +
            // overflow:hidden layered on top, caused a native SIGSEGV
            // (HWUI's computeTransformImpl recursing until the RenderThread's
            // stack overflowed) as soon as the FAB rendered.
            backgroundColor: theme.fab,
            shadowColor: `rgb(${theme.glow.a})`,
            shadowOpacity: 0.65,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 10,
          }}
        >
          <Plus size={26} color={theme.buttonText} strokeWidth={2.2} />
        </Pressable>
      </View>

      <View style={{ height: barHeight }}>
        {/* The glass is genuinely clipped to the notched silhouette rather
            than having the dip painted over it in the ground colour, so the
            notch is truly transparent and content scrolls through it. The
            mask wraps only the visual layers — the tab row sits outside it, so
            touches never have to travel through the masked layer. */}
        <MaskedView
          style={StyleSheet.absoluteFill}
          maskElement={
            // 1:1 vertically (height === viewBox height) so the dip stays
            // exactly NOTCH_DEPTH px deep regardless of the safe-area inset;
            // `preserveAspectRatio="none"` stretches horizontally only.
            <Svg
              width={width}
              height={barHeight}
              viewBox={`0 0 ${VB_WIDTH} ${barHeight}`}
              preserveAspectRatio="none"
            >
              <Path d={barMaskPath(barHeight)} fill="#000" />
            </Svg>
          }
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
              { backgroundColor: `rgba(${hexToRgb(theme.ground)},${CHROME_GROUND_ALPHA})` },
            ]}
          />
        </MaskedView>
        {/* Drawn on top of the mask, not inside it — a stroke sitting on the
            mask boundary would otherwise have its outer half clipped away. */}
        <Svg
          width={width}
          height={NOTCH_DEPTH + 4}
          viewBox={`0 0 ${VB_WIDTH} ${NOTCH_DEPTH + 4}`}
          preserveAspectRatio="none"
          style={{ position: 'absolute', top: 0, left: 0 }}
          pointerEvents="none"
        >
          <Path
            d={NOTCH_EDGE_PATH}
            stroke={`rgba(${theme.glow.b},0.32)`}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            fill="none"
          />
        </Svg>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            // Padding sums to `barHeight`, which the mask is drawn against.
            paddingTop: BAR_PADDING_TOP,
            paddingBottom: Math.max(insets.bottom, BAR_PADDING_BOTTOM_MIN),
            paddingHorizontal: 4,
          }}
        >
          {LEFT_TABS.map(renderTab)}
          {/* Gap the notch and its FAB sit in — the spec's x=135→255 span,
              scaled to this device's width the same way the mask is. */}
          <View style={{ width: ((NOTCH_RIGHT - NOTCH_LEFT) / VB_WIDTH) * width }} />
          {RIGHT_TABS.map(renderTab)}
        </View>
      </View>
    </View>
  );
}
