import React from 'react';
import { ScrollView, Text } from 'react-native';
import { Clock } from 'lucide-react-native';

import { PageTransition } from '@/components/PageTransition';
import { InlineBanner } from '@/components/ui/InlineBanner';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsCard';
import { useChrome } from '@/context/ChromeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useReminders } from '@/context/RemindersContext';
import { useTheme } from '@/context/ThemeContext';
import type { ReminderLead } from '@/lib/notifications';
import { HIDDEN_SCROLLBARS } from '@/lib/scroll';

/**
 * Settings › Notifications (FEATURE_SPEC 3.5). Installment reminders (1.13) are all there is
 * today; the screen exists as its own sub-screen so later notification kinds get a card each
 * instead of piling more controls onto the Settings hub.
 */
export default function NotificationsScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { headerHeight } = useChrome();
  const reminders = useReminders();

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
        <SettingsCard title={t('notifications.installments.title')}>
          <Text style={{ fontSize: 12, lineHeight: 18, color: theme.textSecondary }}>
            {t('notifications.installments.description')}
          </Text>

          <SettingsRow
            icon={Clock}
            label={t('notifications.lead.title')}
            subtitle={t('notifications.lead.subtitle')}
            footer={
              <SegmentedControl<ReminderLead>
                options={[
                  { label: t('settings.notifications.lead.onDay'), value: 'onDay' },
                  { label: t('settings.notifications.lead.dayBefore'), value: 'dayBefore' },
                  { label: t('settings.notifications.lead.threeDays'), value: 'threeDays' },
                ]}
                value={reminders.lead}
                onChange={reminders.setLead}
              />
            }
          />

          {!reminders.enabled ? (
            <InlineBanner kind="warning" message={t('notifications.disabledHint')} />
          ) : null}
        </SettingsCard>
      </ScrollView>
    </PageTransition>
  );
}
