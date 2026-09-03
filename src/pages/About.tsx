import React from 'react';
import { Text, View } from 'react-native';
import Constants from 'expo-constants';

import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { FONTS, TEXT } from '@/constants/theme';

// Stub — no content spec exists for this screen (CLAUDE.md rule 16).
export default function About() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.accent1,
        }}
      >
        <Text style={{ fontFamily: FONTS.displayBold, fontSize: 24, color: theme.buttonText }}>
          BE
        </Text>
      </View>
      <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: TEXT.primary }}>
        {t('app.name')}
      </Text>
      <Text style={{ fontSize: 12, color: TEXT.tertiary }}>{t('about.version', { version })}</Text>
    </View>
  );
}
