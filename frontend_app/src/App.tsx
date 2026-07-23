import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.tsx';
import { useIsDesktop } from './hooks/useIsDesktop.ts';
import { ProfileProvider, useProfile } from './context/ProfileContext.tsx';
import { ActiveIntentionProvider } from './context/ActiveIntentionContext.tsx';
import { SessionsProvider } from './context/SessionsContext.tsx';
import AppShell from './components/AppShell.tsx';
import PrismLoader from './components/PrismLoader.tsx';

// ── Eager pages — the four most-likely first-paint targets ─────────────────
// These render on initial load, so keeping them in the main bundle avoids a
// chunk-download wait before the user sees anything.
//   • LandingPage / LoginPage / WelcomeSplashPage — unauthenticated entry
//   • PathAheadPage — the default authenticated landing surface (/home)
import LandingPage from './app/LandingPage.tsx';
import LoginPage from './app/LoginPage.tsx';
import WelcomeSplashPage from './app/WelcomeSplashPage.tsx';
import PathAheadPage from './app/PathAheadPage.tsx';

// ── Lazy-loaded pages — split into separate JS chunks ──────────────────────
// Per the 2026-05-09 perf audit: the prior bundle shipped all 22 routes
// upfront. Route-level React.lazy + Suspense lets each page chunk download
// on demand. The vite-plugin-pwa precache picks up the chunk filenames
// automatically, so SW-cached repeat visits stay instant.
const ResetPasswordPage         = lazy(() => import('./app/ResetPasswordPage.tsx'));
const CalendarPage              = lazy(() => import('./app/CalendarPage.tsx'));
const AtlasPage                 = lazy(() => import('./app/AtlasPage.tsx'));
const IntentionsPage            = lazy(() => import('./app/IntentionsPage.tsx'));
const JournalEntryPage          = lazy(() => import('./app/JournalEntryPage.tsx'));
const JournalIndexPage          = lazy(() => import('./app/JournalIndexPage.tsx'));
const NotesPage                 = lazy(() => import('./app/NotesPage.tsx'));
const SessionDetailPage         = lazy(() => import('./app/SessionDetailPage.tsx'));
const ProfilePage               = lazy(() => import('./app/ProfilePage.tsx'));
const ClassSchedulesPage        = lazy(() => import('./app/ClassSchedulesPage.tsx'));
const MovesLibraryPage          = lazy(() => import('./app/MovesLibraryPage.tsx'));
const TechniquePage             = lazy(() => import('./app/TechniquePage.tsx'));
const AdminDashboardPage        = lazy(() => import('./app/AdminDashboardPage.tsx'));
const AdminUserDetailPage       = lazy(() => import('./app/AdminUserDetailPage.tsx'));
const AdminProdDesignPage       = lazy(() => import('./app/AdminProdDesignPage.tsx'));
const OnboardingNamePage        = lazy(() => import('./app/OnboardingNamePage.tsx'));
const OnboardingBeltPage        = lazy(() => import('./app/OnboardingBeltPage.tsx'));
const OnboardingFirstSessionPage = lazy(() => import('./app/OnboardingFirstSessionPage.tsx'));
const OnboardingDonePage        = lazy(() => import('./app/OnboardingDonePage.tsx'));

// Brand-aligned full-screen fallback for route chunks that haven't loaded yet.
// PrismLoader is in the main bundle (it's also what PageContent's mobile
// LoadingScreen renders), so it shows up instantly while the chunk downloads —
// and route waits now share the same loading identity as data waits. Per the
// 2026-06-28 motion study, the Prism owns loading; the belt-tying animation is
// reserved for promotion moments.
function RouteFallback() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--j2-page-bg, #0D1A14)',
      }}
    >
      <PrismLoader />
    </div>
  );
}

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
        <SessionsProvider>
          <OnboardingGate>
            <AppShell>{children}</AppShell>
          </OnboardingGate>
        </SessionsProvider>
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
    // Single Suspense boundary at the top — every lazy chunk falls through
    // here. Keeps the fallback consistent across the app.
    <Suspense fallback={<RouteFallback />}>
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
        <Route path="/notes"        element={<ProtectedShell><NotesPage /></ProtectedShell>} />
        <Route path="/intentions"              element={<ProtectedShell><IntentionsPage /></ProtectedShell>} />
        <Route path="/intentions/:id/journal" element={<ProtectedShell><JournalEntryPage /></ProtectedShell>} />
        <Route path="/profile"          element={<ProtectedShell><ProfilePage /></ProtectedShell>} />
        <Route path="/profile/classes"  element={<ProtectedShell><ClassSchedulesPage /></ProtectedShell>} />
        <Route path="/library"        element={<ProtectedShell><MovesLibraryPage /></ProtectedShell>} />
        <Route path="/techniques/:id" element={<ProtectedShell><TechniquePage /></ProtectedShell>} />
        <Route path="/admin"             element={<ProtectedShell><AdminDashboardPage /></ProtectedShell>} />
        <Route path="/admin/users/:userId" element={<ProtectedShell><AdminUserDetailPage /></ProtectedShell>} />
        <Route path="/admin/prod-design" element={<ProtectedShell><AdminProdDesignPage /></ProtectedShell>} />

        {/* Legacy route — keep for any bookmarks */}
        <Route path="/dashboard"   element={<Navigate to="/home" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
