import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.ts';
import { useIsDesktop } from './hooks/useIsDesktop.ts';
import { ProfileProvider, useProfile } from './context/ProfileContext.tsx';
import { ActiveIntentionProvider } from './context/ActiveIntentionContext.tsx';
import AppShell from './components/AppShell.tsx';
import LandingPage from './app/LandingPage.tsx';
import LoginPage from './app/LoginPage.tsx';
import ResetPasswordPage from './app/ResetPasswordPage.tsx';
import PathAheadPage from './app/PathAheadPage.tsx';
import CalendarPage from './app/CalendarPage.tsx';
import AtlasPage from './app/AtlasPage.tsx';
import IntentionsPage from './app/IntentionsPage.tsx';
import JournalEntryPage from './app/JournalEntryPage.tsx';
import JournalIndexPage from './app/JournalIndexPage.tsx';
import SessionDetailPage from './app/SessionDetailPage.tsx';
import ProfilePage from './app/ProfilePage.tsx';
import ClassSchedulesPage from './app/ClassSchedulesPage.tsx';
import MovesLibraryPage from './app/MovesLibraryPage.tsx';
import AdminDashboardPage from './app/AdminDashboardPage.tsx';
import AdminUserDetailPage from './app/AdminUserDetailPage.tsx';
import WelcomeSplashPage from './app/WelcomeSplashPage.tsx';
import OnboardingNamePage from './app/OnboardingNamePage.tsx';
import OnboardingBeltPage from './app/OnboardingBeltPage.tsx';
import OnboardingFirstSessionPage from './app/OnboardingFirstSessionPage.tsx';
import OnboardingDonePage from './app/OnboardingDonePage.tsx';

// Inner gate that lives inside ProfileProvider — checks the loaded profile's
// onboarding_completed_at and redirects users into /onboarding/name if they
// haven't finished the guided flow. Prevents a half-onboarded user from
// reaching /home directly.
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { onboardingCompletedAt, loaded } = useProfile();
  const location = useLocation();
  // Wait for the first profile fetch so we don't flash a redirect before
  // we know the answer. While loading, render children (any render is
  // ephemeral — PageContent surfaces a loader anyway).
  if (loaded && onboardingCompletedAt === null && !location.pathname.startsWith('/onboarding')) {
    return <Navigate to="/onboarding/name" replace />;
  }
  return <>{children}</>;
}

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <ProfileProvider>
      <ActiveIntentionProvider>
        <OnboardingGate>
          <AppShell>{children}</AppShell>
        </OnboardingGate>
      </ActiveIntentionProvider>
    </ProfileProvider>
  );
}

// Onboarding pages run inside ProfileProvider (so they can read/PUT profile
// fields) but NOT inside AppShell — onboarding owns its own chrome.
function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <ProfileProvider>
      {children}
    </ProfileProvider>
  );
}

// Mobile unauthenticated `/` lands on /welcome; desktop keeps the existing
// LandingPage. `useIsDesktop` is the same hook the rest of the app uses
// (1024px breakpoint).
function RootLanding() {
  const { isAuthenticated } = useAuth();
  const isDesktop = useIsDesktop();
  if (isAuthenticated) return <Navigate to="/home" replace />;
  if (!isDesktop) return <Navigate to="/welcome" replace />;
  return <LandingPage />;
}

function App() {
  return (
    <Routes>
      <Route path="/"               element={<RootLanding />} />
      <Route path="/welcome"        element={<WelcomeSplashPage />} />
      <Route path="/login"          element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Onboarding routes — auth required, gated inside OnboardingShell */}
      <Route path="/onboarding/name"          element={<OnboardingProvider><OnboardingNamePage /></OnboardingProvider>} />
      <Route path="/onboarding/belt"          element={<OnboardingProvider><OnboardingBeltPage /></OnboardingProvider>} />
      <Route path="/onboarding/first-session" element={<OnboardingProvider><OnboardingFirstSessionPage /></OnboardingProvider>} />
      <Route path="/onboarding/done"          element={<OnboardingProvider><OnboardingDonePage /></OnboardingProvider>} />

      <Route path="/home"        element={<ProtectedShell><PathAheadPage /></ProtectedShell>} />
      <Route path="/calendar"    element={<ProtectedShell><CalendarPage /></ProtectedShell>} />
      {/* /analytics retired — its functionality folded into Atlas's Prism tab.
          Bookmarks land on the merged view. */}
      <Route path="/analytics"   element={<Navigate to="/atlas" replace />} />
      <Route path="/atlas"       element={<ProtectedShell><AtlasPage /></ProtectedShell>} />
      <Route path="/journal"     element={<ProtectedShell><JournalIndexPage /></ProtectedShell>} />
      <Route path="/journal/:id" element={<ProtectedShell><SessionDetailPage /></ProtectedShell>} />
      <Route path="/intentions"              element={<ProtectedShell><IntentionsPage /></ProtectedShell>} />
      <Route path="/intentions/:id/journal" element={<ProtectedShell><JournalEntryPage /></ProtectedShell>} />
      <Route path="/profile"          element={<ProtectedShell><ProfilePage /></ProtectedShell>} />
      <Route path="/profile/classes"  element={<ProtectedShell><ClassSchedulesPage /></ProtectedShell>} />
      <Route path="/library"     element={<ProtectedShell><MovesLibraryPage /></ProtectedShell>} />
      <Route path="/admin"            element={<ProtectedShell><AdminDashboardPage /></ProtectedShell>} />
      <Route path="/admin/users/:userId" element={<ProtectedShell><AdminUserDetailPage /></ProtectedShell>} />

      {/* Legacy route — keep for any bookmarks */}
      <Route path="/dashboard"   element={<Navigate to="/home" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
