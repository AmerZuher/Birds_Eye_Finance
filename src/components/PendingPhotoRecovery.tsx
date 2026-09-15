import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { useChrome } from '@/context/ChromeContext';
import { useUser } from '@/context/UserContext';
import { deleteStoredAvatar, recoverPendingPhotoPick, saveAvatarImage } from '@/lib/avatars';

/**
 * Delivers a photo picked right before Android destroyed the Activity (see pickAvatarPhoto).
 * After that restart every screen's state is gone, so this runs once at launch and takes the
 * photo back to where it was being picked. Renders nothing.
 */
export function PendingPhotoRecovery() {
  const router = useRouter();
  const { profile, updateProfile } = useUser();
  const { requestPersonPhoto } = useChrome();

  useEffect(() => {
    void (async () => {
      try {
        const recovered = await recoverPendingPhotoPick();
        if (!recovered) return;
        const stored = await saveAvatarImage(recovered.uri);
        if (recovered.target.kind === 'profile') {
          // Edit Profile applies a picked photo straight away, so this does too.
          const previous = profile.avatar;
          updateProfile({ avatar: stored });
          deleteStoredAvatar(previous);
          router.navigate('/settings/edit-profile');
        } else {
          // Edit Person keeps a photo only on Save, so its sheet reopens with the photo in it.
          requestPersonPhoto({ personId: recovered.target.personId, avatar: stored });
          router.navigate('/debts');
        }
      } catch (error) {
        console.warn('[avatars] recovering a pending photo pick failed', error);
      }
    })();
    // Once per launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
