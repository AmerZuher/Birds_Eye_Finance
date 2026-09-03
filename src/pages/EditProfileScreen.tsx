import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { TEXT } from '@/constants/theme';

// Stub — full implementation lands in Phase 2 (FEATURE_SPEC 3.3).
export default function EditProfileScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: theme.ground,
      }}
    >
      <Text style={{ fontSize: 13, color: TEXT.tertiary, textAlign: 'center' }}>
        {t('settings.editProfileComingSoon')}
      </Text>
    </View>
  );
}
