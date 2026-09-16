import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeftRight,
  Bell,
  ChevronRight,
  Coins,
  CreditCard,
  Globe,
  Moon,
  Shield,
  Sun,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { PageTransition } from '@/components/PageTransition';
import { Avatar } from '@/components/ui/Avatar';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { InlineBanner } from '@/components/ui/InlineBanner';
import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsCard';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useUser } from '@/context/UserContext';
import { useFinance } from '@/context/FinanceContext';
import { useChrome } from '@/context/ChromeContext';
import { useReminders } from '@/context/RemindersContext';
import { RADII, THEME_IDS, THEMES } from '@/constants/theme';
import type { ThemeId } from '@/constants/theme';
import type { Language } from '@/constants/translations';
import { avatarDisplayUri } from '@/lib/avatars';
import { HIDDEN_SCROLLBARS } from '@/lib/scroll';

type ThemeGroup = 'dark' | 'light';

export default function Settings() {
  const router = useRouter();
  const reminders = useReminders();
  const { theme, themeId, setThemeId } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const {
    baseCurrency,
    setBaseCurrency,
    currencyOptions,
    recordCurrencyUsage,
    exchangeRates,
    setOnlineRates,
  } = useCurrency();
  const { profile } = useUser();
  const { totalMonthlyIncomeBase } = useFinance();
  const { headerHeight } = useChrome();
  // Opens on the group the current theme belongs to.
  const [themeGroup, setThemeGroup] = useState<ThemeGroup>(() =>
    theme.isLight ? 'light' : 'dark',
  );

  const languageOptions: { label: string; value: Language }[] = [
    { label: 'English', value: 'en' },
    { label: 'العربية', value: 'ar' },
  ];

  return (
    <PageTransition>
      <ScrollView
        style={{ backgroundColor: theme.ground }}
        contentContainerStyle={{
          padding: 16,
          paddingTop: headerHeight + 16,
          gap: 14,
          paddingBottom: 40,
        }}
        {...HIDDEN_SCROLLBARS}
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
              photoUri={avatarDisplayUri(profile.avatar)}
              size={60}
              ring="accent"
            />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: theme.textPrimary }}>
                {profile.name || '—'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CreditCard size={12} color={theme.accent2} />
                <MoneyAmount
                  amount={totalMonthlyIncomeBase}
                  color={theme.textSecondary}
                  size={11}
                />
                <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                  {t('settings.monthlyIncomeSuffix')}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Pressable>

        <SettingsCard title={t('settings.themes')}>
          <SegmentedControl<ThemeGroup>
            size="large"
            options={[
              { label: t('settings.themes.dark'), value: 'dark', icon: Moon },
              { label: t('settings.themes.light'), value: 'light', icon: Sun },
            ]}
            value={themeGroup}
            onChange={setThemeGroup}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {THEME_IDS.filter((id) => (THEMES[id].isLight ? 'light' : 'dark') === themeGroup).map(
              (id) => (
                <ThemeTile
                  key={id}
                  id={id}
                  active={id === themeId}
                  onPress={() => setThemeId(id)}
                />
              ),
            )}
          </View>
        </SettingsCard>

        <SettingsCard title={t('settings.general')}>
          <SettingsRow
            icon={Globe}
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
            showTopBorder
            icon={Coins}
            label={t('settings.baseCurrency')}
            value={
              <CustomSelect
                value={baseCurrency}
                options={currencyOptions}
                onChange={(v) => {
                  setBaseCurrency(v);
                  recordCurrencyUsage(v);
                }}
                searchable
                searchPlaceholder={t('settings.searchCurrency')}
                sheetTitle={t('settings.baseCurrency')}
              />
            }
          />

          <SettingsRow
            showTopBorder
            onPress={() => router.push('/settings/data')}
            icon={Shield}
            label={t('settings.backupData')}
            value={<RowValue label={t('settings.backupDataValue')} />}
          />

          <SettingsRow
            showTopBorder
            icon={ArrowLeftRight}
            label={t('settings.rates.title')}
            value={
              <ToggleSwitch
                value={exchangeRates.online}
                onValueChange={setOnlineRates}
                accessibilityLabel={t('settings.rates.title')}
              />
            }
          />

          <SettingsRow
            showTopBorder
            onPress={() => router.push('/settings/notifications')}
            icon={Bell}
            label={t('settings.notifications')}
            value={
              // The switch owns notifications as a whole; the row itself opens the
              // customization screen (FEATURE_SPEC 3.5).
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ToggleSwitch
                  value={reminders.enabled}
                  onValueChange={reminders.setEnabled}
                  accessibilityLabel={t('settings.notifications')}
                />
              </View>
            }
            footer={
              reminders.permissionDenied ? (
                <View style={{ gap: 8 }}>
                  <InlineBanner
                    kind="error"
                    message={t('settings.notifications.denied')}
                    onDismiss={reminders.dismissPermissionDenied}
                  />
                  <SecondaryButton
                    variant="link"
                    label={t('settings.notifications.openSettings')}
                    onPress={() => Linking.openSettings()}
                  />
                </View>
              ) : undefined
            }
          />
        </SettingsCard>
      </ScrollView>
    </PageTransition>
  );
}

/** The chevron a row that opens a sub-screen ends with — direction follows the language. */
function RowChevron() {
  const { theme } = useTheme();
  const { isRTL } = useLanguage();
  return (
    <View style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}>
      <ChevronRight size={13} color={theme.textTertiary} />
    </View>
  );
}

/** A row's trailing text + chevron, matching CustomSelect's own trigger. */
function RowValue({ label }: { label: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: 11.5, color: theme.textTertiary }}>{label}</Text>
      <RowChevron />
    </View>
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
        // Was a flat white-alpha border regardless of theme — invisible-ish
        // on a light activeTheme's own light surfaceAlt. accent1 for the
        // selected tile reads clearly on any ground; unselected falls back
        // to the active theme's own border token instead of a hardcoded one.
        borderColor: active ? activeTheme.accent1 : activeTheme.border,
      }}
    >
      <LinearGradient
        colors={[swatchTheme.accent1, swatchTheme.accent2]}
        style={{ width: 20, height: 20, borderRadius: 10 }}
      />
      <Text style={{ fontSize: 10.5, fontWeight: '700', color: activeTheme.textPrimary, flex: 1 }}>
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
