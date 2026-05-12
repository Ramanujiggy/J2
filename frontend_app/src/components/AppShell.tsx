import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useProfile } from '../context/ProfileContext.tsx';
import WaveBackground from './WaveBackground.tsx';
import BeltBar, { type BeltRank, BELT_COLORS, PATCH_COLORS } from './BeltBar.tsx';
import { PAGE_BG, PALE_YELLOW, GLOW_TITLE, GLOW_NAV, COPPER_BORDER, CARD_BG } from '../lib/theme.ts';
import PageTransition from './PageTransition.tsx';
import OfflineBanner from './OfflineBanner.tsx';
import { useOnlineSync } from '../hooks/useOnlineSync.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.ts';
import DesktopAppShell from './DesktopAppShell.tsx';
import LogSessionForm from './LogSessionForm.tsx';
import { toDateString } from '../lib/sessionUtils.ts';

// Preset shape that the bottom-nav FAB / RepRouletteFab can carry over the
// `journada:open-log-form` window event. Mirrors the LogSessionForm
// `default*` prop contract so the modal pre-fills cleanly.
interface LogPresetPayload {
  heading?: string;
  sessionType?: 'drilling' | 'cla';
  subSkillTag?: string;
  constraintName?: string;
}
interface OpenLogFormDetail {
  date?: string;
  preset?: LogPresetPayload | null;
}

// Lucide-style inline SVG icons — heavier line weight + a touch larger than
// before so the bottom nav reads as a confident, set-in-stone control rather
// than a thin utility strip. strokeWidth bumps 1.7→2 inactive, 2.2→2.6 active.
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.6 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}
function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.6 : 2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.6 : 2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
function JournalIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.6 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h7a3 3 0 013 3v13a3 3 0 00-3-3H4z" />
      <path d="M20 4h-7a3 3 0 00-3 3v13a3 3 0 013-3h7z" />
    </svg>
  );
}

// Bottom nav: 4 real tabs + center FAB. Journal replaced Analytics in the
// nav because users reach their sessions much more often than aggregate
// charts. The /analytics route now redirects to /atlas — analytics
// functionality is folded into the Atlas Prism tab.
const ALL_TABS = [
  { path: '/home',        label: 'Home',       Icon: HomeIcon,       intentionsGated: false },
  { path: '/journal',     label: 'Journal',    Icon: JournalIcon,    intentionsGated: false },
  { path: '/calendar',    label: 'Calendar',   Icon: CalendarIcon,   intentionsGated: false },
  { path: '/profile',     label: 'Profile',    Icon: ProfileIcon,    intentionsGated: false },
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
  const activeTab = TABS.find(t => location.pathname.startsWith(t.path))?.path ?? '/home';
  const activeIdx = TABS.findIndex(t => t.path === activeTab);

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
  const [logPreset,  setLogPreset]  = useState<LogPresetPayload | null>(null);

  useBodyScrollLock(logOpen);

  // Listen for the global "open log form" event — any page can dispatch it.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<OpenLogFormDetail>).detail ?? {};
      setLogDate(detail.date ?? toDateString(new Date()));
      setLogPreset(detail.preset ?? null);
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
    setLogPreset(null);
  }, []);

  // ── Desktop sliding tab indicator ──
  const desktopNavRef = useRef<HTMLElement>(null);
  const desktopTabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const hasInitialized = useRef(false);

  const updateIndicator = useCallback(() => {
    const btn = desktopTabRefs.current.get(activeTab);
    const nav = desktopNavRef.current;
    if (!btn || !nav) return;
    const navRect = nav.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setIndicator({ left: btnRect.left - navRect.left, width: btnRect.width });
    hasInitialized.current = true;
  }, [activeTab]);

  useEffect(() => { updateIndicator(); }, [updateIndicator]);

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

        {/* Desktop nav tabs — hidden on mobile — with sliding indicator */}
        <nav ref={desktopNavRef} className="relative z-10 hidden sm:flex px-6 pb-0 gap-1">
          {TABS.map(({ path, label, Icon }) => {
            const isActive = activeTab === path;
            return (
              <button
                key={path}
                ref={el => { if (el) desktopTabRefs.current.set(path, el); }}
                onClick={() => navigate(path)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg relative"
                style={{
                  color: isActive ? PALE_YELLOW : 'rgba(255,255,255,0.4)',
                  textShadow: isActive ? GLOW_NAV : 'none',
                  backgroundColor: isActive ? 'rgba(242,228,168,0.06)' : 'transparent',
                  transition: 'color 0.3s ease, text-shadow 0.3s ease, background-color 0.3s ease',
                }}
              >
                <Icon active={isActive} />
                {label}
              </button>
            );
          })}
          {/* Sliding gold bar indicator */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: indicator.width,
              height: 2,
              borderRadius: 1,
              backgroundColor: PALE_YELLOW,
              boxShadow: '0 0 8px rgba(242,228,168,0.6), 0 0 16px rgba(196,145,95,0.3)',
              transform: `translateX(${indicator.left}px)`,
              transition: hasInitialized.current
                ? 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.3s ease'
                : 'none',
              pointerEvents: 'none',
              willChange: 'transform',
            }}
          />
        </nav>
      </header>

      {/* ── Offline indicator ─────────────────────────────────────── */}
      <OfflineBanner />

      {/* ── Page content ────────────────────────────────────────── */}
      <main
        className="flex-1 overflow-auto sm:pb-0 j2-app-scroll"
        style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px) + 8px)' }}
      >
        <PageTransition>{children}</PageTransition>
      </main>

      {/* ── Mobile bottom nav — hidden on sm+ ────────────────────────
          Taller bar, heavier icons, active pill behind icon, copper
          hairline above the existing border (a "stitched seam") so the
          edge has more presence. */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 flex border-t z-40"
        style={{
          backgroundColor: 'rgba(21,46,34,0.82)',
          backdropFilter: 'saturate(180%) blur(12px)',
          WebkitBackdropFilter: 'saturate(180%) blur(12px)',
          borderTopColor: COPPER_BORDER,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
          paddingTop: 6,
          boxShadow: '0 -10px 28px -10px rgba(0,0,0,0.55)',
        }}
      >
        {/* Stitched-seam hairline above the existing border */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -1,
            left: 0,
            right: 0,
            height: 1,
            background: 'linear-gradient(to right, transparent, rgba(196,145,95,0.35), transparent)',
            pointerEvents: 'none',
          }}
        />
        {/* Sliding top-bar indicator (visual index accounts for the inserted FAB slot) */}
        {(() => {
          const midIdx = Math.floor(TABS.length / 2);
          // If activeTab is at/after the midpoint, its visual slot shifts by 1 (FAB takes midIdx)
          const visualIdx = activeIdx < midIdx ? activeIdx : activeIdx + 1;
          const totalSlots = TABS.length + 1;
          return (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: `${(visualIdx / totalSlots) * 100 + 50 / totalSlots - 2}%`,
                width: '4%',
                minWidth: 32,
                height: 2.5,
                borderRadius: 1,
                backgroundColor: PALE_YELLOW,
                boxShadow: '0 0 10px rgba(242,228,168,0.65), 0 0 20px rgba(196,145,95,0.35)',
                transition: 'left 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
                pointerEvents: 'none',
              }}
            />
          );
        })()}
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
                    // Open the modal directly — no route flip. The modal
                    // state lives in MobileAppShell now, so it works from
                    // any page without redirecting through /home.
                    setLogDate(toDateString(new Date()));
                    setLogPreset(null);
                    setLogOpen(true);
                  }}
                  className="flex-1 flex items-center justify-center"
                  aria-label="Log a training session"
                  style={{ padding: '6px 0', background: 'transparent', border: 'none' }}
                >
                  {/* Real-button FAB: vertical gradient dome, pale-yellow inner
                      ring, layered outer shadows (copper halo + directional
                      drop + warm ambient), lucide Plus icon (no anemic text "+"),
                      press feedback via .j2-fab-log. */}
                  <span
                    className="j2-fab-log"
                    style={{
                      width: 56, height: 56, borderRadius: '50%',
                      background: 'linear-gradient(180deg, #E8893A 0%, #C46E1E 55%, #B95E18 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginTop: -20,
                      cursor: 'pointer',
                      // Outer (drop + halo + ambient) and inner (top highlight + bottom shadow) shadows
                      boxShadow: [
                        '0 12px 28px -10px rgba(218,116,34,0.70)',           // directional drop
                        '0 0 0 1.5px rgba(242,228,168,0.32)',                // pale-yellow inner ring
                        '0 0 0 4px rgba(218,116,34,0.14)',                   // soft copper halo
                        '0 0 32px rgba(242,228,168,0.14)',                   // warm ambient
                        'inset 0 1px 0 rgba(255,255,255,0.22)',              // top highlight (light hits dome)
                        'inset 0 -3px 6px rgba(74,30,4,0.30)',               // bottom inner shadow (dome bottom)
                      ].join(', '),
                    }}
                  >
                    <Plus
                      size={22}
                      strokeWidth={2.75}
                      color={PALE_YELLOW}
                      style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.25))' }}
                    />
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
                className="flex-1 relative flex flex-col items-center justify-center gap-1"
                style={{
                  paddingTop: 10, paddingBottom: 6,
                  color: isActive ? PALE_YELLOW : 'rgba(255,255,255,0.40)',
                  transition: 'color 0.3s ease',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {/* Icon container with active pill behind it. The pill ties the
                    icon to its name and gives the active state more weight than
                    a bare color change. */}
                <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 32 }}>
                  {isActive && (
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 10,
                        background: 'rgba(242,228,168,0.08)',
                        boxShadow: 'inset 0 0 0 1px rgba(242,228,168,0.10)',
                      }}
                    />
                  )}
                  <span style={{ position: 'relative', textShadow: isActive ? GLOW_NAV : 'none' }}>
                    <Icon active={isActive} />
                  </span>
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: isActive ? 600 : 500,
                    letterSpacing: '0.04em',
                    lineHeight: 1,
                    textShadow: isActive ? GLOW_NAV : 'none',
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
          >
            <LogSessionForm
              onSuccess={() => {
                closeLogModal();
                // Notify any page that needs to refetch (PathAhead stats,
                // Atlas filtered sessions, Calendar heatmap, etc.).
                window.dispatchEvent(new Event('journada:log-session-saved'));
              }}
              onCancel={closeLogModal}
              defaultDate={logDate ?? undefined}
              defaultHeading={logPreset?.heading}
              defaultSessionType={logPreset?.sessionType}
              defaultSubSkillTag={logPreset?.subSkillTag}
              defaultConstraintName={logPreset?.constraintName}
            />
          </div>
        </div>
      )}

    </div>
    </>
  );
}
