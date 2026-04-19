import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.ts';
import { ProfileProvider } from './context/ProfileContext.tsx';
import AppShell from './components/AppShell.tsx';
import HomePage from './app/HomePage.tsx';
import ResetPasswordPage from './app/ResetPasswordPage.tsx';
import PathAheadPage from './app/PathAheadPage.tsx';
import CalendarPage from './app/CalendarPage.tsx';
import AnalyticsPage from './app/AnalyticsPage.tsx';
import AtlasPage from './app/AtlasPage.tsx';
import IntentionsPage from './app/IntentionsPage.tsx';
import JournalEntryPage from './app/JournalEntryPage.tsx';
import ProfilePage from './app/ProfilePage.tsx';

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return (
    <ProfileProvider>
      <AppShell>{children}</AppShell>
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
      <Route path="/intentions"              element={<ProtectedShell><IntentionsPage /></ProtectedShell>} />
      <Route path="/intentions/:id/journal" element={<ProtectedShell><JournalEntryPage /></ProtectedShell>} />
      <Route path="/profile"     element={<ProtectedShell><ProfilePage /></ProtectedShell>} />

      {/* Legacy route — keep for any bookmarks */}
      <Route path="/dashboard"   element={<Navigate to="/home" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
