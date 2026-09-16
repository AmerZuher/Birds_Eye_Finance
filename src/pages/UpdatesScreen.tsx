import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Download, RefreshCw } from 'lucide-react-native';

import { PageTransition } from '@/components/PageTransition';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { GradientButton } from '@/components/ui/GradientButton';
import { InlineBanner } from '@/components/ui/InlineBanner';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SecondaryButton } from '@/components/ui/SecondaryButton';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsCard';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useChrome } from '@/context/ChromeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import { useUpdates } from '@/context/UpdatesContext';
import { formatBytes } from '@/lib/attachments';
import { HIDDEN_SCROLLBARS } from '@/lib/scroll';
import { installedVersion } from '@/lib/updates';

/** Settings › App updates (FEATURE_SPEC 3.6). */
export default function UpdatesScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { headerHeight } = useChrome();
  const updates = useUpdates();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const size = updates.release ? formatBytes(updates.release.size) : '';
  const busy =
    updates.stage === 'downloading' ||
    updates.stage === 'verifying' ||
    updates.stage === 'installing';

  const status =
    updates.stage === 'checking'
      ? t('updates.checking')
      : updates.stage === 'downloading'
        ? t('updates.downloading', { percent: Math.round(updates.progress * 100) })
        : updates.stage === 'verifying'
          ? t('updates.verifying')
          : updates.stage === 'installing'
            ? t('updates.installing')
            : updates.release
              ? t('updates.available', { version: updates.release.version })
              : t('updates.upToDate');

  const errorMessage = updates.error
    ? t(
        updates.error === 'permission'
          ? 'updates.permission.subtitle'
          : `updates.error.${updates.error}`,
      )
    : '';

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
        <SettingsCard>
          <SettingsRow
            icon={RefreshCw}
            label={t('updates.auto.title')}
            subtitle={t('updates.auto.subtitle')}
            value={
              <ToggleSwitch
                value={updates.auto}
                onValueChange={updates.setAuto}
                accessibilityLabel={t('updates.auto.title')}
              />
            }
          />

          <SettingsRow
            showTopBorder
            icon={Download}
            label={t('updates.installed')}
            subtitle={status}
            value={
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: theme.textSecondary }}>
                {installedVersion()}
              </Text>
            }
            footer={
              <View style={{ gap: 10 }}>
                {updates.stage === 'downloading' ? (
                  <ProgressBar progress={updates.progress} height={6} />
                ) : null}

                {updates.release ? (
                  <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                    {t('updates.downloadSize', { size })}
                  </Text>
                ) : updates.lastCheck ? (
                  <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                    {t('updates.lastChecked', { date: updates.lastCheck.at.slice(0, 10) })}
                  </Text>
                ) : null}

                {errorMessage ? (
                  <InlineBanner
                    kind="error"
                    message={errorMessage}
                    onDismiss={updates.dismissError}
                  />
                ) : null}

                {updates.release && !busy ? (
                  <GradientButton
                    label={t('updates.update')}
                    onPress={() => setConfirmOpen(true)}
                  />
                ) : null}

                {busy ? (
                  <SecondaryButton
                    label={t('common.cancel')}
                    onPress={updates.cancel}
                    disabled={updates.stage !== 'downloading'}
                  />
                ) : (
                  <SecondaryButton
                    icon={RefreshCw}
                    label={t('updates.checkNow')}
                    onPress={updates.checkNow}
                    disabled={updates.stage === 'checking'}
                  />
                )}
              </View>
            }
          />
        </SettingsCard>
      </ScrollView>

      <ConfirmModal
        visible={confirmOpen}
        icon={Download}
        tone="accent"
        title={t('updates.confirm.title', { version: updates.release?.version ?? '' })}
        subtitle={t('updates.confirm.subtitle', { size })}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          updates.startUpdate();
        }}
        confirmLabel={t('updates.update')}
        cancelLabel={t('common.cancel')}
      />
    </PageTransition>
  );
}
