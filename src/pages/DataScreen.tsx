import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { Check, Copy, Download, Shield, Upload } from 'lucide-react-native';

import { PageTransition } from '@/components/PageTransition';
import { SettingsCard } from '@/components/ui/SettingsCard';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { InlineBanner } from '@/components/ui/InlineBanner';
import type { BannerKind } from '@/components/ui/InlineBanner';
import { GradientButton } from '@/components/ui/GradientButton';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { IconTile } from '@/components/ui/IconTile';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useUser } from '@/context/UserContext';
import { useChrome } from '@/context/ChromeContext';
import { RADII } from '@/constants/theme';
import { DEBTS_PROMPT } from '@/prompts/debtsPrompt';
import { EXPENSES_PROMPT } from '@/prompts/expensesPrompt';
import {
  appendSnapshot,
  buildSnapshot,
  humanizeLastBackup,
  isBackupDue,
  parseSnapshot,
  readAutoBackupMeta,
  readAutoBackupSnapshot,
  replaceWithSnapshot,
  writeAutoBackupMeta,
  writeAutoBackupSnapshot,
  BACKUP_FREQUENCIES,
} from '@/utils/autoBackup';
import type { AutoBackupMeta, BackupFrequency } from '@/utils/autoBackup';

export default function DataScreen() {
  const { theme, themeId } = useTheme();
  const { t } = useLanguage();
  const { baseCurrency } = useCurrency();
  const { profile, updateProfile } = useUser();
  const { headerHeight } = useChrome();

  const [banner, setBanner] = useState<{ kind: BannerKind; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [frequency, setFrequency] = useState<BackupFrequency>(() => readAutoBackupMeta().frequency);
  const [lastBackup, setLastBackup] = useState<string | undefined>(
    () => readAutoBackupMeta().lastBackup,
  );
  const [hasSnapshot, setHasSnapshot] = useState<boolean>(() => !!readAutoBackupSnapshot());
  const [pasteText, setPasteText] = useState('');
  const [copiedKey, setCopiedKey] = useState<'debts' | 'expenses' | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);

  const showBanner = (kind: BannerKind, message: string) => setBanner({ kind, message });

  useEffect(() => {
    // Foreground auto-backup check — no background task involved (that's reserved
    // for the notifications engine, CLAUDE.md rule 10); this just catches the app up
    // to the chosen frequency whenever the Data screen is opened.
    const meta = readAutoBackupMeta();
    if (isBackupDue(meta)) {
      void (async () => {
        const snapshot = await buildSnapshot(profile, baseCurrency, themeId);
        writeAutoBackupSnapshot(snapshot);
        const nextMeta: AutoBackupMeta = {
          frequency: meta.frequency,
          lastBackup: snapshot.exportedAt,
        };
        writeAutoBackupMeta(nextMeta);
        setLastBackup(snapshot.exportedAt);
        setHasSnapshot(true);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async () => {
    setBusy(true);
    try {
      const snapshot = await buildSnapshot(profile, baseCurrency, themeId);
      const filename = `birdseye-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File(Paths.cache, filename);
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(snapshot, null, 2));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: t('data.export.button'),
        });
      }
      showBanner('success', t('data.export.success'));
    } catch {
      showBanner('error', t('data.export.error'));
    } finally {
      setBusy(false);
    }
  };

  const applyImport = async (raw: string) => {
    const snapshot = parseSnapshot(raw);
    const counts = await appendSnapshot(snapshot);
    updateProfile(snapshot.profile);
    showBanner(
      'success',
      t('data.import.success', {
        expenses: counts.expenses,
        debts: counts.debts,
        incomes: counts.incomes,
      }),
    );
  };

  const handleImportFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (result.canceled) return;
      const content = await new File(result.assets[0].uri).text();
      await applyImport(content);
    } catch {
      showBanner('error', t('data.import.error'));
    }
  };

  const handlePasteImport = async () => {
    try {
      await applyImport(pasteText);
      setPasteText('');
    } catch {
      showBanner('error', t('data.import.error'));
    }
  };

  const handleFrequencyChange = (next: BackupFrequency) => {
    setFrequency(next);
    if (next === 'off') {
      writeAutoBackupMeta({ frequency: 'off', lastBackup: undefined });
      setLastBackup(undefined);
    } else {
      writeAutoBackupMeta({ frequency: next, lastBackup });
    }
  };

  const handleBackupNow = async () => {
    setBusy(true);
    try {
      const snapshot = await buildSnapshot(profile, baseCurrency, themeId);
      writeAutoBackupSnapshot(snapshot);
      writeAutoBackupMeta({ frequency, lastBackup: snapshot.exportedAt });
      setLastBackup(snapshot.exportedAt);
      setHasSnapshot(true);
      showBanner('success', t('data.autoBackup.backupSuccess'));
    } catch {
      showBanner('error', t('data.export.error'));
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    setRestoreConfirmOpen(false);
    const snapshot = readAutoBackupSnapshot();
    if (!snapshot) return;
    setBusy(true);
    try {
      await replaceWithSnapshot(snapshot);
      updateProfile(snapshot.profile);
      showBanner('success', t('data.autoBackup.restoreSuccess'));
    } catch {
      showBanner('error', t('data.import.error'));
    } finally {
      setBusy(false);
    }
  };

  const copyPrompt = async (key: 'debts' | 'expenses') => {
    await Clipboard.setStringAsync(key === 'debts' ? DEBTS_PROMPT : EXPENSES_PROMPT);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const frequencyOptions = BACKUP_FREQUENCIES.map((id) => ({
    label: t(`data.autoBackup.${id}`),
    value: id,
  }));

  const canRestore = frequency !== 'off' && hasSnapshot;

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
        {banner ? (
          <InlineBanner
            kind={banner.kind}
            message={banner.message}
            onDismiss={() => setBanner(null)}
            autoDismissMs={4000}
          />
        ) : null}

        <SettingsCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <IconTile size={36} tint="accent">
              <Shield size={16} color={theme.accent2} />
            </IconTile>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: theme.textPrimary }}>
                {t('settings.backupData')}
              </Text>
              <Text style={{ fontSize: 11, color: theme.textTertiary, marginTop: 2 }}>
                {t('data.description')}
              </Text>
            </View>
          </View>
        </SettingsCard>

        <SettingsCard title={t('data.export.title')}>
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={handleExport}
              disabled={busy}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: theme.accent1,
                borderRadius: RADII.field,
                paddingVertical: 12,
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Download size={15} color={theme.buttonText} />
              <Text style={{ color: theme.buttonText, fontWeight: '700', fontSize: 13 }}>
                {t('data.export.button')}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleImportFile}
              disabled={busy}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                // Same light/dark split as SecondaryButton's ghost fill — a
                // flat white wash would sit invisibly flush with a light
                // surface instead of reading as a distinct button.
                backgroundColor: theme.isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: RADII.field,
                paddingVertical: 12,
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Upload size={15} color={theme.textPrimary} />
              <Text style={{ color: theme.textPrimary, fontWeight: '700', fontSize: 13 }}>
                {t('data.import.button')}
              </Text>
            </Pressable>
          </View>
        </SettingsCard>

        <SettingsCard title={t('data.autoBackup.title')}>
          <SegmentedControl<BackupFrequency>
            options={frequencyOptions}
            value={frequency}
            onChange={handleFrequencyChange}
          />

          <Text style={{ fontSize: 11, color: theme.textTertiary, marginTop: 10 }}>
            {t('data.autoBackup.status', { time: humanizeLastBackup(lastBackup, t) })}
          </Text>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <SecondaryButton
                label={t('data.autoBackup.now')}
                onPress={handleBackupNow}
                disabled={busy}
              />
            </View>
            {canRestore ? (
              <View style={{ flex: 1 }}>
                <SecondaryButton
                  label={t('data.autoBackup.restore')}
                  onPress={() => setRestoreConfirmOpen(true)}
                  disabled={busy}
                />
              </View>
            ) : null}
          </View>
        </SettingsCard>

        <SettingsCard title={t('data.paste.title')}>
          <TextInput
            value={pasteText}
            onChangeText={setPasteText}
            placeholder={t('data.paste.placeholder')}
            placeholderTextColor={theme.textTertiary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            style={{
              fontSize: 12,
              color: theme.textPrimary,
              backgroundColor: theme.surfaceAlt,
              borderRadius: RADII.field,
              borderWidth: 1,
              borderColor: theme.border,
              padding: 12,
              minHeight: 110,
            }}
          />
          <View style={{ marginTop: 10 }}>
            <GradientButton
              label={t('data.paste.button')}
              onPress={handlePasteImport}
              disabled={!pasteText.trim()}
            />
          </View>
        </SettingsCard>

        <SettingsCard title={t('data.prompts.title')}>
          <Text style={{ fontSize: 11, color: theme.textTertiary, marginBottom: 12 }}>
            {t('data.prompts.caption')}
          </Text>
          <View style={{ gap: 8 }}>
            <PromptCopyRow
              label={t('data.prompts.copyDebts')}
              copied={copiedKey === 'debts'}
              onPress={() => copyPrompt('debts')}
            />
            <PromptCopyRow
              label={t('data.prompts.copyExpenses')}
              copied={copiedKey === 'expenses'}
              onPress={() => copyPrompt('expenses')}
            />
          </View>
        </SettingsCard>

        <ConfirmModal
          visible={restoreConfirmOpen}
          title={t('data.autoBackup.restoreConfirmTitle')}
          subtitle={t('data.autoBackup.restoreConfirmSubtitle', {
            time: humanizeLastBackup(lastBackup, t),
          })}
          onCancel={() => setRestoreConfirmOpen(false)}
          onConfirm={handleRestore}
          confirmLabel={t('data.autoBackup.restore')}
          cancelLabel={t('common.cancel')}
        />
      </ScrollView>
    </PageTransition>
  );
}

function PromptCopyRow({
  label,
  copied,
  onPress,
}: {
  label: string;
  copied: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.surfaceAlt,
        borderRadius: RADII.field,
        borderWidth: 1,
        borderColor: theme.border,
        paddingVertical: 11,
        paddingHorizontal: 14,
      }}
    >
      <Text style={{ fontSize: 12.5, fontWeight: '600', color: theme.textPrimary }}>{label}</Text>
      {copied ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Check size={13} color={theme.accent2} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: theme.accent2 }}>
            {t('data.prompts.copied')}
          </Text>
        </View>
      ) : (
        <Copy size={14} color={theme.textTertiary} />
      )}
    </Pressable>
  );
}
