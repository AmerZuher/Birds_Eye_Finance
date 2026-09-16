import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import {
  addNotificationResponseReceivedListener,
  getLastNotificationResponseAsync,
} from 'expo-notifications';
import type { NotificationResponse } from 'expo-notifications';

import { useChrome } from '@/context/ChromeContext';
import { reminderTarget } from '@/lib/notifications';
import { storage, StorageKeys } from '@/lib/mmkv';

/**
 * Tapping an installment reminder opens that debt on the Debts screen (FEATURE_SPEC 1.13).
 * Mounted at the root, like PendingPhotoRecovery, because a tap can launch the app cold — long
 * before the Debts screen exists — so the target is queued in ChromeContext and picked up there.
 */
export function NotificationRouting() {
  const router = useRouter();
  const { requestDebtOpen } = useChrome();

  useEffect(() => {
    let cancelled = false;

    const open = (response: NotificationResponse | null) => {
      if (cancelled || !response) return;
      const target = reminderTarget(response.notification.request.content.data);
      if (!target) return;
      requestDebtOpen(target);
      router.navigate('/debts');
    };

    // A tap that launched the app. This keeps returning the same response on every later
    // launch, so each one is acted on once — its identifier is remembered.
    void getLastNotificationResponseAsync().then((response) => {
      const id = response?.notification.request.identifier;
      if (!id || storage.getString(StorageKeys.remindersLastHandled) === id) return;
      storage.set(StorageKeys.remindersLastHandled, id);
      open(response);
    });

    const subscription = addNotificationResponseReceivedListener(open);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [requestDebtOpen, router]);

  return null;
}
