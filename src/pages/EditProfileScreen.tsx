import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';
import { Camera, Coins, Plus, Trash2, Wallet } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { PageTransition } from '@/components/PageTransition';
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
import { healthTierColor } from '@/utils/color';

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

  const commitName = (value: string) => {
    setName(value);
    updateProfile({ name: value });
  };

  // Guards against double-processing: the recovery effect below and a
  // normal pickAvatar call could both end up with the same picked asset in
  // rare timing cases (see its own comment), and this is the one place
  // that's cheap to dedupe at.
  const lastProcessedUri = useRef<string | null>(null);

  // Downscales the picked photo and writes it to a small file instead of
  // embedding it as a raw base64 data URI in profile state. A
  // full-resolution photo stored that way turned every profile write —
  // even a single keystroke in the name field — into a multi-megabyte
  // JSON.stringify + MMKV write, and forced every Avatar on screen to
  // decode that full image at once. That's cheap on a dev-build emulator's
  // generous heap but was enough to crash a release APK right after
  // picking a photo on real hardware.
  const applyPickedAsset = async (uri: string) => {
    if (lastProcessedUri.current === uri) return;
    lastProcessedUri.current = uri;
    try {
      const context = ImageManipulator.manipulate(uri);
      context.resize({ width: 256, height: 256 });
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });

      const previousAvatar = profile.avatar;
      const savedFile = new File(saved.uri);
      // A fresh filename per pick, not a stable overwritten one — Image
      // caches are keyed by URI, so reusing the same path would risk
      // showing the old, now-stale bitmap after an update.
      await savedFile.move(new File(Paths.document, `profile-avatar-${Date.now()}.jpg`));
      updateProfile({ avatar: savedFile.uri });

      // Best-effort cleanup of the file the previous avatar pointed to —
      // only ever one we wrote ourselves (guarded by the document-dir
      // prefix, since older/synced profiles may still carry a data: URI).
      if (previousAvatar && previousAvatar.startsWith(Paths.document.uri)) {
        try {
          const old = new File(previousAvatar);
          if (old.exists) old.delete();
        } catch {
          // Stale reference to an already-missing file — nothing to clean up.
        }
      }
    } catch {
      setAvatarError(t('editProfile.avatar.error'));
    }
  };

  // Android can kill this screen's host Activity in the background to
  // reclaim memory while the picker (and, the very first time, the
  // permission dialog before it) is in the foreground — Expo's own docs
  // call this out and ship `getPendingResultAsync` specifically to recover
  // from it (see expo-image-picker's README). Most likely on a cold,
  // freshly-installed process under memory pressure, which is exactly the
  // "only the first pick after installing the release APK" pattern this
  // was chasing — the JS side never got to run its own promise
  // continuation, so without this recovery the picked photo is just lost
  // and the screen remounts blank. Runs once on mount; a no-op on
  // iOS/web, and a no-op on Android whenever there's nothing pending.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pending = await ImagePicker.getPendingResultAsync();
      if (cancelled || !pending) return;
      if ('code' in pending) return; // ImagePickerErrorResult — nothing to recover
      if (pending.canceled) return;
      const asset = pending.assets[0];
      if (asset) await applyPickedAsset(asset.uri);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    });
    if (result.canceled) return;
    await applyPickedAsset(result.assets[0].uri);
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
              placeholderTextColor={theme.textTertiary}
              style={{
                fontSize: 17,
                fontWeight: '700',
                color: theme.textPrimary,
                textAlign: 'center',
                minWidth: 160,
                padding: 0,
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
                backgroundColor: `${healthTierColor(financialHealth, theme)}22`,
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
      </ScrollView>
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
  const { currencies, baseCurrency, recordCurrencyUsage } = useCurrency();

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
        <TextInput
          value={entryName}
          onChangeText={setEntryName}
          placeholder={namePlaceholder}
          placeholderTextColor={theme.textTertiary}
          style={{
            fontSize: 13,
            color: theme.textPrimary,
            backgroundColor: theme.surfaceAlt,
            borderRadius: RADII.field,
            borderWidth: 1,
            borderColor: theme.border,
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
          onChange={(v) => {
            setCurrencyCode(v);
            recordCurrencyUsage(v);
          }}
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
