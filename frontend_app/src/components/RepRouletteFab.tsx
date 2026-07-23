import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ROULETTE_DRILLS } from '../lib/constants.ts';
import { PALE_YELLOW, GLOW_SOFT, COPPER, COPPER_BORDER } from '../lib/theme.ts';
import { vibrate } from '../lib/haptics.ts';

// ── Drill focus → pillar tag mapping ─────────────────────────────────────

const DRILL_FOCUS_TO_TAG: Record<string, string> = {
  'Guard':          'guard',
  'Stand-up':       'standup',
  'Dynamic Pins':   'pins',
  'Guard Passing':  'passing',
  'Submissions':    'submissions',
  'Guard Retention':'guard',
};

// ── Timing constants ─────────────────────────────────────────────────────

const OPEN_MS  = 340;  // FAB → card morph duration
const CLOSE_MS = 280;  // card → FAB reverse morph
const OPEN_CURVE  = 'cubic-bezier(0.16, 1, 0.3, 1)';   // M3 "heavy" ease-out
const CLOSE_CURVE = 'cubic-bezier(0.4, 0, 0.6, 1)';     // smooth ease-in-out

// ── Component ────────────────────────────────────────────────────────────

interface Props {
  onLogDrill: (preset: { heading: string; sessionType: 'drilling'; subSkillTag: string }) => void;
}

type Phase = 'fab' | 'opening' | 'open' | 'closing';

export default function RepRouletteFab({ onLogDrill }: Props) {
  const [phase, setPhase] = useState<Phase>('fab');

  const [drillHistory, setDrillHistory] = useState<number[]>(
    () => [Math.floor(Math.random() * ROULETTE_DRILLS.length)]
  );
  const [drillHistoryIndex, setDrillHistoryIndex] = useState(0);

  // Swipe state
  const touchStartX    = useRef(0);
  const touchStartY    = useRef(0);
  const touchStartTime = useRef(0);
  const isHorizontal   = useRef<boolean | null>(null);
  const rafRef         = useRef<number | undefined>(undefined);
  const [dragX, setDragX]           = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const drill = ROULETTE_DRILLS[drillHistory[drillHistoryIndex]];

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
    if (drillHistoryIndex === 0 && rawDx > 0) {
      dx = rawDx * 0.3;
    }

    if (rafRef.current !== undefined) return;
    rafRef.current = requestAnimationFrame(() => {
      setDragX(dx);
      rafRef.current = undefined;
    });
  }, [drillHistoryIndex]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (rafRef.current !== undefined) { cancelAnimationFrame(rafRef.current); rafRef.current = undefined; }
    const dx  = e.changedTouches[0].clientX - touchStartX.current;
    const dt  = Date.now() - touchStartTime.current;
    const vel = Math.abs(dx) / Math.max(dt, 1);
    if (Math.abs(dx) > 45 || vel > 0.35) {
      if (dx < 0) {
        const currentDrill = drillHistory[drillHistoryIndex];
        const next = (currentDrill + 1 + Math.floor(Math.random() * (ROULETTE_DRILLS.length - 1))) % ROULETTE_DRILLS.length;
        setDrillHistory(prev => [...prev.slice(0, drillHistoryIndex + 1), next]);
        setDrillHistoryIndex(i => i + 1);
      } else {
        setDrillHistoryIndex(i => Math.max(0, i - 1));
      }
    }
    setDragX(0);
    setIsDragging(false);
  }, [drillHistory, drillHistoryIndex]);

  const handleLog = () => {
    onLogDrill({
      heading:     DRILL_FOCUS_TO_TAG[drill.focus],
      sessionType: 'drilling',
      subSkillTag: drill.name,
    });
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

            {/* Copper accent line */}
            <div
              className="mb-3"
              style={{
                height: 1,
                background: 'linear-gradient(to right, rgba(196,145,95,0.5), rgba(196,145,95,0.15), transparent)',
              }}
            />

            {/* Drill card — swipeable */}
            <div
              className="rounded-xl px-3.5 py-3.5"
              style={{
                touchAction: 'pan-y',
                backgroundColor: 'rgba(242,228,168,0.035)',
                border: '1px solid rgba(242,228,168,0.12)',
                minHeight: 175,
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
                  <p className="text-lg font-semibold mb-0.5" style={{ color: 'rgba(242,228,168,0.85)' }}>
                    {drill.name}
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {drill.focus}
                    <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 6px' }}>·</span>
                    {drill.suggestion}
                  </p>
                  <p className="text-xs mt-2 leading-relaxed" style={{
                    color: 'rgba(255,255,255,0.35)',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 4,
                  }}>
                    {drill.description}
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
                      Log this drill →
                    </button>
                  </div>
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
