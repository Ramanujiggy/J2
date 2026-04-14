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

// ── Component ────────────────────────────────────────────────────────────

interface Props {
  onLogDrill: (preset: { heading: string; sessionType: 'drilling'; subSkillTag: string }) => void;
}

export default function RepRouletteFab({ onLogDrill }: Props) {
  // expanded = card is open; morphing = animation in progress
  const [expanded, setExpanded] = useState(false);
  const [morphing, setMorphing] = useState(false);
  const [visible, setVisible]   = useState(false); // delays content render for enter animation

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

  // ── Morph animation orchestration ──────────────────────────────────

  const handleOpen = () => {
    vibrate(10);
    setExpanded(true);
    setMorphing(true);
    // After the morph transition completes, reveal content
    setTimeout(() => {
      setMorphing(false);
      setVisible(true);
    }, 380);
  };

  const handleClose = () => {
    setVisible(false);
    setMorphing(true);
    // Delay actual collapse to let content fade out
    setTimeout(() => {
      setExpanded(false);
      setMorphing(false);
    }, 350);
  };

  // Close on Escape
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [expanded]);

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

  // ── Shared position constants ──────────────────────────────────────
  // FAB sits at right:16, bottom: 5rem + safe-area + 16px (above tab bar)
  // Card expands from that origin point

  const fabBottom = 'calc(5rem + env(safe-area-inset-bottom, 0px) + 16px)';

  // ── Render ─────────────────────────────────────────────────────────

  // The container is always rendered — we animate between FAB and card states
  // via CSS transitions on the same element (true container transform).
  const container = createPortal(
    <>
      {/* Scrim — only when expanded */}
      {expanded && (
        <div
          className="fixed inset-0 z-40 sm:hidden"
          onClick={handleClose}
          style={{
            backgroundColor: 'rgba(13, 26, 20, 0.5)',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.25s ease',
            pointerEvents: visible ? 'auto' : 'none',
          }}
        />
      )}

      {/* The morphing container — transitions from circle to card */}
      <div
        data-no-page-swipe=""
        className="fixed z-50 sm:hidden"
        onClick={expanded ? undefined : handleOpen}
        style={{
          // Position: always anchored to bottom-right
          right: expanded ? 12 : 16,
          bottom: expanded
            ? fabBottom
            : fabBottom,
          // Size: circle → card
          width: expanded ? 'calc(100vw - 24px)' : 48,
          height: expanded ? 'auto' : 48,
          maxHeight: expanded ? 'calc(100vh - 10rem - env(safe-area-inset-bottom, 0px))' : 48,
          // Shape: circle → rounded card
          borderRadius: expanded ? 20 : 24,
          // Background: subtle glass → warm copper card
          backgroundColor: expanded ? '#1A3528' : 'rgba(196,145,95,0.20)',
          border: `1px solid ${expanded ? 'rgba(196,145,95,0.55)' : COPPER_BORDER}`,
          backdropFilter: expanded ? 'none' : 'blur(12px)',
          WebkitBackdropFilter: expanded ? 'none' : 'blur(12px)',
          // Shadow: small → dramatic
          boxShadow: expanded
            ? '0 8px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(196,145,95,0.2), 0 0 30px rgba(196,145,95,0.08)'
            : '0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(196,145,95,0.15)',
          // Transform origin: bottom-right so card expands leftward + upward
          transformOrigin: 'bottom right',
          // Overflow hidden during morph to clip content
          overflow: 'hidden',
          // The actual transition — cubic-bezier for that M3 feel
          transition: morphing || expanded
            ? 'width 0.38s cubic-bezier(0.2, 0.9, 0.3, 1), height 0.38s cubic-bezier(0.2, 0.9, 0.3, 1), max-height 0.38s cubic-bezier(0.2, 0.9, 0.3, 1), border-radius 0.35s ease, right 0.35s ease, background-color 0.3s ease, box-shadow 0.35s ease, border-color 0.3s ease'
            : 'none',
          // Cursor when collapsed
          cursor: expanded ? 'default' : 'pointer',
          // Ensure touch-friendly
          touchAction: 'manipulation',
        }}
        aria-label="Rep Roulette"
        role={expanded ? 'dialog' : 'button'}
      >
        {/* FAB icon — visible when collapsed, fades out on expand */}
        <div
          className="flex items-center justify-center"
          style={{
            width: 48,
            height: 48,
            opacity: expanded ? 0 : 1,
            transition: 'opacity 0.15s ease',
            position: expanded ? 'absolute' : 'relative',
            right: 0,
            bottom: 0,
            pointerEvents: expanded ? 'none' : 'auto',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ color: PALE_YELLOW }}>
            <rect x="2" y="2" width="20" height="20" rx="3" />
            <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        </div>

        {/* Card content — fades in after morph completes */}
        {expanded && (
          <div
            style={{
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.2s ease 0.05s',
              padding: '16px 16px 20px',
            }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {/* Mini dice icon */}
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
              }}
              data-no-page-swipe=""
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div style={{
                animation: visible ? 'j2RouletteEdgeBounce 0.8s ease 0.1s both' : 'none',
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
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
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
        )}
      </div>
    </>,
    document.body,
  );

  return container;
}
