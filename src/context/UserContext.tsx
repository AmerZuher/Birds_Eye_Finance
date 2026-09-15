import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_PROFILE, type Profile } from '@/constants/initialData';
import { migrateLegacyProfileAvatar } from '@/lib/avatars';
import { getJSON, setJSON, StorageKeys } from '@/lib/mmkv';

function readInitialProfile(): Profile {
  return getJSON<Profile>(StorageKeys.profile) ?? DEFAULT_PROFILE;
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
