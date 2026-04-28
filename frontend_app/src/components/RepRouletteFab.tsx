import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { ROULETTE_DRILLS } from '../lib/constants.ts';
import { useCanonicalConstraints } from '../hooks/useCanonicalConstraints.ts';
import { PALE_YELLOW, GLOW_SOFT, COPPER, COPPER_BORDER, SURFACE_3 } from '../lib/theme.ts';
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

function RepRouletteFabImpl({ onLogDrill }: Props) {
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
        const current = activeHistory[activeIndex];
        const next = (current + 1 + Math.floor(Math.random() * Math.max(1, activePoolLength - 1))) % activePoolLength;
        if (pool === 'drill') {
          setDrillHistory(prev => [...prev.slice(0, drillHistoryIndex + 1), next]);
          setDrillHistoryIndex(i => i + 1);
        } else {
          setConstraintHistory(prev => [...prev.slice(0, constraintHistoryIndex + 1), next]);
          setConstraintHistoryIndex(i => i + 1);
        }
      } else {
        if (pool === 'drill') setDrillHistoryIndex(i => Math.max(0, i - 1));
        else setConstraintHistoryIndex(i => Math.max(0, i - 1));
      }
    }
    setDragX(0);
    setIsDragging(false);
  }, [pool, activeHistory, activeIndex, activePoolLength, drillHistoryIndex, constraintHistoryIndex]);

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

  return createPortal(
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

      {/* ── FAB button ── */}
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
          // Morph out: scale down + fade when card opens
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
                      <p className="text-lg font-semibold mb-0.5" style={{ color: 'rgba(242,228,168,0.85)' }}>
                        {item.name}
                      </p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {item.focus}
                        <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 6px' }}>·</span>
                        {item.suggestion}
                      </p>
                      <p className="text-xs mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
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
}
