import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.ts';
import type { BeltRank } from '../components/BeltBar.tsx';

interface ProfileContextValue {
  beltRank: BeltRank | null;
  stripes: number;
  refreshProfile: () => void;
}

const ProfileContext = createContext<ProfileContextValue>({
  beltRank: null,
  stripes: 0,
  refreshProfile: () => {},
});

interface ProfileResponse {
  profile: { belt_rank: string | null; stripes: number } | null;
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [beltRank, setBeltRank] = useState<BeltRank | null>(null);
  const [stripes, setStripes] = useState(0);

  const refreshProfile = useCallback(async () => {
    try {
      const data = await api.get<ProfileResponse>('/api/profile');
      if (data.profile) {
        setBeltRank((data.profile.belt_rank as BeltRank) ?? null);
        setStripes(data.profile.stripes ?? 0);
      }
    } catch {
      // non-critical — belt bar just won't render
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  return (
    <ProfileContext.Provider value={{ beltRank, stripes, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
