import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import { GlassHeader } from '@/components/ui/GlassHeader';
import { IconButton } from '@/components/ui/IconButton';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useUser } from '@/context/UserContext';
import { FONTS, TEXT } from '@/constants/theme';

const APP_LOGO = require('../../assets/icon.png');

const SETTINGS_TITLES: Record<string, string> = {
  '/settings': 'settings.title',
  '/settings/edit-profile': 'settings.editProfile',
  '/settings/data': 'settings.backupData',
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
            onPress={() => router.back()}
            directional
            size={32}
            iconSize={16}
          />
          <Text style={{ fontFamily: FONTS.display, fontSize: 14.5, color: TEXT.primary }}>
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
        onPress={() => router.push('/about')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}
      >
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: `rgba(${theme.glow.a},0.3)`,
          }}
        >
          <Image source={APP_LOGO} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: TEXT.primary }}>
          {t('app.name')}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => router.push('/settings')}
        accessibilityRole="button"
        accessibilityLabel={t('settings.title')}
        style={{
          borderRadius: 17,
          padding: 2,
          backgroundColor: settingsActive ? `rgba(${theme.glow.a},0.22)` : 'transparent',
        }}
      >
        <Avatar
          name={profile.name || 'You'}
          photoUri={profile.avatar || undefined}
          size={24}
          ring={settingsActive ? 'accent' : 'flat'}
        />
      </Pressable>
    </GlassHeader>
  );
}
