import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import WaveBackground from './WaveBackground.tsx';
import BeltBar from './BeltBar.tsx';
import { PAGE_BG, PALE_YELLOW, GLOW_TITLE, GLOW_NAV, COPPER_BORDER } from '../lib/theme.ts';

// Lucide-style inline SVG icons — no extra dep needed
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}
function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function AnalyticsIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20L8 14l4 3 4-7 4 5" />
      <path d="M4 4v16h16" />
    </svg>
  );
}
function IntentionsIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
    </svg>
  );
}
function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

const TABS = [
  { path: '/home',        label: 'Home',       Icon: HomeIcon       },
  { path: '/calendar',   label: 'Calendar',   Icon: CalendarIcon   },
  { path: '/analytics',  label: 'Analytics',  Icon: AnalyticsIcon  },
  { path: '/intentions', label: 'Intentions', Icon: IntentionsIcon },
  { path: '/profile',    label: 'Profile',    Icon: ProfileIcon    },
] as const;

interface Props {
  children: React.ReactNode;
}

export default function AppShell({ children }: Props) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { beltRank, stripes } = useProfile();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const activeTab = TABS.find(t => location.pathname.startsWith(t.path))?.path ?? '/home';

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: PAGE_BG }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header
        className="border-b relative overflow-hidden flex-shrink-0"
        style={{ borderBottomColor: COPPER_BORDER }}
      >
        <WaveBackground />
        {/* Fade wave into page background */}
        <div
          style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to bottom, transparent 20%, ${PAGE_BG} 100%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Header top row: logo + logout */}
        <div className="relative z-10 px-6 pt-4 pb-2 flex items-center justify-between">
          <div className="w-fit">
            <h1
              className="text-xl font-bold tracking-tight"
              style={{ color: PALE_YELLOW, textShadow: GLOW_TITLE }}
            >
              Journada
            </h1>
            <BeltBar rank={beltRank} stripes={stripes} />
          </div>
          <button
            onClick={handleLogout}
            className="text-sm transition-colors"
            style={{ color: PALE_YELLOW, textShadow: GLOW_NAV }}
          >
            Log out
          </button>
        </div>

        {/* Desktop nav tabs — hidden on mobile */}
        <nav className="relative z-10 hidden sm:flex px-6 pb-0 gap-1">
          {TABS.map(({ path, label, Icon }) => {
            const isActive = activeTab === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors relative"
                style={{
                  color: isActive ? PALE_YELLOW : 'rgba(255,255,255,0.4)',
                  textShadow: isActive ? GLOW_NAV : 'none',
                  backgroundColor: isActive ? 'rgba(240,223,160,0.06)' : 'transparent',
                }}
              >
                <Icon active={isActive} />
                {label}
                {/* Active underline */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                    style={{ backgroundColor: PALE_YELLOW, boxShadow: '0 0 6px rgba(240,223,160,0.6)' }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* ── Page content ────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto pb-20 sm:pb-0">
        {children}
      </main>

      {/* ── Mobile bottom nav — hidden on sm+ ───────────────────── */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 flex border-t z-40"
        style={{
          backgroundColor: '#111e2b',
          borderTopColor: COPPER_BORDER,
        }}
      >
        {TABS.map(({ path, label, Icon }) => {
          const isActive = activeTab === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex-1 relative flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors"
              style={{ color: isActive ? PALE_YELLOW : 'rgba(255,255,255,0.35)' }}
            >
              <Icon active={isActive} />
              <span className="text-[10px] font-medium leading-none">{label}</span>
              {isActive && (
                <span
                  className="absolute top-0 h-[2px] w-8 rounded-full"
                  style={{ backgroundColor: PALE_YELLOW }}
                />
              )}
            </button>
          );
        })}
      </nav>

    </div>
  );
}
