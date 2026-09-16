import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { Check, Copy, Download, Shield, Upload } from 'lucide-react-native';

import { PageTransition } from '@/components/PageTransition';
import { TextField } from '@/components/FormField';
import { SettingsCard } from '@/components/ui/SettingsCard';
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
  parseSnapshot,
  previewImport,
  profilePatchForImport,
} from '@/utils/dataTransfer';
import type { BackupSnapshot, ImportPreview } from '@/utils/dataTransfer';
import { HIDDEN_SCROLLBARS } from '@/lib/scroll';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

interface PendingImport {
  snapshot: BackupSnapshot;
  preview: ImportPreview;
  /** Clears the paste box once imported. */
  fromPaste: boolean;
}

/** Export and import only (FEATURE_SPEC 3.4) — the app keeps no local backups of its own. */
export default function DataScreen() {
  const { theme, themeId } = useTheme();
  const { t } = useLanguage();
  const { baseCurrency } = useCurrency();
  const { profile, updateProfile } = useUser();
  const { headerHeight } = useChrome();

  const [banner, setBanner] = useState<{ kind: BannerKind; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [copiedKey, setCopiedKey] = useState<'debts' | 'expenses' | null>(null);
  // Kept apart from the sheet's visibility so its text doesn't blank out mid-close.
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);

  const showBanner = (kind: BannerKind, message: string) => setBanner({ kind, message });

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

  /** Parses first, so bad JSON fails before anything is asked; nothing is written until confirmed. */
  const stageImport = (raw: string, fromPaste: boolean) => {
    const snapshot = parseSnapshot(raw);
    const preview = previewImport(snapshot);
    if (preview.expenses + preview.debts + preview.incomes + preview.balances === 0) {
      showBanner('error', t('data.import.empty'));
      return;
    }
    setPendingImport({ snapshot, preview, fromPaste });
    setImportConfirmOpen(true);
  };

  const handleImportFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (result.canceled) return;
      stageImport(await new File(result.assets[0].uri).text(), false);
    } catch {
      showBanner('error', t('data.import.error'));
    }
  };

  const handlePasteImport = () => {
    try {
      stageImport(pasteText, true);
    } catch {
      showBanner('error', t('data.import.error'));
    }
  };

  const confirmImport = async () => {
    setImportConfirmOpen(false);
    if (!pendingImport) return;
    const { snapshot, fromPaste } = pendingImport;
    setBusy(true);
    try {
      const counts = await appendSnapshot(snapshot);
      const profilePatch = profilePatchForImport(profile, snapshot.profile);
      if (profilePatch) updateProfile(profilePatch);
      if (fromPaste) setPasteText('');
      showBanner(
        'success',
        t('data.import.success', {
          expenses: counts.expenses,
          debts: counts.debts,
          incomes: counts.incomes,
        }),
      );
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
            <GradientButton
              icon={Download}
              label={t('data.export.button')}
              onPress={handleExport}
              disabled={busy}
            />
            <SecondaryButton
              icon={Upload}
              label={t('data.import.button')}
              onPress={handleImportFile}
              disabled={busy}
            />
            <Text style={{ fontSize: 11, color: theme.textTertiary }}>
              {t('data.attachmentsNote')}
            </Text>
          </View>
        </SettingsCard>

        <SettingsCard title={t('data.paste.title')}>
          <TextField
            value={pasteText}
            onChangeText={setPasteText}
            placeholder={t('data.paste.placeholder')}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            style={{ fontSize: 12, paddingHorizontal: 12, paddingVertical: 12, minHeight: 110 }}
          />
          <View style={{ marginTop: 10 }}>
            <GradientButton
              label={t('data.paste.button')}
              onPress={handlePasteImport}
              disabled={!pasteText.trim() || busy}
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
          visible={importConfirmOpen}
          icon={Upload}
          tone="accent"
          title={t('data.import.confirmTitle')}
          subtitle={
            pendingImport
              ? t('data.import.confirmSubtitle', {
                  expenses: pendingImport.preview.expenses,
                  debts: pendingImport.preview.debts,
                  incomes: pendingImport.preview.incomes,
                  balances: pendingImport.preview.balances,
                })
              : undefined
          }
          onCancel={() => setImportConfirmOpen(false)}
          onConfirm={() => void confirmImport()}
          confirmLabel={t('data.import.confirm')}
          cancelLabel={t('common.cancel')}
        />
      </KeyboardAwareScrollView>
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
