// FocusAreaChips — replacement input for the spatial Prism.
//
// Five fixed pillar chips. Three explicit gestures:
//   tap          → toggle selected
//   double-tap   → mark primary (transfers from any prior primary)
//   long-press   → toggle deep_work (selects if not selected)
//
// Keyboard equivalents on a focused chip:
//   Space/Enter  → tap
//   P            → toggle primary
//   D            → toggle deep_work
//   ArrowLeft/Right → cycle focus
//
// Tap-vs-double-tap disambiguation: single-tap fires immediately. If a
// second tap on the *same* chip arrives within 300ms, the previous-state
// snapshot is restored and the gesture upgrades to double-tap. iOS-conventional.
//
// Long-press: 500ms hold with ≤10px movement tolerance. A pathLength=100 SVG
// rect outlines the chip and sweeps stroke-dashoffset 100→0 during the hold.
// Cancellation rolls the ring back; completion fires haptics + commits deep_work.

import { useEffect, useRef, useState } from 'react';
import { COPPER, PALE_YELLOW, SURFACE_3 } from '../lib/theme.ts';
import { vibrate } from '../lib/haptics.ts';
import type { ChipSelection } from '../lib/selectionsToDistribution.ts';
import type { Pillar } from '../types/api.ts';

// Short labels match PillarPrism's `shortLabel` set — chosen so all 5 chips
// fit in a single row on mobile (~360px viewport) without wrapping. The full
// pillar names ("Guard Passing", "Dynamic Pins") still drive the aria-label
// for screen-reader users.
const PILLARS: ReadonlyArray<{ value: Pillar; label: string; fullLabel: string }> = [
  { value: 'standup',     label: 'Stand-up', fullLabel: 'Stand-up'      },
  { value: 'passing',     label: 'Passing',  fullLabel: 'Guard Passing' },
  { value: 'pins',        label: 'Pins',     fullLabel: 'Dynamic Pins'  },
  { value: 'submissions', label: 'Subs',     fullLabel: 'Submissions'   },
  { value: 'guard',       label: 'Guard',    fullLabel: 'Guard'         },
];

const LONG_PRESS_MS    = 500;
const DOUBLE_TAP_MS    = 300;
const MOVE_THRESHOLD   = 10; // px
const HINT_KEY         = 'journada.chip_input.hint_dismissed';

interface Props {
  selections: ChipSelection[];
  onChange: (next: ChipSelection[]) => void;
  /** Roulette pre-fill: selects this pillar and marks it primary. */
  defaultPrimaryPillar?: Pillar | null;
  /**
   * 'multi' (default): tap/double-tap/long-press for selected/primary/deep-work.
   * 'single': tap = set as primary (clears all others). Long-press and
   *           double-tap collapse to single tap. Used by intention picker.
   */
  mode?: 'multi' | 'single';
}

interface PendingTap {
  pillar: Pillar;
  prevState: ChipSelection[];
  timer: ReturnType<typeof setTimeout>;
}

interface PressState {
  pillar: Pillar;
  startX: number;
  startY: number;
  pointerId: number;
}

function findSel(sels: ChipSelection[], pillar: Pillar): ChipSelection | undefined {
  return sels.find(s => s.pillar === pillar);
}

function withTap(sels: ChipSelection[], pillar: Pillar): ChipSelection[] {
  // Tap toggles selected. Tapping a primary chip deselects it (clearing primary).
  const existing = findSel(sels, pillar);
  if (!existing) return [...sels, { pillar, primary: false, deep_work: false }];
  return sels.filter(s => s.pillar !== pillar);
}

function withPrimary(sels: ChipSelection[], pillar: Pillar): ChipSelection[] {
  // Set primary on `pillar`, clear primary on all others. Selects if not selected.
  const next: ChipSelection[] = sels.map(s => ({ ...s, primary: false }));
  const existing = next.find(s => s.pillar === pillar);
  if (existing) {
    existing.primary = true;
    return next;
  }
  return [...next, { pillar, primary: true, deep_work: false }];
}

function togglePrimary(sels: ChipSelection[], pillar: Pillar): ChipSelection[] {
  // Keyboard 'P': if already primary, demote (stay selected). Else promote.
  const existing = findSel(sels, pillar);
  if (existing?.primary) {
    return sels.map(s => s.pillar === pillar ? { ...s, primary: false } : s);
  }
  return withPrimary(sels, pillar);
}

function toggleDeepWork(sels: ChipSelection[], pillar: Pillar): ChipSelection[] {
  const existing = findSel(sels, pillar);
  if (!existing) return [...sels, { pillar, primary: false, deep_work: true }];
  return sels.map(s => s.pillar === pillar ? { ...s, deep_work: !s.deep_work } : s);
}

export default function FocusAreaChips({ selections, onChange, defaultPrimaryPillar, mode = 'multi' }: Props) {
  const isSingle = mode === 'single';
  // Pre-fill on mount if requested.
  useEffect(() => {
    if (defaultPrimaryPillar && selections.length === 0) {
      onChange(withPrimary([], defaultPrimaryPillar));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First-run hint — auto-dismisses on first save (handled by parent clearing
  // selections after save) but we also let the user dismiss it manually.
  const [hintDismissed, setHintDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(HINT_KEY) === '1';
  });
  const dismissHint = () => {
    setHintDismissed(true);
    try { window.localStorage.setItem(HINT_KEY, '1'); } catch { /* ignore */ }
  };

  const [focusedIdx, setFocusedIdx] = useState<number>(0);
  const [pressing, setPressing] = useState<Pillar | null>(null);

  const pendingTapRef = useRef<PendingTap | null>(null);
  const pressStateRef = useRef<PressState | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef<boolean>(false);
  const selectionsRef = useRef<ChipSelection[]>(selections);

  // Keep a live ref to selections so gesture handlers reading at fire-time
  // see the up-to-date snapshot, not the closure-captured one. Synced during
  // render (rather than in a useEffect) so the ref is fresh by the time the
  // next user event fires — useEffect runs after commit, leaving a gap where
  // rapid back-to-back gestures could read stale state.
  selectionsRef.current = selections;

  // Cleanup any in-flight timers on unmount.
  useEffect(() => () => {
    if (pendingTapRef.current) clearTimeout(pendingTapRef.current.timer);
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  }, []);

  const fireSingleOrDouble = (pillar: Pillar) => {
    // Single-select mode: tap promotes to primary (deselecting any other);
    // tap on the currently-primary chip deselects entirely.
    if (isSingle) {
      const existing = findSel(selectionsRef.current, pillar);
      vibrate(8);
      onChange(existing?.primary
        ? []
        : [{ pillar, primary: true, deep_work: false }]);
      return;
    }

    const pending = pendingTapRef.current;
    if (pending && pending.pillar === pillar) {
      // Double-tap upgrade: undo the first tap, then apply primary.
      clearTimeout(pending.timer);
      pendingTapRef.current = null;
      const restored = pending.prevState;
      const next = withPrimary(restored, pillar);
      vibrate(15);
      onChange(next);
      return;
    }

    // Different chip pending → abandon the old pending state.
    if (pending) {
      clearTimeout(pending.timer);
      pendingTapRef.current = null;
    }

    // Fire single-tap immediately.
    const prevState = selectionsRef.current;
    const next = withTap(prevState, pillar);
    vibrate(8);
    onChange(next);

    // Stash for possible upgrade.
    const timer = setTimeout(() => { pendingTapRef.current = null; }, DOUBLE_TAP_MS);
    pendingTapRef.current = { pillar, prevState, timer };
  };

  const fireLongPress = (pillar: Pillar) => {
    longPressFiredRef.current = true;
    setPressing(null);
    // Cancel any pending tap so the upcoming pointerup doesn't double-fire.
    if (pendingTapRef.current) {
      clearTimeout(pendingTapRef.current.timer);
      pendingTapRef.current = null;
    }
    const next = toggleDeepWork(selectionsRef.current, pillar);
    vibrate(20);
    onChange(next);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, pillar: Pillar) => {
    // Mouse right-click etc. — ignore.
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    pressStateRef.current = {
      pillar,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
    };
    longPressFiredRef.current = false;
    setPressing(pillar);

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    // Single-select mode has no deep-work concept, so skip the long-press timer
    // (and the fill ring won't render either — see `isPressing && !isSingle` below).
    if (!isSingle) {
      longPressTimerRef.current = setTimeout(() => fireLongPress(pillar), LONG_PRESS_MS);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const ps = pressStateRef.current;
    if (!ps || ps.pointerId !== e.pointerId) return;
    const dx = e.clientX - ps.startX;
    const dy = e.clientY - ps.startY;
    if (Math.hypot(dx, dy) > MOVE_THRESHOLD) {
      // Movement aborts the gesture entirely.
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      pressStateRef.current = null;
      setPressing(null);
    }
  };

  const handlePointerUp = (_e: React.PointerEvent<HTMLButtonElement>, pillar: Pillar) => {
    const ps = pressStateRef.current;
    pressStateRef.current = null;
    setPressing(null);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressFiredRef.current) {
      // Long-press already handled it; do not also fire tap.
      longPressFiredRef.current = false;
      return;
    }
    if (!ps || ps.pillar !== pillar) return; // movement aborted, or mismatched
    fireSingleOrDouble(pillar);
  };

  const handlePointerCancel = () => {
    pressStateRef.current = null;
    setPressing(null);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, pillar: Pillar, idx: number) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      fireSingleOrDouble(pillar);
    } else if ((e.key === 'p' || e.key === 'P') && !isSingle) {
      e.preventDefault();
      vibrate(15);
      onChange(togglePrimary(selectionsRef.current, pillar));
    } else if ((e.key === 'd' || e.key === 'D') && !isSingle) {
      e.preventDefault();
      vibrate(20);
      onChange(toggleDeepWork(selectionsRef.current, pillar));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx((idx + 1) % PILLARS.length);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx((idx - 1 + PILLARS.length) % PILLARS.length);
    }
  };

  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const btn = buttonRefs.current[focusedIdx];
    if (btn && document.activeElement !== btn) {
      // Move DOM focus to track keyboard nav, but only if a chip was already focused.
      if (document.activeElement && buttonRefs.current.includes(document.activeElement as HTMLButtonElement)) {
        btn.focus();
      }
    }
  }, [focusedIdx]);

  return (
    <div>
      {/* Chip palette */}
      <div className="flex flex-wrap gap-2 justify-center" role="group" aria-label="Focus areas for this session">
        {PILLARS.map((p, i) => {
          const sel = findSel(selections, p.value);
          const selected = !!sel;
          const isPrimary = !!sel?.primary;
          const isDeepWork = !!sel?.deep_work;
          const isPressing = pressing === p.value;

          // Visual treatment per state.
          const bg = selected ? COPPER : SURFACE_3;
          const fg = selected ? '#fff' : 'rgba(255,255,255,0.55)';
          const border = selected
            ? (isPrimary ? `1px solid ${PALE_YELLOW}` : '1px solid rgba(196,145,95,0.6)')
            : '1px solid rgba(255,255,255,0.10)';
          const halo = isDeepWork
            ? `0 0 0 2px rgba(196,145,95,0.45), 0 0 12px rgba(196,145,95,0.35)`
            : 'none';

          return (
            <button
              key={p.value}
              ref={el => { buttonRefs.current[i] = el; }}
              type="button"
              role="switch"
              aria-checked={selected}
              aria-label={`${p.label}${isPrimary ? ', primary focus' : ''}${isDeepWork ? ', deep work' : ''}`}
              tabIndex={focusedIdx === i ? 0 : -1}
              onPointerDown={e => handlePointerDown(e, p.value)}
              onPointerMove={handlePointerMove}
              onPointerUp={e => handlePointerUp(e, p.value)}
              onPointerCancel={handlePointerCancel}
              onKeyDown={e => handleKeyDown(e, p.value, i)}
              onFocus={() => setFocusedIdx(i)}
              onContextMenu={ev => ev.preventDefault()}
              className="relative rounded-[10px] px-3.5 py-2 text-sm font-medium transition-colors touch-manipulation select-none j2-press"
              style={{
                backgroundColor: bg,
                color: fg,
                border,
                boxShadow: halo,
                minHeight: 44,
                minWidth: 96,
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
              }}
            >
              <span style={{ position: 'relative', zIndex: 1 }}>{p.label}</span>

              {/* Affordance: cream dot (selected only, no primary) */}
              {selected && !isPrimary && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 5, right: 5,
                    width: 5, height: 5, borderRadius: '50%',
                    backgroundColor: PALE_YELLOW,
                  }}
                />
              )}

              {/* Affordance: filled diamond (primary) */}
              {isPrimary && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 4, right: 4,
                    width: 7, height: 7,
                    backgroundColor: PALE_YELLOW,
                    transform: 'rotate(45deg)',
                    boxShadow: '0 0 6px rgba(242,228,168,0.6)',
                  }}
                />
              )}

              {/* Long-press progress ring — only in multi mode */}
              {isPressing && !isSingle && (
                <svg
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  width="100%" height="100%"
                  viewBox="0 0 100 100" preserveAspectRatio="none"
                >
                  <rect
                    x="1" y="1" width="98" height="98" rx="9" ry="9"
                    fill="none" stroke={PALE_YELLOW} strokeWidth="2"
                    pathLength={100}
                    strokeDasharray={100}
                    strokeDashoffset={100}
                    style={{
                      animation: `chipLpFill ${LONG_PRESS_MS}ms linear forwards`,
                    }}
                  />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* First-run hint — multi-mode only; single-mode is self-explanatory. */}
      {!hintDismissed && !isSingle && (
        <p
          className="text-[11px] mt-2 text-center"
          style={{ color: 'rgba(255,255,255,0.40)', lineHeight: 1.5 }}
        >
          Tap to add. Double-tap to set your focus. Hold for deep work.
          <button
            type="button"
            onClick={dismissHint}
            className="ml-2 underline j2-press"
            style={{ color: 'rgba(255,255,255,0.55)', background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
          >
            got it
          </button>
        </p>
      )}

      <style>{`
        @keyframes chipLpFill {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}
