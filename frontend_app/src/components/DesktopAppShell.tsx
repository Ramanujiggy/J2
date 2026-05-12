// Desktop app shell — rail nav layout, rendered at >= 1024px only.
// Replaces the header + horizontal tabs + mobile bottom nav with a single
// sticky left rail (wordmark, nav, focus card, practitioner pill) beside a
// flex-1 content canvas. See desktop redesign plan, Phase 2.

import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.tsx';
import BeltBar from './BeltBar.tsx';
import RailAmbient from './RailAmbient.tsx';
import OfflineBanner from './OfflineBanner.tsx';
import PageTransition from './PageTransition.tsx';
import { useOnlineSync } from '../hooks/useOnlineSync.ts';
import { PAGE_BG, PALE_YELLOW, COPPER } from '../lib/theme.ts';

// ─── Icons (inline SVG, matches AppShell style) ──────────────────────────────

type IconProps = { active: boolean };
const iconAttrs = (active: boolean) => ({
  width: 22, height: 22, viewBox: '0 0 24 24',
  fill: 'none' as const, stroke: 'currentColor',
  strokeWidth: active ? 2 : 1.6,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
});

function CompassIcon({ active }: IconProps) {
  return (
    <svg {...iconAttrs(active)}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="16,8 10,10 8,16 14,14" />
    </svg>
  );
}
function BookIcon({ active }: IconProps) {
  return (
    <svg {...iconAttrs(active)}>
      <path d="M4 4h7a3 3 0 013 3v13a3 3 0 00-3-3H4z" />
      <path d="M20 4h-7a3 3 0 00-3 3v13a3 3 0 013-3h7z" />
    </svg>
  );
}
function MapIcon({ active }: IconProps) {
  return (
    <svg {...iconAttrs(active)}>
      <polygon points="3,7 9,4 15,7 21,4 21,17 15,20 9,17 3,20" />
      <line x1="9" y1="4" x2="9" y2="17" />
      <line x1="15" y1="7" x2="15" y2="20" />
    </svg>
  );
}
function DiamondIcon({ active }: IconProps) {
  return (
    <svg {...iconAttrs(active)}>
      <polygon points="12,3 21,12 12,21 3,12" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}
function UserIcon({ active }: IconProps) {
  return (
    <svg {...iconAttrs(active)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function ShieldIcon({ active }: IconProps) {
  return (
    <svg {...iconAttrs(active)}>
      <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3z" />
    </svg>
  );
}

// ─── Nav definition ──────────────────────────────────────────────────────────
// Labels here are the Phase 2 starting set. Rename lands in later phases
// (Calendar → Atlas in Phase 4, Analytics folds into Atlas at the same time).

type NavItem = {
  path: string;
  label: string;
  Icon: (p: IconProps) => JSX.Element;
  gated?: 'intentions' | 'admin';
};

// Atlas absorbs what used to be Calendar + Analytics. /calendar still
// exists for the dedicated mobile heatmap view + direct URLs; /analytics
// redirects to /atlas (its functionality is now Atlas's Prism tab).
const NAV_ITEMS: readonly NavItem[] = [
  { path: '/home',       label: 'Path Ahead', Icon: CompassIcon },
  { path: '/journal',    label: 'Journal',    Icon: BookIcon },
  { path: '/atlas',      label: 'Atlas',      Icon: MapIcon },
  { path: '/intentions', label: 'Intentions', Icon: DiamondIcon, gated: 'intentions' },
  { path: '/profile',    label: 'Profile',    Icon: UserIcon },
  // Admin gate (mig 023). Only renders for users with users.is_admin = true.
  // The route /admin needs to appear in NAV_ITEMS for activeTab's prefix
  // match to highlight it correctly when the founder is on the dashboard.
  { path: '/admin',      label: 'Admin',      Icon: ShieldIcon, gated: 'admin' },
] as const;

// ─── Shell ───────────────────────────────────────────────────────────────────

interface Props { children: React.ReactNode; }

export default function DesktopAppShell({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { name, beltRank, stripes, intentionsEnabled, isAdmin } = useProfile();

  useOnlineSync();

  const items = useMemo(
    () => NAV_ITEMS.filter(it => {
      if (it.gated === 'intentions') return intentionsEnabled;
      if (it.gated === 'admin')      return isAdmin;
      return true;
    }),
    [intentionsEnabled, isAdmin],
  );
  const activeTab = items.find(it => location.pathname.startsWith(it.path))?.path ?? '/home';

  // PageTransition is now non-directional (single fade-and-settle), so the
  // mobile-matching forward/back state machine that used to live here is
  // gone. Just navigate.
  const go = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  const initials = (name ?? '').split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'J';

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: PAGE_BG,
        display: 'grid',
        gridTemplateColumns: 'var(--rail-w) 1fr',
        position: 'relative',
      }}
    >
      {/* Ambient seigaiha wave background, behind everything */}
      <div className="j2-seigaiha-bg" aria-hidden />

      {/* ── Rail ─────────────────────────────────────────────────── */}
      <aside
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          padding: '40px 28px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
          borderRight: '1px solid var(--j2-border-2)',
          background: 'rgba(10,21,16,0.7)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          zIndex: 1,
          isolation: 'isolate',
        }}
      >
        {/* Ambient layer — subdued onboarding animations behind everything.
            Pentagon-forming motes up top, drifting signature line near the
            bottom. Absolute + pointer-events: none; stacks below all content
            without interfering with nav or focus card interaction. */}
        <RailAmbient />

        {/* Wordmark + tagline */}
        <div>
          <div
            className="j2-wordmark"
            style={{ fontSize: 38, lineHeight: 1 }}
          >
            Journada
          </div>
          <div
            className="j2-label-micro"
            style={{ marginTop: 12, fontSize: 12, letterSpacing: '0.14em' }}
          >
            For intentional grappling
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
          {items.map(({ path, label, Icon }) => {
            const isActive = activeTab === path;
            return (
              <button
                key={path}
                onClick={() => go(path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '14px 16px',
                  borderRadius: 12,
                  background: isActive ? 'rgba(242,228,168,0.06)' : 'transparent',
                  color: isActive ? PALE_YELLOW : 'rgba(255,255,255,0.60)',
                  fontWeight: 500, fontSize: 16,
                  textAlign: 'left',
                  transition: 'color 160ms ease, background-color 160ms ease',
                  position: 'relative',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'rgba(255,255,255,0.90)';
                    e.currentTarget.style.background = 'var(--j2-surface-2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'rgba(255,255,255,0.60)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {isActive && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute', left: -3, top: 9, bottom: 9,
                      width: 3, borderRadius: 2,
                      background: COPPER,
                      boxShadow: '0 0 8px rgba(196,145,95,0.5)',
                    }}
                  />
                )}
                <Icon active={isActive} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Focus card retired from the rail — IntentionHeroCard on the Path
            Ahead page now uses this same chrome and serves as the single
            home for the active intention. Removing it from the rail also
            removes the duplicate copy of the same week-focus message and
            lets the rail breathe more (nav + practitioner pill only). */}

        {/* Practitioner pill — avatar + name + animated belt identity.
            The belt ties on mount (login/refresh), then sits as an ambient
            rank marker. marginTop:auto pins the whole section to the bottom
            of the rail regardless of whether the focus card above is rendered. */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 18,
            borderTop: '1px solid var(--j2-border-1)',
          }}
        >
          {/* Belt ceremony — small, ambient, ties on page load */}
          <div
            style={{
              width: '100%',
              height: 32,
              marginBottom: 14,
              opacity: 0.88,
            }}
            aria-label={`${beltRank ?? 'White'} belt${stripes ? `, ${stripes} stripe${stripes > 1 ? 's' : ''}` : ''}`}
          >
            <BeltBar rank={beltRank} stripes={stripes ?? 0} />
          </div>

          {/* Avatar + name — tappable, routes to profile */}
          <button
            onClick={() => go('/profile')}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              padding: 0,
            }}
          >
            <div
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'linear-gradient(135deg, #244A37, #152E22)',
                border: '1px solid var(--j2-border-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-wordmark)', fontSize: 17,
                color: PALE_YELLOW,
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14, fontWeight: 600,
                  color: 'rgba(255,255,255,0.90)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  lineHeight: 1.2,
                }}
              >
                {name ?? 'Practitioner'}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.38)',
                  letterSpacing: '0.04em',
                  marginTop: 2,
                }}
              >
                {beltRank ? `${beltRank[0]!.toUpperCase()}${beltRank.slice(1)} belt` : 'White belt'}
                {stripes ? ` · ${stripes}` : ''}
              </div>
            </div>
          </button>
        </div>
      </aside>

      {/* ── Main canvas ──────────────────────────────────────────── */}
      <main
        className="j2-app-scroll"
        style={{
          minWidth: 0,
          position: 'relative',
          overflow: 'auto',
          height: '100vh',
          zIndex: 1,
        }}
      >
        <OfflineBanner />
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
