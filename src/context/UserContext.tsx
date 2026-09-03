import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { DEFAULT_PROFILE, type Profile } from '@/constants/initialData';
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
