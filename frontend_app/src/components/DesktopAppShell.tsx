// Desktop app shell — rail nav layout, rendered at >= 1024px only.
// Replaces the header + horizontal tabs + mobile bottom nav with a single
// sticky left rail (wordmark, nav, focus card, practitioner pill) beside a
// flex-1 content canvas. See desktop redesign plan, Phase 2.

import { useCallback, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.tsx';
import { useActiveIntention } from '../context/ActiveIntentionContext.tsx';
import BeltBar from './BeltBar.tsx';
import RailAmbient from './RailAmbient.tsx';
import OfflineBanner from './OfflineBanner.tsx';
import PageTransition from './PageTransition.tsx';
import { useOnlineSync } from '../hooks/useOnlineSync.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import { toDateString, addDays } from '../lib/sessionUtils.ts';
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

// ─── Nav definition ──────────────────────────────────────────────────────────
// Labels here are the Phase 2 starting set. Rename lands in later phases
// (Calendar → Atlas in Phase 4, Analytics folds into Atlas at the same time).

type NavItem = {
  path: string;
  label: string;
  Icon: (p: IconProps) => JSX.Element;
  gated?: 'intentions';
};

// Atlas absorbs what used to be Calendar + Analytics on desktop. The old
// /calendar and /analytics routes still exist so mobile nav + direct URLs
// continue to work, but the desktop rail is a single Atlas entry.
const NAV_ITEMS: readonly NavItem[] = [
  { path: '/home',       label: 'Path Ahead', Icon: CompassIcon },
  { path: '/journal',    label: 'Journal',    Icon: BookIcon },
  { path: '/atlas',      label: 'Atlas',      Icon: MapIcon },
  { path: '/intentions', label: 'Intentions', Icon: DiamondIcon, gated: 'intentions' },
  { path: '/profile',    label: 'Profile',    Icon: UserIcon },
] as const;

// ─── Shell ───────────────────────────────────────────────────────────────────

interface Props { children: React.ReactNode; }

export default function DesktopAppShell({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { name, beltRank, stripes, intentionsEnabled } = useProfile();
  const { activeIntention } = useActiveIntention();

  useOnlineSync();

  // Days remaining on the active intention (inclusive). Null when no intention.
  const daysRemaining = useMemo(() => {
    if (!activeIntention) return null;
    const start = activeIntention.week_start.slice(0, 10);
    const end = addDays(start, (activeIntention.duration_days ?? 7) - 1);
    const todayStr = toDateString(new Date());
    const diff = Math.max(0, Math.round(
      (new Date(end + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86_400_000
    ));
    return diff; // 0 means "ends today"
  }, [activeIntention]);

  const focusLabel = useMemo(() => {
    if (!activeIntention) return null;
    if (activeIntention.heading) {
      return SKILL_TAGS.find(t => t.value === activeIntention.heading)?.label ?? activeIntention.heading;
    }
    return activeIntention.intent_label || 'Focus';
  }, [activeIntention]);

  const items = useMemo(
    () => NAV_ITEMS.filter(it => it.gated !== 'intentions' || intentionsEnabled),
    [intentionsEnabled],
  );
  const activeTab = items.find(it => location.pathname.startsWith(it.path))?.path ?? '/home';
  const activeIdx = items.findIndex(it => it.path === activeTab);

  // Directional page transitions, matching mobile behaviour
  const [navDirection, setNavDirection] = useState<'forward' | 'back' | null>(null);
  const prevIdxRef = useRef(activeIdx);

  const go = useCallback((path: string) => {
    const fromIdx = prevIdxRef.current;
    const toIdx   = items.findIndex(it => it.path === path);
    setNavDirection(toIdx > fromIdx ? 'forward' : 'back');
    prevIdxRef.current = toIdx;
    navigate(path);
  }, [items, navigate]);

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

        {/* Focus card — reads activeIntention from ActiveIntentionContext.
            Hidden when intentions feature is gated off so the rail doesn't
            advertise a destination the user can't reach. */}
        {intentionsEnabled && (
        <div
          style={{
            padding: 20,
            border: '1px solid rgba(196,145,95,0.22)',
            borderRadius: 14,
            background: 'rgba(196,145,95,0.04)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(circle at 100% 0%, rgba(242,228,168,0.08), transparent 60%)',
              pointerEvents: 'none',
            }}
          />
          <div className="j2-label-copper" style={{ marginBottom: 10 }}>◇ This week</div>
          {activeIntention && focusLabel ? (
            <>
              <div className="j2-serif-display" style={{ fontSize: 28, lineHeight: 1.1 }}>
                {focusLabel}
              </div>
              {activeIntention.intent_label
                && activeIntention.intent_label.trim().toLowerCase() !== focusLabel.toLowerCase() && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 14,
                    color: 'rgba(255,255,255,0.60)',
                    fontStyle: 'italic',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {activeIntention.intent_label}
                </div>
              )}
              {daysRemaining !== null && (
                <div
                  style={{
                    marginTop: 14,
                    fontSize: 12.5, letterSpacing: '0.14em',
                    textTransform: 'uppercase', fontWeight: 700,
                    color: 'rgba(255,255,255,0.40)',
                  }}
                >
                  {daysRemaining === 0 ? 'Ends today' : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`}
                </div>
              )}
              <button
                onClick={() => go('/intentions')}
                style={{
                  marginTop: 14, fontSize: 14, fontWeight: 600,
                  color: COPPER, borderBottom: `1px solid ${COPPER}40`,
                  cursor: 'pointer', background: 'transparent',
                  padding: 0,
                }}
              >
                View Intentions →
              </button>
            </>
          ) : (
            <>
              <div className="j2-serif-display" style={{ fontSize: 26, lineHeight: 1.1 }}>
                Set your focus
              </div>
              <button
                onClick={() => go('/intentions')}
                style={{
                  marginTop: 14, fontSize: 14, fontWeight: 600,
                  color: COPPER, borderBottom: `1px solid ${COPPER}40`,
                  cursor: 'pointer', background: 'transparent',
                  padding: 0,
                }}
              >
                Open Intentions →
              </button>
            </>
          )}
        </div>
        )}

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
        <PageTransition direction={navDirection}>{children}</PageTransition>
      </main>
    </div>
  );
}
