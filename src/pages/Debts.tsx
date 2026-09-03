import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/context/LanguageContext';
import { FONTS, TEXT } from '@/constants/theme';

// Placeholder — full implementation lands in Phase 3 (FEATURE_SPEC Part 1).
export default function Debts() {
  const { t } = useLanguage();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 }}>
      <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: TEXT.primary }}>
        {t('placeholder.debts.title')}
      </Text>
      <Text style={{ fontSize: 13, color: TEXT.tertiary, textAlign: 'center' }}>
        {t('placeholder.debts.subtitle')}
      </Text>
    </View>
  );
}
