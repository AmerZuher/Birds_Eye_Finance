import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { useChrome } from '@/context/ChromeContext';
import { FONTS, TEXT } from '@/constants/theme';

// Placeholder — full implementation lands in Phase 3 (FEATURE_SPEC Part 1).
export default function Debts() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const { headerHeight, navbarHeight } = useChrome();

  return (
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
      <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: TEXT.primary }}>
        {t('placeholder.debts.title')}
      </Text>
      <Text style={{ fontSize: 13, color: TEXT.tertiary, textAlign: 'center' }}>
        {t('placeholder.debts.subtitle')}
      </Text>
    </View>
  );
}
