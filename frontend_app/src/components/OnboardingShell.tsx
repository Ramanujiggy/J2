// OnboardingShell — wraps every /onboarding/* page. Handles:
//   1. Auth gate — unauthed → /login
//   2. Onboarding gate — already-complete → /home (no infinite loop)
//   3. Editorial chrome — forest-green background, top progress bar,
//      single-column max-width 480px container.
//
// Keeps the onboarding routes simple: the page bodies focus on copy +
// interaction; this shell handles routing rules + visual register.

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { useProfile } from '../context/ProfileContext.tsx';
import OnboardingProgress from './OnboardingProgress.tsx';
import { PAGE_BG } from '../lib/theme.ts';

interface Props {
  /** 1-indexed current step (used to render the progress dots). */
  step: number;
  children: React.ReactNode;
}

export default function OnboardingShell({ step, children }: Props) {
  const { isAuthenticated } = useAuth();
  const { onboardingCompletedAt, loaded } = useProfile();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Profile not yet loaded — render the shell shape so we don't flash a redirect.
  if (loaded && onboardingCompletedAt) return <Navigate to="/home" replace />;

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: PAGE_BG,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <OnboardingProgress step={step} />
      <div
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 480,
          margin: '0 auto',
          padding: '0 22px 32px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  );
}
