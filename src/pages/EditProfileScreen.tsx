import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Coins, Plus, Trash2, Wallet } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { Avatar } from '@/components/ui/Avatar';
import { SettingsCard } from '@/components/ui/SettingsCard';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { AmountInput } from '@/components/ui/AmountInput';
import { IconButton } from '@/components/ui/IconButton';
import { IconTile } from '@/components/ui/IconTile';
import { InlineBanner } from '@/components/ui/InlineBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useUser } from '@/context/UserContext';
import { useFinance } from '@/context/FinanceContext';
import { useChrome } from '@/context/ChromeContext';
import type { FinancialHealthTier } from '@/context/FinanceContext';
import { BORDER, RADII, TEXT } from '@/constants/theme';
import type { StartBalance } from '@/constants/initialData';

const HEALTH_COLORS: Record<FinancialHealthTier, string> = {
  excellent: '#34d399',
  good: '#4fe3ab',
  fair: '#fbbf24',
  critical: '#fb7185',
};

interface Entry {
  id: number;
  name: string;
  amount: number;
  currency: string;
}

export default function EditProfileScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { convertToBase, formatMoney } = useCurrency();
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

  const commitName = (value: string) => {
    setName(value);
    updateProfile({ name: value });
  };

  const pickAvatar = async () => {
    setAvatarError('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setAvatarError(t('editProfile.avatar.error'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.base64) {
      updateProfile({ avatar: `data:image/jpeg;base64,${asset.base64}` });
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
    <ScrollView
      style={{ backgroundColor: theme.ground }}
      contentContainerStyle={{
        padding: 16,
        paddingTop: headerHeight + 16,
        gap: 14,
        paddingBottom: 40,
      }}
      showsVerticalScrollIndicator={false}
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
                photoUri={profile.avatar || undefined}
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

          <TextInput
            value={name}
            onChangeText={commitName}
            placeholder={t('editProfile.name.placeholder')}
            placeholderTextColor={TEXT.tertiary}
            style={{
              fontSize: 17,
              fontWeight: '700',
              color: TEXT.primary,
              textAlign: 'center',
              minWidth: 160,
              padding: 0,
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Coins size={12} color={theme.accent2} />
            <Text style={{ fontSize: 11, color: TEXT.secondary }}>
              {t('settings.monthlyIncome', { amount: formatMoney(totalMonthlyIncomeBase) })}
            </Text>
          </View>

          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: RADII.pill,
              backgroundColor: `${HEALTH_COLORS[financialHealth]}22`,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: HEALTH_COLORS[financialHealth],
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
        footerLabel={t('editProfile.balances.footer', {
          count: (profile.startBalances ?? []).length,
          total: formatMoney(totalBalancesBase),
        })}
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
        footerLabel={t('editProfile.income.footer', {
          count: incomeSources.length,
          total: formatMoney(totalMonthlyIncomeBase),
        })}
      />
    </ScrollView>
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
  footerLabel: string;
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
  const { currencies, baseCurrency, formatOriginalMoney } = useCurrency();

  const [entryName, setEntryName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [currencyCode, setCurrencyCode] = useState(baseCurrency);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);

  const currencyOptions = currencies.map((c) => ({ label: c.code, value: c.code }));
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
                borderColor: BORDER.hairline,
              }}
            >
              <IconTile size={30} radius={RADII.tileSm}>
                <Icon size={14} color={theme.accent2} />
              </IconTile>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 13, fontWeight: '700', color: TEXT.primary }}
                >
                  {entry.name}
                </Text>
                <Text style={{ fontSize: 10.5, color: TEXT.tertiary, marginTop: 1 }}>
                  {entry.currency}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: TEXT.primary }}>
                  {formatOriginalMoney(entry.amount, entry.currency)}
                </Text>
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
        <TextInput
          value={entryName}
          onChangeText={setEntryName}
          placeholder={namePlaceholder}
          placeholderTextColor={TEXT.tertiary}
          style={{
            fontSize: 13,
            color: TEXT.primary,
            backgroundColor: theme.surfaceAlt,
            borderRadius: RADII.field,
            borderWidth: 1,
            borderColor: BORDER.hairline,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        />

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
          onChange={setCurrencyCode}
          searchable
          searchPlaceholder={t('settings.baseCurrency')}
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

      <Text style={{ marginTop: 10, fontSize: 10.5, color: TEXT.tertiary, textAlign: 'center' }}>
        {footerLabel}
      </Text>
    </SettingsCard>
  );
}
