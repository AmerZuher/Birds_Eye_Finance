import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Camera, Coins, Plus, Trash2, Wallet } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { PageTransition } from '@/components/PageTransition';
import { TextField } from '@/components/FormField';
import { Avatar } from '@/components/ui/Avatar';
import { SettingsCard } from '@/components/ui/SettingsCard';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { AmountInput } from '@/components/ui/AmountInput';
import { IconButton } from '@/components/ui/IconButton';
import { IconTile } from '@/components/ui/IconTile';
import { InlineBanner } from '@/components/ui/InlineBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useUser } from '@/context/UserContext';
import { useFinance } from '@/context/FinanceContext';
import { useChrome } from '@/context/ChromeContext';
import { RADII } from '@/constants/theme';
import type { StartBalance } from '@/constants/initialData';
import { healthTierColor, withAlpha } from '@/utils/color';
import {
  avatarDisplayUri,
  deleteStoredAvatar,
  pickAvatarPhoto,
  saveAvatarImage,
} from '@/lib/avatars';
import { HIDDEN_SCROLLBARS } from '@/lib/scroll';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

interface Entry {
  id: number;
  name: string;
  amount: number;
  currency: string;
}

export default function EditProfileScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { convertToBase } = useCurrency();
  const { profile, updateProfile } = useUser();
  const {
    incomeSources,
    totalMonthlyIncomeBase,
    addIncomeSource,
    removeIncomeSource,
    financialHealth,
  } = useFinance();
  const { headerHeight } = useChrome();

  const [name, setName] = useState(profile.name);
  const [avatarError, setAvatarError] = useState('');

  const totalBalancesBase = useMemo(
    () =>
      (profile.startBalances ?? []).reduce(
        (sum, b) => sum + convertToBase(b.amount, b.currency),
        0,
      ),
    [profile.startBalances, convertToBase],
  );

  // updateProfile re-serializes the whole profile into MMKV, so the name is saved when the field
  // loses focus or the screen does — never on every keystroke (DEVELOPMENT.md gotcha 4).
  const commitName = useCallback(() => {
    if (name !== profile.name) updateProfile({ name });
  }, [name, profile.name, updateProfile]);

  // Leaving the screen without tapping elsewhere first still saves the name.
  const commitNameRef = useRef(commitName);
  useEffect(() => {
    commitNameRef.current = commitName;
  });
  useFocusEffect(useCallback(() => () => commitNameRef.current(), []));

  // Picking, saving (a small file, stored relative) and Android's
  // destroyed-Activity recovery all live in src/lib/avatars.ts, shared with
  // Edit Person; a photo recovered after a restart is applied by
  // PendingPhotoRecovery. A picked photo applies straight away here.
  const pickAvatar = async () => {
    setAvatarError('');
    try {
      const picked = await pickAvatarPhoto({ kind: 'profile' });
      if (picked.kind === 'denied') {
        setAvatarError(t('editProfile.avatar.error'));
        return;
      }
      if (picked.kind === 'canceled') return;
      const stored = await saveAvatarImage(picked.uri);
      const previous = profile.avatar;
      updateProfile({ avatar: stored });
      deleteStoredAvatar(previous);
    } catch (error) {
      console.warn('[editProfile] picking a photo failed', error);
      setAvatarError(t('editProfile.avatar.error'));
    }
  };

  const addBalance = (input: { name: string; amount: number; currency: string }) => {
    const next: StartBalance = { id: Date.now(), ...input };
    updateProfile({
      startBalances: [...(profile.startBalances ?? []), next],
      lastReconciledDate: new Date().toISOString(),
    });
  };

  const removeBalance = (id: number) => {
    updateProfile({
      startBalances: (profile.startBalances ?? []).filter((b) => b.id !== id),
      lastReconciledDate: new Date().toISOString(),
    });
  };

  const addIncome = (input: { name: string; amount: number; currency: string }) => {
    void addIncomeSource(input);
  };

  const removeIncome = (id: number) => {
    void removeIncomeSource(id);
  };

  return (
    <PageTransition>
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: theme.ground }}
        contentContainerStyle={{
          padding: 16,
          paddingTop: headerHeight + 16,
          gap: 14,
          paddingBottom: 40,
        }}
        {...HIDDEN_SCROLLBARS}
      >
        <SettingsCard>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Pressable
              onPress={pickAvatar}
              accessibilityRole="button"
              accessibilityLabel={t('editProfile.avatar.change')}
            >
              <View>
                <Avatar
                  name={name || 'You'}
                  photoUri={avatarDisplayUri(profile.avatar)}
                  size={76}
                  ring="accent"
                />
                <View
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: theme.accent1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: theme.surface,
                  }}
                >
                  <Camera size={13} color={theme.buttonText} />
                </View>
              </View>
            </Pressable>

            <TextField
              value={name}
              onChangeText={setName}
              onBlur={commitName}
              placeholder={t('editProfile.name.placeholder')}
              style={{
                fontSize: 17,
                fontWeight: '700',
                color: theme.textPrimary,
                textAlign: 'center',
                minWidth: 160,
                paddingHorizontal: 0,
                paddingVertical: 0,
                backgroundColor: 'transparent',
                borderWidth: 0,
              }}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Coins size={12} color={theme.accent2} />
              <MoneyAmount amount={totalMonthlyIncomeBase} color={theme.textSecondary} size={11} />
              <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                {t('settings.monthlyIncomeSuffix')}
              </Text>
            </View>

            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: RADII.pill,
                backgroundColor: withAlpha(healthTierColor(financialHealth, theme), 0.13),
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: healthTierColor(financialHealth, theme),
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {t(`editProfile.health.${financialHealth}`)}
              </Text>
            </View>

            {avatarError ? (
              <InlineBanner
                kind="error"
                message={avatarError}
                onDismiss={() => setAvatarError('')}
                autoDismissMs={3000}
              />
            ) : null}
          </View>
        </SettingsCard>

        <EntryManager
          title={t('editProfile.balances.title')}
          icon={Wallet}
          entries={profile.startBalances ?? []}
          onAdd={addBalance}
          onRemove={removeBalance}
          emptyCaption={t('editProfile.balances.empty')}
          namePlaceholder={t('editProfile.balances.namePlaceholder')}
          addLabel={t('editProfile.balances.add')}
          removeLabel={t('editProfile.balances.remove')}
          footerLabel={
            <>
              <Text style={{ fontSize: 10.5, color: theme.textTertiary }}>
                {t('editProfile.balances.footerPrefix', {
                  count: (profile.startBalances ?? []).length,
                })}
              </Text>
              <MoneyAmount amount={totalBalancesBase} color={theme.textTertiary} size={10.5} />
            </>
          }
        />

        <EntryManager
          title={t('editProfile.income.title')}
          icon={Coins}
          entries={incomeSources}
          onAdd={addIncome}
          onRemove={removeIncome}
          emptyCaption={t('editProfile.income.empty')}
          namePlaceholder={t('editProfile.income.namePlaceholder')}
          addLabel={t('editProfile.income.add')}
          removeLabel={t('editProfile.income.remove')}
          footerLabel={
            <>
              <Text style={{ fontSize: 10.5, color: theme.textTertiary }}>
                {t('editProfile.income.footerPrefix', { count: incomeSources.length })}
              </Text>
              <MoneyAmount amount={totalMonthlyIncomeBase} color={theme.textTertiary} size={10.5} />
              <Text style={{ fontSize: 10.5, color: theme.textTertiary }}>
                {t('editProfile.income.footerSuffix')}
              </Text>
            </>
          }
        />
      </KeyboardAwareScrollView>
    </PageTransition>
  );
}

interface EntryManagerProps {
  title: string;
  icon: LucideIcon;
  entries: Entry[];
  onAdd: (input: { name: string; amount: number; currency: string }) => void;
  onRemove: (id: number) => void;
  emptyCaption: string;
  namePlaceholder: string;
  addLabel: string;
  removeLabel: string;
  footerLabel: React.ReactNode;
}

/** Shared add-row + list + footer shape used by both the balances and income-sources managers (FEATURE_SPEC 3.3). */
function EntryManager({
  title,
  icon: Icon,
  entries,
  onAdd,
  onRemove,
  emptyCaption,
  namePlaceholder,
  addLabel,
  removeLabel,
  footerLabel,
}: EntryManagerProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { currencyOptions, baseCurrency, recordCurrencyUsage } = useCurrency();

  const [entryName, setEntryName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [currencyCode, setCurrencyCode] = useState(baseCurrency);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);

  const amountValue = parseFloat(amountText);
  const canAdd =
    entryName.trim().length > 0 &&
    amountText.trim().length > 0 &&
    !Number.isNaN(amountValue) &&
    amountValue > 0;

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd({ name: entryName.trim(), amount: amountValue, currency: currencyCode });
    setEntryName('');
    setAmountText('');
  };

  return (
    <SettingsCard title={title}>
      {entries.length === 0 ? (
        <EmptyState icon={Icon} caption={emptyCaption} />
      ) : (
        <View style={{ gap: 8 }}>
          {entries.map((entry) => (
            <View
              key={entry.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 11,
                padding: 12,
                borderRadius: RADII.field,
                backgroundColor: theme.surfaceAlt,
                borderWidth: 1,
                borderColor: theme.border,
              }}
            >
              <IconTile size={30} radius={RADII.tileSm}>
                <Icon size={14} color={theme.accent2} />
              </IconTile>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 13, fontWeight: '700', color: theme.textPrimary }}
                >
                  {entry.name}
                </Text>
                <Text style={{ fontSize: 10.5, color: theme.textTertiary, marginTop: 1 }}>
                  {entry.currency}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MoneyAmount amount={entry.amount} currencyCode={entry.currency} size={12.5} />
                <IconButton
                  icon={Trash2}
                  accessibilityLabel={removeLabel}
                  size={28}
                  iconSize={13}
                  onPress={() => onRemove(entry.id)}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ marginTop: 12, gap: 8 }}>
        <TextField value={entryName} onChangeText={setEntryName} placeholder={namePlaceholder} />

        <AmountInput
          value={amountText}
          onChangeValue={setAmountText}
          currencyCode={currencyCode}
          onPressCurrency={() => setCurrencyPickerOpen(true)}
          label=""
        />
        <CustomSelect
          value={currencyCode}
          options={currencyOptions}
          onChange={(v) => {
            setCurrencyCode(v);
            recordCurrencyUsage(v);
          }}
          searchable
          searchPlaceholder={t('settings.searchCurrency')}
          sheetTitle={t('settings.baseCurrency')}
          open={currencyPickerOpen}
          onOpenChange={setCurrencyPickerOpen}
          hideTrigger
        />

        <Pressable
          onPress={handleAdd}
          disabled={!canAdd}
          style={{
            opacity: canAdd ? 1 : 0.4,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: theme.accent1,
            borderRadius: RADII.field,
            paddingVertical: 11,
          }}
        >
          <Plus size={14} color={theme.buttonText} />
          <Text style={{ color: theme.buttonText, fontWeight: '700', fontSize: 12 }}>
            {addLabel}
          </Text>
        </Pressable>
      </View>

      <View
        style={{
          marginTop: 10,
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {footerLabel}
      </View>
    </SettingsCard>
  );
}
