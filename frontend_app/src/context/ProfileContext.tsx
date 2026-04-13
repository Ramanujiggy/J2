import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.ts';
import { useOnlineRefetch } from '../hooks/useOnlineRefetch.ts';
import type { BeltRank } from '../components/BeltBar.tsx';
import type { ProfileResponse } from '../types/api.ts';

interface ProfileContextValue {
  name: string | null;
  beltRank: BeltRank | null;
  stripes: number;
  intentionsEnabled: boolean;
  refreshProfile: () => void;
}

const ProfileContext = createContext<ProfileContextValue>({
  name: null,
  beltRank: null,
  stripes: 0,
  intentionsEnabled: true,
  refreshProfile: () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState<string | null>(null);
  const [beltRank, setBeltRank] = useState<BeltRank | null>(null);
  const [stripes, setStripes] = useState(0);
  const [intentionsEnabled, setIntentionsEnabled] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const data = await api.get<ProfileResponse>('/api/profile');
      if (data.profile) {
        setName(data.profile.name ?? null);
        setBeltRank((data.profile.belt_rank as BeltRank) ?? null);
        setStripes(data.profile.stripes ?? 0);
        setIntentionsEnabled(data.profile.intentions_enabled ?? true);
      }
    } catch {
      // non-critical — belt bar just won't render
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);
  useOnlineRefetch(refreshProfile);

  return (
    <ProfileContext.Provider value={{ name, beltRank, stripes, intentionsEnabled, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
