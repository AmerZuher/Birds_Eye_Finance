import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/context/LanguageContext';
import { TEXT } from '@/constants/theme';

// Stub — full implementation lands in Phase 2 (FEATURE_SPEC 3.3).
export default function EditProfileScreen() {
  const { t } = useLanguage();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 13, color: TEXT.tertiary, textAlign: 'center' }}>
        {t('settings.editProfileComingSoon')}
      </Text>
    </View>
  );
}
