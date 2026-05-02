// useOnboardingState — single source of truth for "does this user need
// to run the first-time onboarding flow?". Reads from ProfileContext so
// the rest of the app can branch on it without an extra fetch.
//
// `markComplete()` POSTs to the backend, then refreshes the context so the
// gate flips and the user is navigated out of the onboarding routes.

import { useCallback } from 'react';
import { api } from '../lib/api.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import type { ProfileResponse } from '../types/api.ts';

export function useOnboardingState() {
  const { onboardingCompletedAt, loaded, refreshProfile } = useProfile();

  const needsOnboarding = loaded && onboardingCompletedAt === null;

  const markComplete = useCallback(async () => {
    await api.post<ProfileResponse>('/api/profile/onboarding-complete', {});
    await refreshProfile();
  }, [refreshProfile]);

  return { needsOnboarding, loaded, markComplete };
}
