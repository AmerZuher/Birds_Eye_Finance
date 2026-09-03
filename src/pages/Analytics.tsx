import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { useChrome } from '@/context/ChromeContext';
import { FONTS, TEXT } from '@/constants/theme';

// Stub, same footing as Dashboard (rule 15): the Obsidian refactor's navbar
// is a 2-left / notch / 2-right layout, which needs a fourth tab to be
// symmetric. Real charts land with the Phase 5 data work — nothing is
// invented here until that's specified.
export default function Analytics() {
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
        {t('placeholder.analytics.title')}
      </Text>
      <Text style={{ fontSize: 13, color: TEXT.tertiary, textAlign: 'center' }}>
        {t('placeholder.analytics.subtitle')}
      </Text>
    </View>
  );
}
