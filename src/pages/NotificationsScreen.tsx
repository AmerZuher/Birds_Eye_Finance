import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { CalendarCheck, CalendarClock, Clock } from 'lucide-react-native';

import { PageTransition } from '@/components/PageTransition';
import { InlineBanner } from '@/components/ui/InlineBanner';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsCard';
import { useChrome } from '@/context/ChromeContext';
import { useDebts } from '@/context/DebtsContext';
import { useLanguage } from '@/context/LanguageContext';
import { useReminders } from '@/context/RemindersContext';
import { useTheme } from '@/context/ThemeContext';
import { addDays, todayStr } from '@/lib/dates';
import { formatDebtId } from '@/lib/debtStatus';
import { installmentEvents } from '@/lib/installments';
import {
  PLAN_END_LEAD_DAYS,
  REMINDER_HORIZON_DAYS,
  REMINDER_HOUR,
  reminderLeadDays,
} from '@/lib/notifications';
import type { ReminderLead } from '@/lib/notifications';
import { HIDDEN_SCROLLBARS } from '@/lib/scroll';

/**
 * Settings › Notifications (FEATURE_SPEC 3.5). Installment reminders (1.13) are all there is
 * today; the screen is its own sub-screen so later notification kinds get a card each. The
 * on/off switch itself stays on the Settings hub row — this is where they are customized.
 */
export default function NotificationsScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { headerHeight } = useChrome();
  const reminders = useReminders();
  const { debtViews, payments, peopleById } = useDebts();

  const today = todayStr();

  // The soonest reminder that would actually be sent — the same calendar the scheduler uses,
  // so what this line promises and what arrives can't drift apart.
  const next = useMemo(() => {
    const event = installmentEvents(
      debtViews,
      payments,
      today,
      addDays(today, REMINDER_HORIZON_DAYS),
    )[0];
    if (!event) return null;
    const lead =
      event.kind === 'installment' ? reminderLeadDays(reminders.lead) : PLAN_END_LEAD_DAYS;
    return {
      date: addDays(event.date, -lead),
      name: peopleById.get(event.personId)?.name ?? '',
      id: formatDebtId(event.debtId),
    };
  }, [debtViews, payments, today, reminders.lead, peopleById]);

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
        {!reminders.enabled ? (
          <InlineBanner kind="warning" message={t('notifications.disabledHint')} />
        ) : null}

        <SettingsCard title={t('notifications.installments.title')}>
          <Text style={{ fontSize: 12, lineHeight: 18, color: theme.textSecondary }}>
            {t('notifications.installments.description')}
          </Text>

          <SettingsRow
            icon={CalendarClock}
            label={t('notifications.kind.installment')}
            subtitle={t('notifications.kind.installmentHint')}
          />

          <SettingsRow
            showTopBorder
            icon={CalendarCheck}
            label={t('notifications.kind.planEnd')}
            subtitle={t('notifications.kind.planEndHint')}
          />

          <SettingsRow
            showTopBorder
            icon={Clock}
            label={t('notifications.time.title')}
            subtitle={t('notifications.time.subtitle')}
            value={
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>
                {`${REMINDER_HOUR}:00`}
              </Text>
            }
          />
        </SettingsCard>

        <SettingsCard title={t('notifications.timing.title')}>
          <SettingsRow
            icon={CalendarClock}
            label={t('notifications.lead.title')}
            subtitle={t('notifications.lead.subtitle')}
            footer={
              <View style={{ gap: 10 }}>
                <SegmentedControl<ReminderLead>
                  options={[
                    { label: t('settings.notifications.lead.onDay'), value: 'onDay' },
                    { label: t('settings.notifications.lead.dayBefore'), value: 'dayBefore' },
                    { label: t('settings.notifications.lead.threeDays'), value: 'threeDays' },
                  ]}
                  value={reminders.lead}
                  onChange={reminders.setLead}
                />
                <Text style={{ fontSize: 11, color: theme.textTertiary }}>
                  {next
                    ? t('notifications.next', { date: next.date, name: next.name, id: next.id })
                    : t('notifications.nextNone')}
                </Text>
              </View>
            }
          />
        </SettingsCard>
      </ScrollView>
    </PageTransition>
  );
}
