import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useCurrency } from '@/context/CurrencyContext';
import { useDebts } from '@/context/DebtsContext';
import { useLanguage } from '@/context/LanguageContext';
import { todayStr } from '@/lib/dates';
import { addDays, installmentEvents } from '@/lib/installments';
import {
  PLAN_END_LEAD_DAYS,
  REMINDER_HORIZON_DAYS,
  cancelAllReminders,
  planReminders,
  readReminderLead,
  readRemindersEnabled,
  remindersPermissionGranted,
  requestRemindersPermission,
  syncScheduledReminders,
  writeReminderLead,
  writeRemindersEnabled,
} from '@/lib/notifications';
import type { ReminderLead } from '@/lib/notifications';

/**
 * Installment reminders (FEATURE_SPEC 1.13): the setting, the notification permission, and the
 * rescheduling. The whole plan is rebuilt and rescheduled whenever anything it depends on changes
 * — debts, payments, a person's name, the setting, the lead time or the language — so there is no
 * background task and nothing can drift from what the Dashboard's Coming up card shows.
 */

interface RemindersContextValue {
  enabled: boolean;
  /** Turning them on asks for notification permission; a refusal leaves them off. */
  setEnabled: (enabled: boolean) => void;
  lead: ReminderLead;
  setLead: (lead: ReminderLead) => void;
  /** True when the last attempt to turn them on was refused — Settings explains how to fix it. */
  permissionDenied: boolean;
  dismissPermissionDenied: () => void;
}

const RemindersContext = createContext<RemindersContextValue | null>(null);

export function RemindersProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const { formatOriginalMoney } = useCurrency();
  const { debtViews, payments, peopleById } = useDebts();

  const [enabled, setEnabledState] = useState(readRemindersEnabled);
  const [lead, setLeadState] = useState(readReminderLead);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const setEnabled = useCallback(
    (next: boolean) => {
      if (!next) {
        writeRemindersEnabled(false);
        setEnabledState(false);
        setPermissionDenied(false);
        return;
      }
      void (async () => {
        try {
          const granted = await requestRemindersPermission(t('reminders.channelName'));
          writeRemindersEnabled(granted);
          setEnabledState(granted);
          setPermissionDenied(!granted);
        } catch (error) {
          console.warn('[reminders] asking for permission failed', error);
          setPermissionDenied(true);
        }
      })();
    },
    [t],
  );

  const setLead = useCallback((next: ReminderLead) => {
    writeReminderLead(next);
    setLeadState(next);
  }, []);

  const dismissPermissionDenied = useCallback(() => setPermissionDenied(false), []);

  // Reschedule everything whenever the plan could have changed.
  useEffect(() => {
    if (!enabled) {
      void cancelAllReminders().catch((error) =>
        console.warn('[reminders] clearing failed', error),
      );
      return;
    }
    const today = todayStr();
    // Plan-end reminders land a week before the end date, so the window reaches past the horizon.
    const events = installmentEvents(
      debtViews,
      payments,
      today,
      addDays(today, REMINDER_HORIZON_DAYS + PLAN_END_LEAD_DAYS),
    );
    const planned = planReminders(events, lead, {
      t,
      personName: (personId) => peopleById.get(personId)?.name ?? '',
      formatAmount: formatOriginalMoney,
    });
    void syncScheduledReminders(planned).catch((error) =>
      console.warn('[reminders] scheduling failed', error),
    );
  }, [enabled, lead, debtViews, payments, peopleById, t, formatOriginalMoney]);

  // Notifications can be switched off for the app in system settings while it isn't looking.
  useEffect(() => {
    if (!enabled) return;
    const check = () => {
      void remindersPermissionGranted().then((granted) => {
        if (granted) return;
        writeRemindersEnabled(false);
        setEnabledState(false);
      });
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => subscription.remove();
  }, [enabled]);

  const value = useMemo<RemindersContextValue>(
    () => ({ enabled, setEnabled, lead, setLead, permissionDenied, dismissPermissionDenied }),
    [enabled, setEnabled, lead, setLead, permissionDenied, dismissPermissionDenied],
  );

  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>;
}

export function useReminders(): RemindersContextValue {
  const ctx = useContext(RemindersContext);
  if (!ctx) throw new Error('useReminders must be used within a RemindersProvider');
  return ctx;
}
