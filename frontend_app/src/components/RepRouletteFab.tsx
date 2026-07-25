import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ROULETTE_DRILLS } from '../lib/constants.ts';
import { useCanonicalConstraints } from '../hooks/useCanonicalConstraints.ts';
import { PALE_YELLOW, GLOW_SOFT, COPPER, COPPER_BORDER, SURFACE_3, FONT_EDITORIAL } from '../lib/theme.ts';
import { vibrate } from '../lib/haptics.ts';
import type { Pillar } from '../types/api.ts';

// ── Drill / constraint focus → pillar tag mapping ────────────────────────

const FOCUS_TO_TAG: Record<string, string> = {
  'Guard':          'guard',
  'Stand-up':       'standup',
  'Dynamic Pins':   'pins',
  'Guard Passing':  'passing',
  'Submissions':    'submissions',
  'Guard Retention':'guard',
};

// Pillar → focus label used in the roulette card (mirrors the existing
// drill `focus` field). Cross-pillar constraints (parent_pillar = NULL)
// label as "Cross-Pillar" since the pool no longer ships hand-picked focus
// strings — it's now derived from canonical_constraints.
const PILLAR_TO_FOCUS_LABEL: Record<Pillar, string> = {
  guard:       'Guard',
  passing:     'Guard Passing',
  pins:        'Dynamic Pins',
  submissions: 'Submissions',
  standup:     'Stand-up',
};

// ── Pool persistence (localStorage) ──────────────────────────────────────

type Pool = 'drill' | 'constraint';
const POOL_STORAGE_KEY = 'j2_roulette_pool';

function readStoredPool(): Pool {
  if (typeof window === 'undefined') return 'drill';
  const v = window.localStorage.getItem(POOL_STORAGE_KEY);
  return v === 'constraint' ? 'constraint' : 'drill';
}

// ── Timing constants ─────────────────────────────────────────────────────

const OPEN_MS  = 340;  // FAB → card morph duration
const CLOSE_MS = 280;  // card → FAB reverse morph
const OPEN_CURVE  = 'cubic-bezier(0.16, 1, 0.3, 1)';   // M3 "heavy" ease-out
const CLOSE_CURVE = 'cubic-bezier(0.4, 0, 0.6, 1)';     // smooth ease-in-out

// ── Component ────────────────────────────────────────────────────────────

// onLogPick fires when the user commits to logging from either pool. The
// preset shape mirrors LogSessionForm's `default*` props — the consumer
// (PathAheadPage) routes it into the modal state.
interface LogDrillPreset { pool: 'drill'; heading: string; sessionType: 'drilling'; subSkillTag: string }
interface LogConstraintPreset { pool: 'constraint'; heading?: string; sessionType: 'cla'; constraintName: string }
type LogPickPreset = LogDrillPreset | LogConstraintPreset;

interface Props {
  onLogDrill: (preset: LogPickPreset) => void;
  fabPosition?: 'fixed' | 'inline';
}

type Phase = 'fab' | 'opening' | 'open' | 'closing';

// Outer wrapper — gates rendering on the /home route. Split from the impl
// so the route check can short-circuit BEFORE the impl's hooks run (the
// impl declares ~10 hooks; calling them only sometimes would violate React's
// rules-of-hooks). PageTransition holds the previous page's tree in the DOM
// for ~200ms during route exit, which leaks the FAB onto other pages briefly;
// gating here on `location.pathname` makes it disappear the instant the route
// flips away.
//
// Also hidden while the global log-session modal is open (MobileAppShell
// dispatches `journada:log-form-open` / `journada:log-form-closed` window
// events). Without this, the FAB peeks above the modal's z-[60] backdrop
// from below — visually wrong and user-flagged.
export default function RepRouletteFab(props: Props) {
  const location = useLocation();
  const [logModalOpen, setLogModalOpen] = useState(false);
  useEffect(() => {
    const onOpen  = () => setLogModalOpen(true);
    const onClose = () => setLogModalOpen(false);
    window.addEventListener('journada:log-form-open', onOpen);
    window.addEventListener('journada:log-form-closed', onClose);
    return () => {
      window.removeEventListener('journada:log-form-open', onOpen);
      window.removeEventListener('journada:log-form-closed', onClose);
    };
  }, []);
  if (location.pathname !== '/home') return null;
  if (logModalOpen) return null;
  return <RepRouletteFabImpl {...props} />;
}

function buildTickerCandidates(
  poolItems: readonly { name: string }[],
  finalIndex: number,
): string[] {
  const finalName = poolItems[finalIndex].name;
  const candidates: string[] = [];
  const poolLen = poolItems.length;
  if (poolLen <= 1) return [];
  const maxAttempts = poolLen * 3;
  let attempts = 0;
  while (candidates.length < Math.min(5, poolLen - 1) && attempts < maxAttempts) {
    const idx = Math.floor(Math.random() * poolLen);
    const name = poolItems[idx].name;
    if (name !== finalName && !candidates.includes(name)) candidates.push(name);
    attempts++;
  }
  return candidates;
}

function runTickerReel(
  candidates: string[],
  onTick: (name: string) => void,
  onLand: () => void,
) {
  const intervals = [50, 70, 100, 140, 180];
  if (candidates.length === 0) { onLand(); return; }
  let i = 0;
  function tick() {
    if (i < candidates.length) {
      onTick(candidates[i]);
      vibrate(3);
      setTimeout(tick, intervals[i] ?? 180);
      i++;
    } else {
      onLand();
    }
  }
  tick();
}

function RepRouletteFabImpl({ onLogDrill, fabPosition = 'fixed' }: Props) {
  const [phase, setPhase] = useState<Phase>('fab');

  // Pool toggle — drill (existing) or constraint (CLA prompt). Persisted to
  // localStorage so the user picks once and the FAB remembers. Default is
  // `drill` so existing users see no behavioral change until they discover it.
  const [pool, setPool] = useState<Pool>(readStoredPool);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(POOL_STORAGE_KEY, pool);
    }
  }, [pool]);

  // Constraints pool — derived from canonical_constraints filtered by
  // details.roulette_eligible. Single source of truth: the same DB rows
  // feed the ConstraintPicker on the log form. Card shape is { name,
  // focus, suggestion, description } so it slots into the existing render
  // path without further refactor.
  const { constraints: allCanonicalConstraints } = useCanonicalConstraints();
  const rouletteConstraints = useMemo(() => {
    return allCanonicalConstraints
      .filter(c => c.details?.roulette_eligible)
      .map(c => ({
        name: c.name,
        focus: c.parent_pillar ? PILLAR_TO_FOCUS_LABEL[c.parent_pillar] : 'Cross-Pillar',
        suggestion: c.details?.duration_minutes
          ? `${c.details.duration_minutes}-min round`
          : 'Live round',
        description: c.description ?? c.details?.full_label ?? '',
      }));
  }, [allCanonicalConstraints]);

  // Independent history per pool — switching pools doesn't lose your place.
  const [drillHistory, setDrillHistory] = useState<number[]>(
    () => [Math.floor(Math.random() * ROULETTE_DRILLS.length)]
  );
  const [drillHistoryIndex, setDrillHistoryIndex] = useState(0);
  const [constraintHistory, setConstraintHistory] = useState<number[]>([]);
  const [constraintHistoryIndex, setConstraintHistoryIndex] = useState(0);

  // Seed the constraint history on first arrival of the API data — the
  // hook returns [] before the fetch resolves, then populates. Without this,
  // a user opening the FAB on a cold cache would land on no constraint.
  useEffect(() => {
    if (rouletteConstraints.length > 0 && constraintHistory.length === 0) {
      setConstraintHistory([Math.floor(Math.random() * rouletteConstraints.length)]);
    }
  }, [rouletteConstraints.length, constraintHistory.length]);

  // Swipe state
  const touchStartX    = useRef(0);
  const touchStartY    = useRef(0);
  const touchStartTime = useRef(0);
  const isHorizontal   = useRef<boolean | null>(null);
  const rafRef         = useRef<number | undefined>(undefined);
  const [dragX, setDragX]           = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const [spinning, setSpinning] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [landed, setLanded] = useState(false);
  const [tickerCandidates, setTickerCandidates] = useState<string[]>([]);

  // Active item from the active pool.
  const drill = ROULETTE_DRILLS[drillHistory[drillHistoryIndex]];
  const constraint = rouletteConstraints.length > 0 && constraintHistory.length > 0
    ? rouletteConstraints[constraintHistory[constraintHistoryIndex] % rouletteConstraints.length]
    : null;
  const item = pool === 'drill' ? drill : constraint;

  // ── Phase transitions ──────────────────────────────────────────────

  const handleOpen = useCallback(() => {
    vibrate(10);
    setPhase('opening');
    setTimeout(() => setPhase('open'), OPEN_MS);
  }, []);

  const handleClose = useCallback(() => {
    setPhase('closing');
    setTimeout(() => setPhase('fab'), CLOSE_MS);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (phase !== 'open' && phase !== 'opening') return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, handleClose]);

  // ── Swipe handlers ─────────────────────────────────────────────────

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current    = e.touches[0].clientX;
    touchStartY.current    = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    isHorizontal.current   = null;
    setIsDragging(true);
  }, []);

  // Active-pool helpers — the swipe + history machinery branches on `pool`
  // so each pool keeps its own cursor; switching pools mid-session preserves
  // both stacks.
  const activeIndex = pool === 'drill' ? drillHistoryIndex : constraintHistoryIndex;
  const activeHistory = pool === 'drill' ? drillHistory : constraintHistory;
  const activePoolLength = pool === 'drill' ? ROULETTE_DRILLS.length : rouletteConstraints.length;

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const rawDx = e.touches[0].clientX - touchStartX.current;
    const dy    = e.touches[0].clientY - touchStartY.current;

    if (isHorizontal.current === null) {
      if (Math.abs(rawDx) > 8 || Math.abs(dy) > 8) {
        isHorizontal.current = Math.abs(rawDx) > Math.abs(dy);
      }
      return;
    }
    if (!isHorizontal.current) return;

    let dx = rawDx;
    if (activeIndex === 0 && rawDx > 0) {
      dx = rawDx * 0.3;
    }

    if (rafRef.current !== undefined) return;
    rafRef.current = requestAnimationFrame(() => {
      setDragX(dx);
      rafRef.current = undefined;
    });
  }, [activeIndex]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (rafRef.current !== undefined) { cancelAnimationFrame(rafRef.current); rafRef.current = undefined; }
    const dx  = e.changedTouches[0].clientX - touchStartX.current;
    const dt  = Date.now() - touchStartTime.current;
    const vel = Math.abs(dx) / Math.max(dt, 1);
    if ((Math.abs(dx) > 45 || vel > 0.35) && activePoolLength > 0) {
      if (dx < 0) {
        if (spinning) { setDragX(0); setIsDragging(false); return; }
        const current = activeHistory[activeIndex];
        const next = (current + 1 + Math.floor(Math.random() * Math.max(1, activePoolLength - 1))) % activePoolLength;
        const currentPool = pool === 'drill' ? ROULETTE_DRILLS : rouletteConstraints;
        const candidates = buildTickerCandidates(currentPool as readonly { name: string }[], next);
        setTickerCandidates(candidates);
        setSpinning(true);
        setLanded(false);
        runTickerReel(
          candidates,
          (name) => setDisplayName(name),
          () => {
            if (pool === 'drill') {
              setDrillHistory(prev => [...prev.slice(0, drillHistoryIndex + 1), next]);
              setDrillHistoryIndex(i => i + 1);
            } else {
              setConstraintHistory(prev => [...prev.slice(0, constraintHistoryIndex + 1), next]);
              setConstraintHistoryIndex(i => i + 1);
            }
            setDisplayName(null);
            setSpinning(false);
            setTickerCandidates([]);
            setLanded(true);
            vibrate(10);
            setTimeout(() => setLanded(false), 350);
          },
        );
      } else {
        if (pool === 'drill') setDrillHistoryIndex(i => Math.max(0, i - 1));
        else setConstraintHistoryIndex(i => Math.max(0, i - 1));
      }
    }
    setDragX(0);
    setIsDragging(false);
  }, [spinning, pool, activeHistory, activeIndex, activePoolLength, drillHistoryIndex, constraintHistoryIndex, rouletteConstraints]);

  const handleReroll = useCallback(() => {
    if (spinning) return;
    vibrate(5);
    if (activePoolLength <= 0) return;
    const currentPool = pool === 'drill' ? ROULETTE_DRILLS : rouletteConstraints;
    const current = activeHistory[activeIndex] ?? 0;
    const next = (current + 1 + Math.floor(Math.random() * Math.max(1, activePoolLength - 1))) % activePoolLength;
    const candidates = buildTickerCandidates(currentPool as readonly { name: string }[], next);
    setTickerCandidates(candidates);
    setSpinning(true);
    setLanded(false);
    runTickerReel(
      candidates,
      (name) => setDisplayName(name),
      () => {
        if (pool === 'drill') {
          setDrillHistory(prev => [...prev.slice(0, drillHistoryIndex + 1), next]);
          setDrillHistoryIndex(i => i + 1);
        } else {
          setConstraintHistory(prev => [...prev.slice(0, constraintHistoryIndex + 1), next]);
          setConstraintHistoryIndex(i => i + 1);
        }
        setDisplayName(null);
        setSpinning(false);
        setTickerCandidates([]);
        setLanded(true);
        vibrate(10);
        setTimeout(() => setLanded(false), 350);
      },
    );
  }, [spinning, pool, activeHistory, activeIndex, activePoolLength, drillHistoryIndex, constraintHistoryIndex, rouletteConstraints]);

  const handleLog = () => {
    if (pool === 'drill') {
      onLogDrill({
        pool: 'drill',
        heading:     FOCUS_TO_TAG[drill.focus],
        sessionType: 'drilling',
        subSkillTag: drill.name,
      });
    } else if (constraint) {
      onLogDrill({
        pool: 'constraint',
        heading: constraint.focus ? FOCUS_TO_TAG[constraint.focus] : undefined,
        sessionType: 'cla',
        constraintName: constraint.name,
      });
    }
    handleClose();
  };

  // ── Derived state ──────────────────────────────────────────────────

  const showCard = phase !== 'fab';
  const cardVisible = phase === 'open' || phase === 'opening';
  const fabVisible = phase === 'fab';
  const fabBottom = 'calc(5rem + env(safe-area-inset-bottom, 0px) + 16px)';

  // ── Render ─────────────────────────────────────────────────────────

  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // GSAP morph for inline expand/collapse
  useEffect(() => {
    if (fabPosition !== 'inline') return;
    const panel = panelRef.current;
    const content = contentRef.current;
    if (!panel || !content) return;

    if (phase === 'opening') {
      gsap.fromTo(panel,
        { scale: 0.15, borderRadius: 24, opacity: 0 },
        { scale: 1, borderRadius: 16, opacity: 1, duration: 0.38, ease: 'elastic.out(1, 0.82)' },
      );
      gsap.fromTo(content,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.25, delay: 0.18, ease: 'power2.out' },
      );
    } else if (phase === 'closing') {
      gsap.to(content, { opacity: 0, duration: 0.1, ease: 'power2.in' });
      gsap.to(panel, { scale: 0.15, borderRadius: 24, opacity: 0, duration: 0.28, delay: 0.06, ease: 'power2.in' });
    }
  }, [phase, fabPosition]);

  const diceIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ color: PALE_YELLOW, flexShrink: 0 }}>
      <rect x="2" y="2" width="20" height="20" rx="3" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );

  // ── Inline mode (mobile homepage) ─────────────────────────────────
  if (fabPosition === 'inline') {
    const scrim = showCard ? createPortal(
      <div
        className="fixed inset-0 z-40 sm:hidden"
        onClick={handleClose}
        style={{
          backgroundColor: 'rgba(13, 26, 20, 0.5)',
          opacity: phase === 'open' ? 1 : 0,
          transition: `opacity ${phase === 'closing' ? CLOSE_MS : OPEN_MS}ms ease`,
        }}
      />,
      document.body,
    ) : null;

    if (fabVisible) {
      return (
        <>
          <button
            className="z-50 sm:hidden flex items-center justify-center rounded-full touch-manipulation j2-press"
            onClick={handleOpen}
            style={{
              width: 48, height: 48,
              backgroundColor: 'rgba(196,145,95,0.20)',
              border: `1px solid ${COPPER_BORDER}`,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(196,145,95,0.15)',
            }}
            aria-label="Rep Roulette"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ color: PALE_YELLOW }}>
              <rect x="2" y="2" width="20" height="20" rx="3" />
              <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
            </svg>
          </button>
          {scrim}
        </>
      );
    }

    return (
      <>
        <div
          ref={panelRef}
          className="z-50 sm:hidden rounded-2xl"
          style={{
            width: 260,
            backgroundColor: 'rgba(26,53,40,0.95)',
            border: '1px solid rgba(196,145,95,0.35)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            padding: 14,
            transformOrigin: 'top right',
          }}
        >
          <div ref={contentRef}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={handleClose} className="touch-manipulation" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  {diceIcon}
                </button>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: COPPER }}>{pool === 'drill' ? 'Drill' : 'Constraint'}</span>
              </div>
              <button
                onClick={() => setPool(p => p === 'drill' ? 'constraint' : 'drill')}
                className="touch-manipulation"
                style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer' }}
              >
                {pool === 'drill' ? '→ CLA' : '→ Drill'}
              </button>
            </div>

            {/* Copper hairline */}
            <div style={{ height: 1, background: 'linear-gradient(to right, rgba(196,145,95,0.4), transparent)', marginBottom: 12 }} />

            {/* Technique — grid-stacked so width stays locked to widest candidate during ticker */}
            {item ? (
              <>
                <div style={{
                  display: 'grid',
                  fontFamily: FONT_EDITORIAL, fontSize: 20, fontWeight: 500, lineHeight: 1.15, marginBottom: 4,
                }}>
                  {tickerCandidates.map(name => (
                    <span key={name} style={{ gridArea: '1/1', visibility: 'hidden' }}>{name}</span>
                  ))}
                  <span style={{ gridArea: '1/1', visibility: 'hidden' }}>{item.name}</span>
                  <span style={{
                    gridArea: '1/1',
                    color: PALE_YELLOW,
                    opacity: spinning ? 0.5 : 1,
                    transform: landed ? 'scale(1.04)' : 'scale(1)',
                    transition: landed ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 0.15s ease',
                    transformOrigin: 'left center',
                  }}>
                    {spinning && displayName ? displayName : item.name}
                  </span>
                </div>
                <div style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.38)', marginBottom: 14,
                  opacity: spinning ? 0 : 1,
                  transition: 'opacity 0.2s ease 0.05s',
                }}>
                  {item.focus}{item.suggestion ? ` · ${item.suggestion}` : ''}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, fontStyle: 'italic', color: 'rgba(255,255,255,0.30)', marginBottom: 14 }}>
                No {pool === 'drill' ? 'drills' : 'constraints'} available.
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleReroll}
                disabled={spinning}
                className="touch-manipulation j2-press"
                style={{
                  flex: 1, fontSize: 11, fontWeight: 600,
                  color: 'rgba(255,255,255,0.50)',
                  padding: '7px 0', borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.08)',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  opacity: spinning ? 0.4 : 1,
                }}
              >
                ↻ Reroll
              </button>
              {item && (
                <button
                  onClick={handleLog}
                  className="touch-manipulation j2-press"
                  style={{
                    flex: 1, fontSize: 11, fontWeight: 600,
                    color: COPPER,
                    padding: '7px 0', borderRadius: 8,
                    border: '1px solid rgba(196,145,95,0.3)',
                    backgroundColor: 'rgba(196,145,95,0.06)',
                    cursor: 'pointer',
                  }}
                >
                  Log this →
                </button>
              )}
            </div>
          </div>
        </div>
        {scrim}
      </>
    );
  }

  // ── Fixed mode (desktop / fallback) ───────────────────────────────

  const fabButton = (
    <button
      className="fixed z-50 sm:hidden flex items-center justify-center rounded-full touch-manipulation j2-press"
      onClick={handleOpen}
      style={{
        right: 16,
        bottom: fabBottom,
        width: 48,
        height: 48,
        backgroundColor: 'rgba(196,145,95,0.20)',
        border: `1px solid ${COPPER_BORDER}`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(196,145,95,0.15)',
        transform: fabVisible ? 'scale(1)' : 'scale(0.5)',
        opacity: fabVisible ? 1 : 0,
        transition: `transform ${OPEN_MS}ms ${OPEN_CURVE}, opacity ${OPEN_MS * 0.4}ms ease`,
        pointerEvents: fabVisible ? 'auto' : 'none',
      }}
      aria-label="Rep Roulette"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ color: PALE_YELLOW }}>
        <rect x="2" y="2" width="20" height="20" rx="3" />
        <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );

  const overlay = createPortal(
    <>
      {/* ── Scrim ── */}
      {showCard && (
        <div
          className="fixed inset-0 z-40 sm:hidden"
          onClick={handleClose}
          style={{
            backgroundColor: 'rgba(13, 26, 20, 0.5)',
            opacity: phase === 'open' ? 1 : 0,
            transition: `opacity ${phase === 'closing' ? CLOSE_MS : OPEN_MS}ms ease`,
          }}
        />
      )}

      {/* ── Card ── */}
      {showCard && (
        <div
          data-no-page-swipe=""
          className="fixed z-50 sm:hidden"
          style={{
            right: 12,
            bottom: fabBottom,
            width: 'calc(100vw - 24px)',
            maxHeight: 'calc(100vh - 10rem - env(safe-area-inset-bottom, 0px))',
            borderRadius: 20,
            backgroundColor: '#1A3528',
            border: '1px solid rgba(196,145,95,0.55)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(196,145,95,0.2), 0 0 30px rgba(196,145,95,0.08)',
            overflow: 'hidden',
            // Scale from FAB origin (bottom-right corner)
            transformOrigin: 'calc(100% - 16px) calc(100% + 4px)',
            transform: cardVisible ? 'scale(1)' : 'scale(0.12)',
            opacity: cardVisible ? 1 : 0,
            transition: phase === 'closing'
              ? `transform ${CLOSE_MS}ms ${CLOSE_CURVE}, opacity ${CLOSE_MS * 0.6}ms ease ${CLOSE_MS * 0.3}ms`
              : `transform ${OPEN_MS}ms ${OPEN_CURVE}, opacity ${OPEN_MS * 0.5}ms ease`,
          }}
          role="dialog"
        >
          {/* Inner content — separate fade for stagger effect */}
          <div
            style={{
              opacity: phase === 'open' ? 1 : 0,
              transition: phase === 'closing'
                ? `opacity ${CLOSE_MS * 0.4}ms ease`
                : `opacity ${OPEN_MS * 0.5}ms ease ${OPEN_MS * 0.3}ms`,
              padding: '16px 16px 20px',
            }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: COPPER }}>
                  <rect x="2" y="2" width="20" height="20" rx="3" />
                  <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
                  <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
                </svg>
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
                  Rep Roulette
                </span>
              </div>
              <button
                onClick={handleClose}
                className="w-7 h-7 flex items-center justify-center rounded-full touch-manipulation"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
                aria-label="Close roulette"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Pool toggle — Drill / Constraint segmented pill. Lives at the
                top of the overlay so the source of the spin is visible at
                the moment of action (per the Refero / Wise pattern). */}
            <div
              role="tablist"
              aria-label="Roulette pool"
              className="flex mb-3 rounded-lg p-0.5"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {(['drill', 'constraint'] as const).map(p => {
                const active = pool === p;
                return (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => { vibrate(8); setPool(p); }}
                    className="flex-1 py-1.5 rounded-[7px] text-[11px] font-semibold uppercase tracking-widest touch-manipulation transition-colors"
                    style={{
                      backgroundColor: active ? SURFACE_3 : 'transparent',
                      color: active ? COPPER : 'rgba(255,255,255,0.45)',
                      letterSpacing: '0.14em',
                    }}
                  >
                    {p === 'drill' ? 'Drill' : 'Constraint'}
                  </button>
                );
              })}
            </div>

            {/* Copper accent line */}
            <div
              className="mb-3"
              style={{
                height: 1,
                background: 'linear-gradient(to right, rgba(196,145,95,0.5), rgba(196,145,95,0.15), transparent)',
              }}
            />

            {/* Active-pool item card — swipeable. When the constraint pool is
                empty (seed agent hasn't shipped yet), shows an empty-state. */}
            <div
              className="rounded-xl px-3.5 py-3.5"
              style={{
                touchAction: 'pan-y',
                backgroundColor: 'rgba(242,228,168,0.035)',
                border: '1px solid rgba(242,228,168,0.12)',
                height: 200,
                display: 'flex',
                flexDirection: 'column' as const,
              }}
              data-no-page-swipe=""
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div style={{
                animation: phase === 'open' ? 'j2RouletteEdgeBounce 0.8s ease 0.05s both' : 'none',
              }}>
                <div style={{
                  transform: `translateX(${isDragging ? dragX : 0}px)`,
                  transition: isDragging ? 'none' : 'transform 0.38s cubic-bezier(0.25, 1.3, 0.4, 1)',
                }}>
                  {item ? (
                    <>
                      <div className="mb-0.5" style={{ display: 'grid' }}>
                        {tickerCandidates.map(name => (
                          <span key={name} className="text-lg font-semibold" style={{ gridArea: '1/1', visibility: 'hidden' }}>{name}</span>
                        ))}
                        <span className="text-lg font-semibold" style={{ gridArea: '1/1', visibility: 'hidden' }}>{item.name}</span>
                        <span className="text-lg font-semibold" style={{
                        gridArea: '1/1',
                        color: 'rgba(242,228,168,0.85)',
                        opacity: spinning ? 0.5 : 1,
                        transform: landed ? 'scale(1.04)' : 'scale(1)',
                        transition: landed ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 0.15s ease',
                        transformOrigin: 'left center',
                      }}>
                        {spinning && displayName ? displayName : item.name}
                      </span>
                      </div>
                      <p className="text-xs" style={{
                        color: 'rgba(255,255,255,0.45)',
                        opacity: spinning ? 0 : 1,
                        transition: 'opacity 0.2s ease 0.05s',
                      }}>
                        {item.focus}
                        <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 6px' }}>·</span>
                        {item.suggestion}
                      </p>
                      <p className="text-xs mt-2 leading-relaxed" style={{
                        color: 'rgba(255,255,255,0.35)',
                        opacity: spinning ? 0 : 1,
                        transition: 'opacity 0.2s ease 0.05s',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical' as const,
                        WebkitLineClamp: 3,
                      }}>
                        {item.description}
                      </p>
                      <div className="flex items-center justify-between mt-3">
                        <p style={{
                          fontSize: 10, color: 'rgba(196,145,95,0.25)',
                          letterSpacing: '0.04em', userSelect: 'none', margin: 0,
                        }}>
                          ← swipe →
                        </p>
                        <button
                          onPointerDown={e => e.stopPropagation()}
                          onClick={e => { e.stopPropagation(); handleLog(); }}
                          className="text-xs touch-manipulation j2-press"
                          style={{
                            color: 'rgba(196,145,95,0.75)',
                            padding: '5px 12px',
                            borderRadius: 8,
                            border: '1px solid rgba(196,145,95,0.3)',
                            backgroundColor: 'rgba(196,145,95,0.06)',
                            letterSpacing: '0.02em',
                            transition: 'color 150ms ease, border-color 150ms ease',
                          }}
                        >
                          {pool === 'drill' ? 'Log this drill →' : 'Log this round →'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs italic" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      Constraint library is empty — seed pending.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom copper glow accent */}
            <div
              style={{
                height: 2,
                marginTop: 12,
                borderRadius: 1,
                background: 'linear-gradient(to right, transparent, rgba(196,145,95,0.3), rgba(196,145,95,0.5), rgba(196,145,95,0.3), transparent)',
                boxShadow: '0 0 8px rgba(196,145,95,0.15)',
              }}
            />
          </div>
        </div>
      )}
    </>,
    document.body,
  );

  return (
    <>
      {fabButton}
      {overlay}
    </>
  );
}
