import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ROULETTE_DRILLS } from '../lib/constants.ts';
import { PALE_YELLOW, GLOW_SOFT, COPPER_BORDER, SURFACE_2 } from '../lib/theme.ts';
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

// ── Component ────────────────────────────────────────────────────────────

interface Props {
  onLogDrill: (preset: { heading: string; sessionType: 'drilling'; subSkillTag: string }) => void;
}

export default function RepRouletteFab({ onLogDrill }: Props) {
  const [open, setOpen] = useState(false);
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
      dx = rawDx * 0.3; // rubber-band
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

  // ── Handlers ───────────────────────────────────────────────────────

  const handleOpen = () => {
    vibrate(10);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleLog = () => {
    onLogDrill({
      heading:     DRILL_FOCUS_TO_TAG[drill.focus],
      sessionType: 'drilling',
      subSkillTag: drill.name,
    });
    setOpen(false);
  };

  // ── FAB ────────────────────────────────────────────────────────────

  const fab = (
    <button
      onClick={handleOpen}
      className="fixed z-30 sm:hidden flex items-center justify-center rounded-full shadow-lg touch-manipulation j2-press"
      style={{
        right: 16,
        bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px) + 16px)',
        width: 48,
        height: 48,
        backgroundColor: 'rgba(196,145,95,0.20)',
        border: `1px solid ${COPPER_BORDER}`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(196,145,95,0.15)',
      }}
      aria-label="Rep Roulette"
    >
      {/* Dice icon */}
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

  // ── Bottom Sheet ───────────────────────────────────────────────────

  const sheet = open ? createPortal(
    <div
      data-no-page-swipe=""
      className="fixed inset-0 z-50"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: 'rgba(13, 26, 20, 0.75)',
          backdropFilter: 'blur(8px)',
          animation: 'j2IntentFadeIn 0.2s ease both',
        }}
      />

      {/* Sheet */}
      <div
        onClick={e => e.stopPropagation()}
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl"
        style={{
          backgroundColor: '#152E22',
          border: `1px solid ${COPPER_BORDER}`,
          borderBottom: 'none',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          animation: 'j2SheetSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
            Rep Roulette
          </span>
          <button
            onClick={handleClose}
            className="text-xs px-2 py-1 rounded-lg touch-manipulation"
            style={{ color: 'rgba(255,255,255,0.35)', backgroundColor: SURFACE_2 }}
          >
            Close
          </button>
        </div>

        {/* Drill card — swipeable */}
        <div
          className="mx-5 rounded-xl px-4 py-4"
          style={{
            touchAction: 'pan-y',
            backgroundColor: 'rgba(242,228,168,0.04)',
            border: '1px solid rgba(242,228,168,0.15)',
          }}
          data-no-page-swipe=""
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div style={{ animation: 'j2RouletteEdgeBounce 0.8s ease 0.15s both' }}>
            <div style={{
              transform: `translateX(${isDragging ? dragX : 0}px)`,
              transition: isDragging ? 'none' : 'transform 0.38s cubic-bezier(0.25, 1.3, 0.4, 1)',
            }}>
              <p className="text-xl font-semibold mb-0.5" style={{ color: 'rgba(242,228,168,0.85)' }}>
                {drill.name}
              </p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {drill.focus}
                <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 6px' }}>·</span>
                {drill.suggestion}
              </p>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {drill.description}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); handleLog(); }}
                  className="text-xs touch-manipulation j2-press"
                  style={{
                    color: 'rgba(196,145,95,0.7)',
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: '1px solid rgba(196,145,95,0.25)',
                    backgroundColor: 'transparent',
                    letterSpacing: '0.02em',
                    transition: 'color 150ms ease, border-color 150ms ease',
                  }}
                >
                  Log this drill →
                </button>
              </div>
              <p style={{
                fontSize: 11, color: 'rgba(196,145,95,0.25)', marginTop: 10,
                textAlign: 'center', letterSpacing: '0.04em', userSelect: 'none',
              }}>
                ← swipe to browse →
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      {!open && fab}
      {sheet}
    </>
  );
}
