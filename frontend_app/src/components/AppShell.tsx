import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useProfile } from '../context/ProfileContext.tsx';
import SeigaihaPattern from './visuals/SeigaihaPattern.tsx';
import BeltBar, { type BeltRank, BELT_COLORS, PATCH_COLORS } from './BeltBar.tsx';
import { PAGE_BG, PALE_YELLOW, GLOW_TITLE, BRAND_ORANGE, TEXT_TERTIARY } from '../lib/theme.ts';
import { isFromProfile } from '../lib/navOrigin.ts';
import PageTransition from './PageTransition.tsx';
import OfflineBanner from './OfflineBanner.tsx';
import { useOnlineSync } from '../hooks/useOnlineSync.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.ts';
import DesktopAppShell from './DesktopAppShell.tsx';
import CaptureComposer from './composer/CaptureComposer.tsx';
import { toDateString } from '../lib/sessionUtils.ts';

// Detail for the `journada:open-log-form` window event — any page can dispatch
// it to open the capture modal (optionally on a specific date).
interface OpenLogFormDetail {
  date?: string;
}

// Bottom-nav icons. Size 20, stroke 2 active / 1.6 idle per the handoff's
// tab-bar spec. The previous 22px/2.6 weights read as an app-store toolbar;
// the lighter line lets the active state be carried by colour and the pill
// behind the icon rather than by heft.
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}
function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
function JournalIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h7a3 3 0 013 3v13a3 3 0 00-3-3H4z" />
      <path d="M20 4h-7a3 3 0 00-3 3v13a3 3 0 013-3h7z" />
    </svg>
  );
}

// Bottom nav: 4 real tabs + center FAB. Journal replaced Analytics in the
// nav because users reach their sessions much more often than aggregate
// charts. The /analytics route now redirects to /atlas — analytics
// functionality is folded into the Atlas Prism tab.
// `alsoActiveOn` covers sub-surfaces that aren't themselves nav targets:
// Notes lives under Journal, Technique Library under Profile. Without
// these prefixes the active-tab match falls through to `/home`.
// /intentions and /atlas have no bottom-nav tab on mobile and fall
// through to /home by design (they're side trips from Home).
const ALL_TABS = [
  { path: '/home',        label: 'Home',       Icon: HomeIcon,       intentionsGated: false, alsoActiveOn: [] as readonly string[] },
  { path: '/journal',     label: 'Journal',    Icon: JournalIcon,    intentionsGated: false, alsoActiveOn: ['/notes', '/library', '/techniques'] as readonly string[] },
  { path: '/calendar',    label: 'Calendar',   Icon: CalendarIcon,   intentionsGated: false, alsoActiveOn: [] as readonly string[] },
  { path: '/profile',     label: 'Profile',    Icon: ProfileIcon,    intentionsGated: false, alsoActiveOn: [] as readonly string[] },
] as const;

function beltThumbGradient(beltColor: string, patchColor: string, stripes: number): string {
  const patchPct = 24;
  const beltPct  = 100 - patchPct;
  const stripeLines = Array.from({ length: stripes }, (_, i) => {
    const pos = beltPct + ((i + 1) / (stripes + 1)) * patchPct;
    return `linear-gradient(to bottom, transparent ${pos}%, rgba(255,255,255,0.55) ${pos}%, rgba(255,255,255,0.55) ${pos + 1.8}%, transparent ${pos + 1.8}%)`;
  });
  const baseBg = `linear-gradient(to bottom, ${beltColor} ${beltPct}%, ${patchColor} ${beltPct}%)`;
  return [...stripeLines, baseBg].join(', ');
}

interface Props {
  children: React.ReactNode;
}

// Top-level switcher: rail shell on desktop (≥1024px), existing mobile/tablet
// shell otherwise. Keeping the two as separate components keeps their hooks
// isolated — rules-of-hooks disallows a conditional early-return inside a
// single component that calls different hook sets on each branch.
export default function AppShell({ children }: Props) {
  const isDesktop = useIsDesktop();
  return isDesktop
    ? <DesktopAppShell>{children}</DesktopAppShell>
    : <MobileAppShell>{children}</MobileAppShell>;
}

function MobileAppShell({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { beltRank, stripes, intentionsEnabled } = useProfile();

  const beltColor  = beltRank ? (BELT_COLORS[beltRank as BeltRank] ?? null) : null;
  const patchColor = beltRank ? (PATCH_COLORS[beltRank as BeltRank] ?? '#0D0D0D') : '#0D0D0D';
  const thumbBg    = beltColor
    ? beltThumbGradient(beltColor, patchColor, stripes ?? 0)
    : 'rgba(255,255,255,0.15)';

  useOnlineSync();

  const TABS = useMemo(
    () => ALL_TABS.filter(t => !t.intentionsGated || intentionsEnabled),
    [intentionsEnabled],
  );
  const routeTab = TABS.find(t =>
    location.pathname.startsWith(t.path) ||
    t.alsoActiveOn?.some(p => location.pathname.startsWith(p))
  )?.path ?? '/home';
  // Library / technique pages opened from Profile behave as a Profile
  // sub-menu (see lib/navOrigin.ts), so keep the Profile tab lit.
  const activeTab = isFromProfile(location.state)
    && (location.pathname.startsWith('/library') || location.pathname.startsWith('/techniques'))
    ? '/profile'
    : routeTab;

  // Page-level horizontal swipe-to-navigate has been retired — it made the
  // app feel light and "swipey" in a way that worked against the leather-
  // bound editorial register. Tap-to-navigate only.

  // ── Global log-session modal ─────────────────────────────────────────
  // Lifted out of PathAheadPage so the bottom-nav `+` FAB can launch the
  // modal directly from any page without redirecting through `/home`.
  // Other pages (e.g. RepRouletteFab on home) dispatch the
  // `journada:open-log-form` event with optional `{ date, preset }` detail.
  const [logOpen,    setLogOpen]    = useState(false);
  const [logDate,    setLogDate]    = useState<string | null>(null);

  useBodyScrollLock(logOpen);

  // Listen for the global "open log form" event — any page can dispatch it.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<OpenLogFormDetail>).detail ?? {};
      setLogDate(detail.date ?? toDateString(new Date()));
      setLogOpen(true);
    };
    window.addEventListener('journada:open-log-form', handler);
    return () => window.removeEventListener('journada:open-log-form', handler);
  }, []);

  // Tell other surfaces (e.g. RepRouletteFab) when the modal opens / closes
  // so they can hide themselves while it's up.
  useEffect(() => {
    window.dispatchEvent(new Event(logOpen ? 'journada:log-form-open' : 'journada:log-form-closed'));
  }, [logOpen]);

  const closeLogModal = useCallback(() => {
    setLogOpen(false);
    setLogDate(null);
  }, []);

  return (
    <>
    <style>{`
      .j2-app-scroll::-webkit-scrollbar { width: 9px; }
      .j2-app-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.18); border-radius: 5px; }
      .j2-app-scroll::-webkit-scrollbar-thumb {
        background: ${thumbBg};
        border-radius: 5px;
        border: 1px solid rgba(0,0,0,0.25);
      }
      .j2-app-scroll::-webkit-scrollbar-thumb:hover { filter: brightness(1.12); }
    `}</style>
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: PAGE_BG }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header
        className="border-b relative overflow-hidden flex-shrink-0"
        style={{
          borderBottomColor: 'transparent',
          borderImage: 'linear-gradient(to right, transparent, rgba(196,145,95,0.5), transparent) 1',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          backgroundColor: 'rgba(13,26,20,0.82)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        }}
      >
        <SeigaihaPattern tileSize={36} driftSeconds={12.2} fillTileBackground />
        {/* Fade wave into page background */}
        <div
          style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(to bottom, transparent 20%, ${PAGE_BG} 100%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Header top row: logo + logout */}
        <div className="relative z-10 px-6 pt-2 pb-1 flex items-center justify-between">
          <div style={{ position: 'relative' }}>
            {/* Fading shadow behind title + belt only */}
            <div style={{
              position: 'absolute',
              top: '-8px', left: '-14px', right: '-14px', bottom: '-6px',
              background: 'radial-gradient(ellipse at 35% 45%, rgba(30,22,12,0.60) 0%, rgba(13,20,16,0.30) 50%, transparent 78%)',
              pointerEvents: 'none',
            }} />
            <h1
              className="text-xl font-wordmark tracking-tight"
              style={{ position: 'relative', color: PALE_YELLOW, textShadow: GLOW_TITLE }}
            >
              Journada
            </h1>
            <BeltBar rank={beltRank} stripes={stripes} />
          </div>
        </div>

        {/* Tablet nav tabs — hidden on mobile, replaced by the rail on desktop.
            Matches the bottom bar's pill register: champagne-tinted active
            background, no glow, 44px tap target. */}
        <nav className="relative z-10 hidden sm:flex px-6 pb-0 gap-1">
          {TABS.map(({ path, label, Icon }) => {
            const isActive = activeTab === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium relative"
                style={{
                  minHeight: 44,
                  color: isActive ? PALE_YELLOW : TEXT_TERTIARY,
                  backgroundColor: isActive ? 'rgba(242,228,168,0.07)' : 'transparent',
                  borderRadius: 10,
                  transition: 'color 0.3s ease, background-color 0.3s ease',
                }}
              >
                <Icon active={isActive} />
                {label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* ── Offline indicator ─────────────────────────────────────── */}
      <OfflineBanner />

      {/* ── Page content ────────────────────────────────────────── */}
      {/* overflow-x-hidden is a guard, not a layout tool: nothing in the app
          should pan the page sideways, and a single element hanging past the
          right edge (a card peek, a wide chip row) silently turns every
          horizontal drag into a page pan. Components that genuinely scroll
          sideways still do so in their own overflow-x containers. */}
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden sm:pb-0 j2-app-scroll"
        style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px) + 8px)' }}
      >
        <PageTransition>{children}</PageTransition>
      </main>

      {/* ── Mobile bottom nav — hidden on sm+ ────────────────────────
          Quiet and frosted. It sits under the whole app, so it earns nothing
          by competing with the page: one hairline, one active state (champagne
          icon on a champagne-tinted pill), and no glow. The frosted blur is
          back by founder request (JOU-64); the copper stitched seam and
          sliding lit indicator it once carried stay gone — the pill is the
          entire active treatment. */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 flex border-t z-40"
        style={{
          backgroundColor: 'rgba(21,46,34,0.82)',
          backdropFilter: 'saturate(180%) blur(12px)',
          WebkitBackdropFilter: 'saturate(180%) blur(12px)',
          borderTopColor: 'rgba(255,255,255,0.06)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
          paddingTop: 8,
        }}
      >
        {/* Render tabs with + Log FAB inserted at middle index */}
        {(() => {
          const midIdx = Math.floor(TABS.length / 2);
          const elements: React.ReactNode[] = [];
          TABS.forEach((tab, i) => {
            if (i === midIdx) {
              elements.push(
                <button
                  key="fab-log"
                  onClick={() => {
                    // Context-aware: on /notes, dispatch note creation event.
                    // On all other routes, open the log session modal.
                    if (location.pathname === '/notes') {
                      window.dispatchEvent(new Event('journada:open-new-note'));
                      return;
                    }
                    setLogDate(toDateString(new Date()));
                    setLogOpen(true);
                  }}
                  className="flex-1 flex items-center justify-center"
                  aria-label="Log a training session"
                  style={{ padding: '6px 0', background: 'transparent', border: 'none' }}
                >
                  {/* Flat orange ink and one soft drop — orange already means
                      "this is the action", so the dome gradient, champagne
                      ring, copper halo and ambient bloom were four ways of
                      saying it a fifth time. Lifted just enough to read as
                      primary without ballooning out of the bar. */}
                  <span
                    className="j2-fab-log"
                    style={{
                      width: 54, height: 54, borderRadius: '50%',
                      backgroundColor: BRAND_ORANGE,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginTop: -12,
                      cursor: 'pointer',
                      boxShadow: '0 10px 26px -8px rgba(218,116,34,0.80)',
                    }}
                  >
                    <Plus size={22} strokeWidth={2.2} color="#fff" />
                  </span>
                </button>
              );
            }
            const { path, label, Icon } = tab;
            const isActive = activeTab === path;
            elements.push(
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex-1 relative flex flex-col items-center justify-center"
                style={{
                  gap: 5,
                  paddingTop: 4, paddingBottom: 4,
                  // 0.46 is the small-text contrast floor; the old 0.40 sat
                  // under it on this background.
                  color: isActive ? PALE_YELLOW : 'rgba(255,255,255,0.46)',
                  transition: 'color 0.2s ease',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {/* The pill behind the icon is the entire active treatment —
                    it ties the icon to its name without a second accent. */}
                <span
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 34, height: 30, borderRadius: 9,
                    background: isActive ? 'rgba(242,228,168,0.10)' : 'transparent',
                    transition: 'background 0.2s ease',
                  }}
                >
                  <Icon active={isActive} />
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    lineHeight: 1,
                  }}
                >
                  {label}
                </span>
              </button>
            );
          });
          return elements;
        })()}
      </nav>

      {/* ── Global log-session modal ──────────────────────────────────
          Renders here (not in PathAheadPage) so the bottom-nav `+` FAB
          can launch it from any page without a route detour. z-[60]
          puts it definitively above the nav (z-40) and any RepRouletteFab
          (z-50). Backdrop fades in (animate-j2-backdrop-in) and the
          content settles (animate-j2-modal-in). 32px aesthetic padding
          beneath the form gives the bottom edge somewhere to land. */}
      {logOpen && (
        <div
          data-no-page-swipe=""
          role="dialog"
          aria-modal="true"
          aria-label="Log session"
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto px-5 animate-j2-backdrop-in"
          style={{
            backgroundColor: 'rgba(13, 26, 20, 1)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
            paddingBottom: 'calc(max(1rem, env(safe-area-inset-bottom)) + 32px)',
          }}
          onClick={closeLogModal}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-lg lg:max-w-5xl animate-j2-modal-in"
            style={{ margin: 'auto 0' }}
          >
            <CaptureComposer
              onSuccess={() => {
                closeLogModal();
                // Notify any page that needs to refetch (PathAhead stats,
                // Atlas filtered sessions, Calendar heatmap, etc.).
                window.dispatchEvent(new Event('journada:log-session-saved'));
              }}
              onCancel={closeLogModal}
              defaultDate={logDate ?? undefined}
            />
          </div>
        </div>
      )}

    </div>
    </>
  );
}
