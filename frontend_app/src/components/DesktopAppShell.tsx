// Desktop app shell — the 236px rail beside a scrolling content canvas.
// Rendered at >= 1024px only (AppShell switches on useIsDesktop).
//
// Rail, top to bottom:
//   • Masthead (118px) — seigaiha wave masked to fade downward, wordmark,
//     tagline. The wave is bounded here; the page-wide ambient backdrop is
//     a separate, dimmer layer (.j2-seigaiha-bg).
//   • Nav — Today / Journal / Intentions / Atlas / Profile (+ gated Admin).
//   • Foot — the orange "Log session" CTA over the practitioner chip.
//
// The rail carries no belt animation. Per the 2026-07-31 desktop pass the
// tie-on ceremony belongs to the promotion moment on Profile — an animation
// that plays on every page load stops meaning anything.
//
// The log CTA opens a shell-level modal, so it works from any page. Pages
// dispatch `journada:open-log-form` to reach the same modal (the mobile
// shell listens for the identical event), so no page keeps its own composer.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.tsx';
import RailAmbient from './RailAmbient.tsx';
import OfflineBanner from './OfflineBanner.tsx';
import PageTransition from './PageTransition.tsx';
import CaptureComposer from './composer/CaptureComposer.tsx';
import { useOnlineSync } from '../hooks/useOnlineSync.ts';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.ts';
import { toDateString } from '../lib/sessionUtils.ts';
import { PAGE_BG, PALE_YELLOW, COPPER, BRAND_ORANGE, BRAND_ORANGE_HOVER, TEXT_SECONDARY, TEXT_TERTIARY } from '../lib/theme.ts';
import { isFromProfile } from '../lib/navOrigin.ts';

// ─── Icons ───────────────────────────────────────────────────────────────────
// 18px, 1.7 stroke, line style — the handoff's rail icon set.

const ICON_ATTRS = {
  width: 18, height: 18, viewBox: '0 0 24 24',
  fill: 'none' as const, stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  style: { display: 'block' as const, flexShrink: 0 },
};

function HomeIcon() {
  return <svg {...ICON_ATTRS}><path d="M3 10.5L12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>;
}
function ListIcon() {
  return <svg {...ICON_ATTRS}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>;
}
function TargetIcon() {
  return <svg {...ICON_ATTRS}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>;
}
function MapIcon() {
  return <svg {...ICON_ATTRS}><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></svg>;
}
function UserIcon() {
  return <svg {...ICON_ATTRS}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" /></svg>;
}
function ShieldIcon() {
  return <svg {...ICON_ATTRS}><path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3z" /></svg>;
}
function EditIcon() {
  return <svg {...ICON_ATTRS}><path d="M3 21h4L20 8l-4-4L3 17v4z" /></svg>;
}

// ─── Nav definition ──────────────────────────────────────────────────────────

type NavItem = {
  path: string;
  label: string;
  Icon: () => JSX.Element;
  gated?: 'intentions' | 'admin';
  /** Extra path prefixes that highlight this item — sub-surfaces that aren't
   *  nav targets themselves. Notes and the Technique Library sit under
   *  Journal; Calendar is one of Atlas's own destinations. */
  alsoActiveOn?: readonly string[];
};

// Home is labelled "Today": the page is what happened and what's next, not a
// plan. Atlas keeps Years / Library / Calendar as its own header links, so
// those routes highlight Atlas from the rail.
const NAV_ITEMS: readonly NavItem[] = [
  { path: '/home',       label: 'Today',      Icon: HomeIcon },
  { path: '/journal',    label: 'Journal',    Icon: ListIcon, alsoActiveOn: ['/notes', '/library', '/techniques'] },
  { path: '/intentions', label: 'Intentions', Icon: TargetIcon, gated: 'intentions' },
  { path: '/atlas',      label: 'Atlas',      Icon: MapIcon, alsoActiveOn: ['/calendar'] },
  { path: '/profile',    label: 'Profile',    Icon: UserIcon },
  // Admin gate (mig 023) — only renders for users.is_admin.
  { path: '/admin',      label: 'Admin',      Icon: ShieldIcon, gated: 'admin' },
] as const;

const RAIL_BORDER   = '1px solid rgba(255,255,255,0.06)';

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
  const routeTab = items.find(it =>
    location.pathname.startsWith(it.path) ||
    it.alsoActiveOn?.some(p => location.pathname.startsWith(p))
  )?.path ?? '/home';
  // Library / technique pages opened from Profile behave as a Profile
  // sub-menu (see lib/navOrigin.ts), so keep the Profile tab lit.
  const activeTab = isFromProfile(location.state)
    && (location.pathname.startsWith('/library') || location.pathname.startsWith('/techniques'))
    ? '/profile'
    : routeTab;

  const go = useCallback((path: string) => { navigate(path); }, [navigate]);

  const initials = (name ?? '').split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'J';
  const beltLabel = beltRank
    ? `${beltRank[0]!.toUpperCase()}${beltRank.slice(1)} belt${stripes ? ` · ${stripes}` : ''}`
    : 'White belt';

  // ── Shell-level log modal ────────────────────────────────────────────
  // Mirrors MobileAppShell: the composer lives in the shell so the rail CTA
  // (and any page dispatching `journada:open-log-form`) reaches it without a
  // route detour or a second copy of the form.
  const [logOpen, setLogOpen] = useState(false);
  const [logDate, setLogDate] = useState<string | null>(null);

  useBodyScrollLock(logOpen);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ date?: string }>).detail ?? {};
      setLogDate(detail.date ?? toDateString(new Date()));
      setLogOpen(true);
    };
    window.addEventListener('journada:open-log-form', handler);
    return () => window.removeEventListener('journada:open-log-form', handler);
  }, []);

  // Tell other surfaces (RepRouletteFab) when the modal is up.
  useEffect(() => {
    window.dispatchEvent(new Event(logOpen ? 'journada:log-form-open' : 'journada:log-form-closed'));
  }, [logOpen]);

  const closeLog = useCallback(() => { setLogOpen(false); setLogDate(null); }, []);

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
      {/* Ambient seigaiha backdrop, behind everything */}
      <div className="j2-seigaiha-bg" aria-hidden />

      {/* ── Rail ─────────────────────────────────────────────────── */}
      <aside
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          borderRight: RAIL_BORDER,
          background: 'rgba(10,21,16,0.7)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          zIndex: 1,
          isolation: 'isolate',
        }}
      >
        {/* Masthead — wave, wordmark, tagline */}
        <div style={{ height: 118, position: 'relative', overflow: 'hidden', flex: 'none' }}>
          <div className="j2-rail-wave" aria-hidden />
          <RailAmbient />
          <div className="j2-wordmark" style={{ position: 'absolute', left: 24, top: 26, fontSize: 27 }}>
            Journada
          </div>
          <div
            style={{
              position: 'absolute', left: 24, top: 64,
              fontSize: 9.5, fontWeight: 700,
              letterSpacing: '0.16em', textTransform: 'uppercase',
              color: TEXT_TERTIARY,
            }}
          >
            For intentional grappling
          </div>
        </div>

        {/* Nav — 44px rows. The tinted pill is the entire active treatment;
            no underline, no left bar, no glow. */}
        <nav style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map(({ path, label, Icon }) => {
            const isActive = activeTab === path;
            return (
              <button
                key={path}
                onClick={() => go(path)}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  height: 44, padding: '0 12px',
                  borderRadius: 10,
                  background: isActive ? 'rgba(242,228,168,0.07)' : 'transparent',
                  border: 'none',
                  color: isActive ? PALE_YELLOW : TEXT_TERTIARY,
                  fontSize: 13.5, fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'color 160ms ease, background 160ms ease',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = TEXT_SECONDARY; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = TEXT_TERTIARY; }}
              >
                <Icon />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Foot — the one orange act in the chrome, over the practitioner chip */}
        <div style={{ marginTop: 'auto', padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <button
            onClick={() => { setLogDate(toDateString(new Date())); setLogOpen(true); }}
            style={{
              height: 44, padding: '0 18px', borderRadius: 11,
              background: BRAND_ORANGE, color: '#fff',
              fontWeight: 600, fontSize: 14,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              whiteSpace: 'nowrap', cursor: 'pointer', border: 'none',
              transition: 'background 180ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = BRAND_ORANGE_HOVER; }}
            onMouseLeave={e => { e.currentTarget.style.background = BRAND_ORANGE; }}
          >
            <EditIcon />
            Log session
          </button>

          <button
            onClick={() => go('/profile')}
            style={{
              display: 'flex', alignItems: 'center', gap: 11,
              paddingTop: 16, borderTop: RAIL_BORDER,
              background: 'transparent', border: 'none',
              textAlign: 'left', width: '100%', cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 36, height: 36, borderRadius: '50%',
                border: '1px solid rgba(196,145,95,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: COPPER, flex: 'none',
              }}
            >
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13, fontWeight: 600, color: TEXT_SECONDARY,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {name ?? 'Practitioner'}
              </div>
              <div style={{ fontSize: 10.5, color: TEXT_TERTIARY, marginTop: 1 }}>
                {beltLabel}
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

      {/* ── Shell-level log modal ────────────────────────────────── */}
      {logOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Log session"
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto px-5 animate-j2-backdrop-in"
          style={{
            backgroundColor: 'rgba(13, 26, 20, 1)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            paddingTop: 24,
            paddingBottom: 56,
          }}
          onClick={closeLog}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full lg:max-w-5xl animate-j2-modal-in"
            style={{ margin: 'auto 0' }}
          >
            <CaptureComposer
              onSuccess={() => {
                closeLog();
                window.dispatchEvent(new Event('journada:log-session-saved'));
              }}
              onCancel={closeLog}
              defaultDate={logDate ?? undefined}
            />
          </div>
        </div>
      )}
    </div>
  );
}
