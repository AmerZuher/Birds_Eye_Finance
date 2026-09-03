import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Coins, CreditCard, Globe, Shield } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar } from '@/components/ui/Avatar';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsCard';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useUser } from '@/context/UserContext';
import { useFinance } from '@/context/FinanceContext';
import { THEME_IDS, THEMES, TEXT, RADII } from '@/constants/theme';
import type { ThemeId } from '@/constants/theme';
import { FONT_SCALE_IDS, FONT_SCALE_LABELS, type FontScaleId } from '@/constants/fontScale';
import type { Language } from '@/constants/translations';

export default function Settings() {
  const router = useRouter();
  const { theme, themeId, setThemeId, fontScale, setFontScale } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { baseCurrency, setBaseCurrency, currencies, formatMoney } = useCurrency();
  const { profile } = useUser();
  const { totalMonthlyIncomeBase } = useFinance();

  const currencyOptions = currencies.map((c) => ({ label: c.code, value: c.code }));
  const languageOptions: { label: string; value: Language }[] = [
    { label: 'English', value: 'en' },
    { label: 'العربية', value: 'ar' },
  ];

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Pressable onPress={() => router.push('/settings/edit-profile')}>
        <LinearGradient
          colors={[`rgba(${theme.glow.a},0.14)`, theme.surface, theme.surfaceAlt]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={{
            borderRadius: RADII.card,
            padding: 20,
            paddingVertical: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <Avatar
            name={profile.name || 'You'}
            photoUri={profile.avatar || undefined}
            size={60}
            ring="accent"
          />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: TEXT.primary }}>
              {profile.name || '—'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <CreditCard size={12} color={theme.accent2} />
              <Text style={{ fontSize: 11, color: TEXT.secondary }}>
                {t('settings.monthlyIncome', { amount: formatMoney(totalMonthlyIncomeBase) })}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Pressable>

      <SettingsCard title={t('settings.appearance')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {THEME_IDS.map((id) => (
            <ThemeTile key={id} id={id} active={id === themeId} onPress={() => setThemeId(id)} />
          ))}
        </View>

        <SettingsRow
          showTopBorder
          icon={
            <View
              style={{
                width: 25,
                height: 25,
                borderRadius: RADII.iconTile,
                backgroundColor: `rgba(${theme.glow.a},0.16)`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Globe size={13} color={theme.accent2} />
            </View>
          }
          label={t('settings.language')}
          value={
            <CustomSelect
              value={language}
              options={languageOptions}
              onChange={setLanguage}
              sheetTitle={t('settings.language')}
            />
          }
        />

        <SettingsRow
          icon={
            <View
              style={{
                width: 25,
                height: 25,
                borderRadius: RADII.iconTile,
                backgroundColor: `rgba(${theme.glow.a},0.16)`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: theme.accent2 }}>Aa</Text>
            </View>
          }
          label={t('settings.fontSize')}
          value={
            <SegmentedControl<FontScaleId>
              options={FONT_SCALE_IDS.map((id) => ({ label: FONT_SCALE_LABELS[id], value: id }))}
              value={fontScale}
              onChange={setFontScale}
            />
          }
        />
      </SettingsCard>

      <SettingsCard>
        <SettingsRow
          icon={
            <View
              style={{
                width: 25,
                height: 25,
                borderRadius: RADII.iconTile,
                backgroundColor: `rgba(${theme.glow.a},0.16)`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Coins size={13} color={theme.accent2} />
            </View>
          }
          label={t('settings.baseCurrency')}
          value={
            <CustomSelect
              value={baseCurrency}
              options={currencyOptions}
              onChange={setBaseCurrency}
              searchable
              searchPlaceholder="Search currency"
              sheetTitle={t('settings.baseCurrency')}
            />
          }
        />

        <SettingsRow
          showTopBorder
          onPress={() => router.push('/settings/data')}
          icon={
            <View
              style={{
                width: 25,
                height: 25,
                borderRadius: RADII.iconTile,
                backgroundColor: `rgba(${theme.glow.a},0.16)`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Shield size={13} color={theme.accent2} />
            </View>
          }
          label={t('settings.backupData')}
          value={
            <Text style={{ fontSize: 11.5, color: TEXT.tertiary }}>
              {t('settings.backupDataValue')} ›
            </Text>
          }
        />

        <SettingsRow
          showTopBorder
          icon={
            <View
              style={{
                width: 25,
                height: 25,
                borderRadius: RADII.iconTile,
                backgroundColor: `rgba(${theme.glow.a},0.16)`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={13} color={theme.accent2} />
            </View>
          }
          label={t('settings.notifications')}
          // Decorative placeholder until the notification engine lands (CLAUDE.md rule 10).
          value={<ToggleSwitch value={true} accessibilityLabel={t('settings.notifications')} />}
        />
      </SettingsCard>
    </ScrollView>
  );
}

function ThemeTile({ id, active, onPress }: { id: ThemeId; active: boolean; onPress: () => void }) {
  const { theme: activeTheme } = useTheme();
  const swatchTheme = THEMES[id];
  const { language } = useLanguage();

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexBasis: '48%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 9,
        paddingHorizontal: 10,
        borderRadius: RADII.tileLg,
        backgroundColor: activeTheme.surfaceAlt,
        borderWidth: 1,
        borderColor: active ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.08)',
      }}
    >
      <LinearGradient
        colors={[swatchTheme.accent1, swatchTheme.accent2]}
        style={{ width: 20, height: 20, borderRadius: 10 }}
      />
      <Text style={{ fontSize: 10.5, fontWeight: '700', color: TEXT.primary, flex: 1 }}>
        {swatchTheme.label[language]}
      </Text>
      {active ? (
        <View
          style={{
            width: 15,
            height: 15,
            borderRadius: 8,
            backgroundColor: activeTheme.accent1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 9, color: activeTheme.buttonText }}>✓</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
