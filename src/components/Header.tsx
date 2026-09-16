import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft } from 'lucide-react-native';

import { GlassHeader } from '@/components/ui/GlassHeader';
import { IconButton } from '@/components/ui/IconButton';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useUser } from '@/context/UserContext';
import { FONTS } from '@/constants/theme';
import { avatarDisplayUri } from '@/lib/avatars';

const SETTINGS_TITLES: Record<string, string> = {
  '/settings': 'settings.title',
  '/settings/edit-profile': 'settings.editProfile',
  '/settings/data': 'settings.backupData',
  '/settings/notifications': 'settings.notifications',
  '/settings/updates': 'settings.updates',
};

/**
 * App-specific composition of the GlassHeader primitive (FEATURE_SPEC 0.1).
 * Swaps between the default brand/avatar row and the Settings/About
 * back+title row depending on the active route — same GlassHeader slot.
 */
export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { profile } = useUser();
  const appLogo = require('../../assets/icon.png');

  const isSettings = pathname.startsWith('/settings');
  const isAbout = pathname === '/about';

  if (isSettings || isAbout) {
    const titleKey = isAbout ? 'app.name' : (SETTINGS_TITLES[pathname] ?? 'settings.title');
    return (
      <GlassHeader>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconButton
            icon={ArrowLeft}
            accessibilityLabel={t('settings.back')}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            directional
            variant="tinted"
          />
          <Text style={{ fontFamily: FONTS.display, fontSize: 14.5, color: theme.textPrimary }}>
            {t(titleKey)}
          </Text>
        </View>
      </GlassHeader>
    );
  }

  const settingsActive = pathname.startsWith('/settings');

  return (
    <GlassHeader>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/about');
        }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <View
          style={{
            // 40, matching the back arrow's IconButton size (see
            // IconButton.tsx) — the two "pics" either side of GlassHeader
            // should read as the same size regardless of which row they're
            // on. Radius scaled proportionally with it (10/32 → 12.5, ~13).
            width: 40,
            height: 40,
            overflow: 'hidden',
            borderColor: `rgba(${theme.glow.a},0.3)`,
          }}
        >
          {/* `contain`, not `cover`: icon.png is 910×1015, so a square box crops the wingtip and
              the wallet's bottom edge — invisible on dark themes, obvious on light ones. */}
          <Image source={appLogo} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        </View>
        {/* Stacked lockup: the app name split across two lines rather than one
            long title. The subtitle reuses the existing name rather than
            inventing a product tier. */}
        <View>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.textPrimary }}>
            {t('app.shortName')}
          </Text>
          <Text style={{ fontSize: 9, fontWeight: '500', color: theme.textTertiary, marginTop: 1 }}>
            {t('app.subtitle')}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/settings');
        }}
        accessibilityRole="button"
        accessibilityLabel={t('settings.title')}
        style={{
          borderRadius: 19,
          padding: 2,
          backgroundColor: settingsActive ? `rgba(${theme.glow.a},0.22)` : 'transparent',
        }}
      >
        <View>
          {/* size=34, not 32 — Avatar draws its ring 3px outside the given
              size (see Avatar.tsx), so this renders a 34+6=40 circle: the
              same visible size as the logo tile above and the back arrow's
              IconButton, not 32. */}
          <Avatar
            name={profile.name || 'You'}
            photoUri={avatarDisplayUri(profile.avatar)}
            size={34}
            ring={settingsActive ? 'accent' : 'accent'}
          />
        </View>
      </Pressable>
    </GlassHeader>
  );
}
