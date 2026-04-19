import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.ts';
import { ProfileProvider } from './context/ProfileContext.tsx';
import { ActiveIntentionProvider } from './context/ActiveIntentionContext.tsx';
import AppShell from './components/AppShell.tsx';
import HomePage from './app/HomePage.tsx';
import ResetPasswordPage from './app/ResetPasswordPage.tsx';
import PathAheadPage from './app/PathAheadPage.tsx';
import CalendarPage from './app/CalendarPage.tsx';
import AnalyticsPage from './app/AnalyticsPage.tsx';
import AtlasPage from './app/AtlasPage.tsx';
import IntentionsPage from './app/IntentionsPage.tsx';
import JournalEntryPage from './app/JournalEntryPage.tsx';
import JournalIndexPage from './app/JournalIndexPage.tsx';
import SessionDetailPage from './app/SessionDetailPage.tsx';
import ProfilePage from './app/ProfilePage.tsx';
import MovesLibraryPage from './app/MovesLibraryPage.tsx';

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return (
    <ProfileProvider>
      <ActiveIntentionProvider>
        <AppShell>{children}</AppShell>
      </ActiveIntentionProvider>
    </ProfileProvider>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/home"        element={<ProtectedShell><PathAheadPage /></ProtectedShell>} />
      <Route path="/calendar"    element={<ProtectedShell><CalendarPage /></ProtectedShell>} />
      <Route path="/analytics"   element={<ProtectedShell><AnalyticsPage /></ProtectedShell>} />
      <Route path="/atlas"       element={<ProtectedShell><AtlasPage /></ProtectedShell>} />
      <Route path="/journal"     element={<ProtectedShell><JournalIndexPage /></ProtectedShell>} />
      <Route path="/journal/:id" element={<ProtectedShell><SessionDetailPage /></ProtectedShell>} />
      <Route path="/intentions"              element={<ProtectedShell><IntentionsPage /></ProtectedShell>} />
      <Route path="/intentions/:id/journal" element={<ProtectedShell><JournalEntryPage /></ProtectedShell>} />
      <Route path="/profile"     element={<ProtectedShell><ProfilePage /></ProtectedShell>} />
      <Route path="/library"     element={<ProtectedShell><MovesLibraryPage /></ProtectedShell>} />

      {/* Legacy route — keep for any bookmarks */}
      <Route path="/dashboard"   element={<Navigate to="/home" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
