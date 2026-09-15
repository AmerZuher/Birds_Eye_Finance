import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  ChevronRight,
  Coins,
  CreditCard,
  Globe,
  Moon,
  RefreshCw,
  Shield,
  Sun,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { PageTransition } from '@/components/PageTransition';
import { Avatar } from '@/components/ui/Avatar';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { IconButton } from '@/components/ui/IconButton';
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
import { RADII, SEMANTIC, THEME_IDS, THEMES } from '@/constants/theme';
import type { ThemeId } from '@/constants/theme';
import type { Language } from '@/constants/translations';
import { avatarDisplayUri } from '@/lib/avatars';
import { RATE_SOURCE_NAMES, RATES_ATTRIBUTION_URL } from '@/lib/exchangeRates';
import { HIDDEN_SCROLLBARS } from '@/lib/scroll';
import { withAlpha } from '@/utils/color';

type ThemeGroup = 'dark' | 'light';
type Translate = (key: string, vars?: Record<string, string | number>) => string;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Rates older than this read as stale (amber) — providers publish daily. */
const STALE_AFTER_DAYS = 2;

/** Whole calendar days between a timestamp and today. */
function daysAgo(timestamp: number): number {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(new Date()) - startOfDay(new Date(timestamp))) / DAY_MS);
}

/** "today, 15:42" / "yesterday" / "3 days ago" — how long ago the rates in use are from. */
function describeWhen(timestamp: number, withTime: boolean, t: Translate): string {
  const days = daysAgo(timestamp);
  if (days <= 0) {
    if (!withTime) return t('settings.rates.today');
    const date = new Date(timestamp);
    const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    return t('settings.rates.todayAt', { time });
  }
  if (days === 1) return t('settings.rates.yesterday');
  return t('settings.rates.daysAgo', { n: days });
}

export default function Settings() {
  const router = useRouter();
  const { theme, themeId, setThemeId } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const {
    baseCurrency,
    setBaseCurrency,
    currencyOptions,
    recordCurrencyUsage,
    exchangeRates,
    setOnlineRates,
    refreshRates,
  } = useCurrency();
  const { profile } = useUser();
  const { totalMonthlyIncomeBase } = useFinance();
  const { headerHeight } = useChrome();
  // Opens on the group the current theme belongs to.
  const [themeGroup, setThemeGroup] = useState<ThemeGroup>(() =>
    theme.isLight ? 'light' : 'dark',
  );
  const [ratesError, setRatesError] = useState('');

  const languageOptions: { label: string; value: Language }[] = [
    { label: 'English', value: 'en' },
    { label: 'العربية', value: 'ar' },
  ];

  const builtInRates = exchangeRates.source === 'built-in';
  const ratesWhen = describeWhen(exchangeRates.updatedAt, !builtInRates, t);
  const ratesStatus = exchangeRates.refreshing
    ? t('settings.rates.updating')
    : !exchangeRates.online
      ? t('settings.rates.off', { when: ratesWhen })
      : builtInRates
        ? t('settings.rates.builtIn', { when: ratesWhen })
        : t('settings.rates.updated', { when: ratesWhen });
  // Green while live rates are fresh, amber for built-in or old ones, muted while paused.
  const ratesStatusColor = !exchangeRates.online
    ? theme.textTertiary
    : builtInRates || daysAgo(exchangeRates.updatedAt) > STALE_AFTER_DAYS
      ? SEMANTIC.warning
      : SEMANTIC.positive;
  // The fallback provider is named too; the attribution stays — the built-in rates come from ExchangeRate-API.
  const ratesSourceLine =
    exchangeRates.source === 'currency-api'
      ? `${RATE_SOURCE_NAMES['currency-api']} · ${t('settings.rates.attribution')}`
      : t('settings.rates.attribution');

  // A successful refresh speaks for itself through the status panel; only a failure needs a message.
  const handleRefreshRates = async () => {
    setRatesError('');
    if (!(await refreshRates())) setRatesError(t('settings.rates.refreshError'));
  };

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
            icon={ArrowLeftRight}
            label={t('settings.rates.title')}
            subtitle={t('settings.rates.subtitle')}
            value={
              <ToggleSwitch
                value={exchangeRates.online}
                onValueChange={setOnlineRates}
                accessibilityLabel={t('settings.rates.title')}
              />
            }
            footer={
              <View style={{ gap: 10 }}>
                {/* The status panel — recessed like Edit Profile's entry rows. */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 10,
                    paddingStart: 12,
                    paddingEnd: 8,
                    borderRadius: RADII.field,
                    backgroundColor: theme.surfaceAlt,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <StatusDot color={ratesStatusColor} />
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 12.5, fontWeight: '600', color: theme.textPrimary }}
                    >
                      {ratesStatus}
                    </Text>
                    {/* ExchangeRate-API's terms require this link; discreet is allowed. */}
                    <SecondaryButton
                      variant="caption"
                      trailingIcon={ArrowUpRight}
                      label={ratesSourceLine}
                      onPress={() => void Linking.openURL(RATES_ATTRIBUTION_URL)}
                    />
                  </View>
                  {exchangeRates.online ? (
                    <IconButton
                      icon={RefreshCw}
                      variant="tinted"
                      size={34}
                      iconSize={15}
                      spinning={exchangeRates.refreshing}
                      accessibilityLabel={t('settings.rates.refresh')}
                      onPress={() => void handleRefreshRates()}
                    />
                  ) : null}
                </View>
                {ratesError ? (
                  <InlineBanner
                    kind="error"
                    message={ratesError}
                    onDismiss={() => setRatesError('')}
                    autoDismissMs={4000}
                  />
                ) : null}
              </View>
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
            icon={Bell}
            label={t('settings.notifications')}
            // Decorative placeholder until the notification engine lands (CLAUDE.md rule 10).
            value={<ToggleSwitch value={true} accessibilityLabel={t('settings.notifications')} />}
          />
        </SettingsCard>
      </ScrollView>
    </PageTransition>
  );
}

/** A solid status dot inside a soft halo of the same color. */
function StatusDot({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: withAlpha(color, 0.2),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

/** A row's trailing text + chevron, matching CustomSelect's own trigger. */
function RowValue({ label }: { label: string }) {
  const { theme } = useTheme();
  const { isRTL } = useLanguage();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: 11.5, color: theme.textTertiary }}>{label}</Text>
      <View style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}>
        <ChevronRight size={13} color={theme.textTertiary} />
      </View>
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
