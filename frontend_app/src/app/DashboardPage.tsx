import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import TrainingHeatmap from '../components/TrainingHeatmap.tsx';
import LogSessionForm from '../components/LogSessionForm.tsx';

export default function DashboardPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col">

      {/* Nav */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-white">
          Journada
        </h1>
        <button
          onClick={handleLogout}
          className="text-sm text-white/50 hover:text-white transition-colors"
        >
          Log out
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-10">

        {/* Log a session */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">
            Log a Training Session
          </h2>
          <LogSessionForm />
        </section>

        {/* Training history heatmap */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">
            Training History
          </h2>
          <TrainingHeatmap />
        </section>

      </main>
    </div>
  );
}
