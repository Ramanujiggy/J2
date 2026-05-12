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
  /** mig 022 — null = onboarding not yet completed; routing gates on this. */
  onboardingCompletedAt: string | null;
  /** mig 023 — admin flag. Drives the conditional /admin link on the
   *  profile page and the route guard on the admin dashboard. */
  isAdmin: boolean;
  /** True until the first profile fetch resolves; prevents flash-redirects on cold load. */
  loaded: boolean;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue>({
  name: null,
  beltRank: null,
  stripes: 0,
  intentionsEnabled: true,
  onboardingCompletedAt: null,
  isAdmin: false,
  loaded: false,
  refreshProfile: async () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState<string | null>(null);
  const [beltRank, setBeltRank] = useState<BeltRank | null>(null);
  const [stripes, setStripes] = useState(0);
  const [intentionsEnabled, setIntentionsEnabled] = useState(true);
  const [onboardingCompletedAt, setOnboardingCompletedAt] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refreshProfile = useCallback(async () => {
    try {
      const data = await api.get<ProfileResponse>('/api/profile');
      if (data.profile) {
        setName(data.profile.name ?? null);
        setBeltRank((data.profile.belt_rank as BeltRank) ?? null);
        setStripes(data.profile.stripes ?? 0);
        setIntentionsEnabled(data.profile.intentions_enabled ?? true);
        setOnboardingCompletedAt(data.profile.onboarding_completed_at ?? null);
        setIsAdmin(data.profile.is_admin ?? false);
      }
    } catch {
      // non-critical — belt bar just won't render
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);
  useOnlineRefetch(refreshProfile);

  return (
    <ProfileContext.Provider value={{ name, beltRank, stripes, intentionsEnabled, onboardingCompletedAt, isAdmin, loaded, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
