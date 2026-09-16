import { Platform } from 'react-native';
import {
  AndroidImportance,
  SchedulableTriggerInputTypes,
  cancelAllScheduledNotificationsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from 'expo-notifications';

import { addDays } from '@/lib/installments';
import type { InstallmentEvent } from '@/lib/installments';
import { formatDebtId } from '@/lib/debtStatus';
import { storage, StorageKeys } from '@/lib/mmkv';

/**
 * Installment reminders (FEATURE_SPEC 1.13, CLAUDE.md rule 10). Every reminder is a local
 * notification scheduled ahead on its own exact date — not a repeating monthly trigger, which
 * can't express "the month's last day". Nothing is sent anywhere, and no background task runs:
 * the whole plan is rebuilt inside the app whenever anything it depends on changes.
 */

/** Reminders arrive at this hour, local time. */
export const REMINDER_HOUR = 9;
/** How far ahead reminders are scheduled; topped up every time the app is opened. */
export const REMINDER_HORIZON_DAYS = 90;
/** A plan-end reminder lands this many days before the end date. */
export const PLAN_END_LEAD_DAYS = 7;

const CHANNEL_ID = 'installment-reminders';

export type ReminderLead = 'onDay' | 'dayBefore' | 'threeDays';

export const REMINDER_LEADS: ReminderLead[] = ['onDay', 'dayBefore', 'threeDays'];

const LEAD_DAYS: Record<ReminderLead, number> = { onDay: 0, dayBefore: 1, threeDays: 3 };

// Reminders shown while the app is open behave like any other notification.
setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Off until the user turns reminders on in Settings. */
export function readRemindersEnabled(): boolean {
  return storage.getBoolean(StorageKeys.remindersEnabled) ?? false;
}

export function writeRemindersEnabled(enabled: boolean): void {
  storage.set(StorageKeys.remindersEnabled, enabled);
}

export function readReminderLead(): ReminderLead {
  const stored = storage.getString(StorageKeys.remindersLead);
  return REMINDER_LEADS.includes(stored as ReminderLead) ? (stored as ReminderLead) : 'dayBefore';
}

export function writeReminderLead(lead: ReminderLead): void {
  storage.set(StorageKeys.remindersLead, lead);
}

export interface PlannedReminder {
  fireAt: Date;
  title: string;
  body: string;
  debtId: number;
  personId: number;
}

/** What a reminder's text needs: the app's translator, the person's name, and money in the debt's currency. */
export interface ReminderContent {
  t: (key: string, vars?: Record<string, string | number>) => string;
  personName: (personId: number) => string;
  formatAmount: (amount: number, currency: string) => string;
}

function atReminderHour(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, REMINDER_HOUR, 0, 0, 0);
}

/**
 * Turns the installment calendar into the notifications to schedule: one per installment at the
 * chosen lead time, one per plan end a week before. Anything whose moment has passed is left out.
 */
export function planReminders(
  events: InstallmentEvent[],
  lead: ReminderLead,
  content: ReminderContent,
  now: Date = new Date(),
): PlannedReminder[] {
  const planned: PlannedReminder[] = [];

  for (const event of events) {
    const isInstallment = event.kind === 'installment';
    const leadDays = isInstallment ? LEAD_DAYS[lead] : PLAN_END_LEAD_DAYS;
    const fireAt = atReminderHour(addDays(event.date, -leadDays));
    if (fireAt.getTime() <= now.getTime()) continue;

    const vars = {
      amount: content.formatAmount(event.amount, event.currency),
      name: content.personName(event.personId),
      id: formatDebtId(event.debtId),
      n: leadDays,
    };
    const title = isInstallment
      ? leadDays === 0
        ? content.t('reminders.installment.today')
        : leadDays === 1
          ? content.t('reminders.installment.tomorrow')
          : content.t('reminders.installment.inDays', vars)
      : content.t('reminders.planEnd.title', vars);
    const body = content.t(
      isInstallment ? 'reminders.installment.body' : 'reminders.planEnd.body',
      vars,
    );

    planned.push({ fireAt, title, body, debtId: event.debtId, personId: event.personId });
  }

  return planned.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

/** Android 13 only shows the permission prompt once a channel exists, so the channel comes first. */
export async function ensureReminderChannel(channelName: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await setNotificationChannelAsync(CHANNEL_ID, {
    name: channelName,
    importance: AndroidImportance.DEFAULT,
  });
}

export async function remindersPermissionGranted(): Promise<boolean> {
  const { granted } = await getPermissionsAsync();
  return granted;
}

export async function requestRemindersPermission(channelName: string): Promise<boolean> {
  await ensureReminderChannel(channelName);
  const { granted } = await requestPermissionsAsync();
  return granted;
}

/** Replaces every reminder this app has scheduled with the given plan. */
export async function syncScheduledReminders(planned: PlannedReminder[]): Promise<number> {
  // The app schedules nothing else, so clearing everything keeps this simple and idempotent.
  await cancelAllScheduledNotificationsAsync();
  for (const reminder of planned) {
    await scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.body,
        data: { debtId: reminder.debtId, personId: reminder.personId },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: reminder.fireAt,
        channelId: CHANNEL_ID,
      },
    });
  }
  return planned.length;
}

export async function cancelAllReminders(): Promise<void> {
  await cancelAllScheduledNotificationsAsync();
}

/** The debt a tapped reminder points at, or null when the payload isn't one of ours. */
export function reminderTarget(data: unknown): { personId: number; debtId: number } | null {
  if (!data || typeof data !== 'object') return null;
  const { debtId, personId } = data as Record<string, unknown>;
  if (typeof debtId !== 'number' || typeof personId !== 'number') return null;
  return { personId, debtId };
}
