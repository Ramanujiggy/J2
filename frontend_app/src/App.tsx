import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './app/HomePage.tsx';
import DashboardPage from './app/DashboardPage.tsx';
import { useAuth } from './hooks/useAuth.ts';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/dashboard"
        element={isAuthenticated ? <DashboardPage /> : <Navigate to="/" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
