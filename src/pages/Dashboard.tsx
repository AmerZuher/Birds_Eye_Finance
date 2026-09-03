import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { FONTS, TEXT } from '@/constants/theme';

// Rule 15: intentionally minimal until Phase 5 — no rich data, no forecasting.
export default function Dashboard() {
  const { t } = useLanguage();
  const { theme } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 24,
        backgroundColor: theme.ground,
      }}
    >
      <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: TEXT.primary }}>
        {t('placeholder.dashboard.title')}
      </Text>
      <Text style={{ fontSize: 13, color: TEXT.tertiary, textAlign: 'center' }}>
        {t('placeholder.dashboard.subtitle')}
      </Text>
    </View>
  );
}
