import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_PROFILE, type Profile } from '@/constants/initialData';
import { migrateLegacyProfileAvatar } from '@/lib/avatars';
import { getJSON, setJSON, StorageKeys } from '@/lib/mmkv';

function readInitialProfile(): Profile {
  const stored = getJSON<Profile & { lastReconciledDate?: string }>(StorageKeys.profile);
  if (!stored) return DEFAULT_PROFILE;
  // `lastReconciledDate` was stamped on every balance edit up to 2.2.0 and never read
  // anywhere; 2.3.0 derives the last reconciliation from the `balance_snapshots` table
  // instead. Dropped on read so it stops being rewritten — and re-exported — forever.
  const { lastReconciledDate: _dropped, ...profile } = stored;
  return profile;
}

interface UserContextValue {
  profile: Profile;
  updateProfile: (patch: Partial<Profile>) => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>(readInitialProfile);

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      setJSON(StorageKeys.profile, next);
      return next;
    });
  }, []);

  // Profile photos saved before 2.1.0 point at an absolute path; move them to the
  // relative scheme (src/lib/avatars.ts). A no-op once migrated.
  useEffect(() => {
    migrateLegacyProfileAvatar(readInitialProfile().avatar)
      .then((migrated) => {
        if (migrated) updateProfile({ avatar: migrated });
      })
      .catch((error: unknown) => console.warn('[profile] photo migration failed', error));
  }, [updateProfile]);

  const value = useMemo<UserContextValue>(
    () => ({ profile, updateProfile }),
    [profile, updateProfile],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within a UserProvider');
  return ctx;
}
