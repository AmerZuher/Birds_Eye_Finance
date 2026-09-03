import React from 'react';
import { Image, Text, View } from 'react-native';
import Constants from 'expo-constants';

import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useChrome } from '@/context/ChromeContext';
import { FONTS, TEXT } from '@/constants/theme';

const APP_LOGO = require('../../assets/icon.png');

// Stub — no content spec exists for this screen (CLAUDE.md rule 16).
export default function About() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { headerHeight } = useChrome();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 24,
        paddingTop: headerHeight + 24,
        backgroundColor: theme.ground,
      }}
    >
      <View
        style={{
          width: 84,
          height: 84,
          borderRadius: 22,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: `rgba(${theme.glow.a},0.3)`,
        }}
      >
        <Image source={APP_LOGO} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      </View>
      <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: TEXT.primary }}>
        {t('app.name')}
      </Text>
      <Text style={{ fontSize: 12, color: TEXT.tertiary }}>{t('about.version', { version })}</Text>
    </View>
  );
}
