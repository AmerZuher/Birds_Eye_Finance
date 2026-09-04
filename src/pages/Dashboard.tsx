import React from 'react';
import { Text, View } from 'react-native';

import { PageTransition } from '@/components/PageTransition';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { useChrome } from '@/context/ChromeContext';
import { FONTS } from '@/constants/theme';

// Rule 15: intentionally minimal until Phase 5 — no rich data, no forecasting.
export default function Dashboard() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { headerHeight, navbarHeight } = useChrome();

  return (
    <PageTransition>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: 24,
          paddingTop: headerHeight + 24,
          paddingBottom: navbarHeight + 24,
          backgroundColor: theme.ground,
        }}
      >
        <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: theme.textPrimary }}>
          {t('placeholder.dashboard.title')}
        </Text>
        <Text style={{ fontSize: 13, color: theme.textTertiary, textAlign: 'center' }}>
          {t('placeholder.dashboard.subtitle')}
        </Text>
      </View>
    </PageTransition>
  );
}
