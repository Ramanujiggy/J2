import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.ts';
import { ProfileProvider } from './context/ProfileContext.tsx';
import AppShell from './components/AppShell.tsx';
import HomePage from './app/HomePage.tsx';
import PathAheadPage from './app/PathAheadPage.tsx';
import CalendarPage from './app/CalendarPage.tsx';
import AnalyticsPage from './app/AnalyticsPage.tsx';
import IntentionsPage from './app/IntentionsPage.tsx';
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

      <Route path="/home"        element={<ProtectedShell><PathAheadPage /></ProtectedShell>} />
      <Route path="/calendar"    element={<ProtectedShell><CalendarPage /></ProtectedShell>} />
      <Route path="/analytics"   element={<ProtectedShell><AnalyticsPage /></ProtectedShell>} />
      <Route path="/intentions"  element={<ProtectedShell><IntentionsPage /></ProtectedShell>} />
      <Route path="/profile"     element={<ProtectedShell><ProfilePage /></ProtectedShell>} />

      {/* Legacy route — keep for any bookmarks */}
      <Route path="/dashboard"   element={<Navigate to="/home" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
