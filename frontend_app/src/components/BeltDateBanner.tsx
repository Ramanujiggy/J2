// BeltDateBanner — belt-colored date input with a left-to-right reveal.
// One belt-body div sweeps out from the left via scaleX (compositor-only,
// zero seams), a patch pops in at the right end with a back.out snap, and
// the date text fades in. Replaces the previous 9-slat Venetian Blind which
// created visible seams where adjacent slats were at different rotateX angles.
// Tapping opens the native date picker via a transparent overlay input.

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useProfile } from '../context/ProfileContext.tsx';
import { BELT_COLORS, PATCH_COLORS, ribbed } from '../lib/belt.ts';
import type { BeltRank } from '../lib/belt.ts';

interface Props {
  value: string;              // YYYY-MM-DD
  onChange: (date: string) => void;
  required?: boolean;
}

// ─── Layout constants ─────────────────────────────────────────────────────────
const PATCH_W    = 52;   // px — patch zone width (right end)
const STRIPE_W   = 4;    // px — each stripe bar width
const STRIPE_H   = 28;   // px — each stripe bar height
const STRIPE_GAP = 5;    // px — gap between stripe bars

// ─── Animation timing ─────────────────────────────────────────────────────────
const BELT_DURATION_S  = 0.52;   // belt body sweep
const PATCH_DURATION_S = 0.28;   // patch pop-in
const TEXT_DURATION_S  = 0.22;   // date text fade-in

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  });
}

// Inset shadow simulates the top-edge catch-light and bottom inner-shadow
// of real fabric, giving perceived thickness without SVG or canvas.
const BELT_INSET_SHADOW =
  'inset 0 2px 0 rgba(255,255,255,0.28), inset 0 -2px 0 rgba(0,0,0,0.20)';

// ─── Component ────────────────────────────────────────────────────────────────
export default function BeltDateBanner({ value, onChange, required }: Props) {
  const { beltRank, stripes } = useProfile();
  const rank: BeltRank     = (beltRank as BeltRank) ?? 'white';
  const beltColor          = BELT_COLORS[rank];
  const patchColor         = PATCH_COLORS[rank];
  const isDark             = rank !== 'white';
  const textColor          = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(20,20,20,0.82)';
  const n                  = Math.min(Math.max(Math.round(stripes ?? 0), 0), 4);

  const beltRef  = useRef<HTMLDivElement>(null);
  const patchRef = useRef<HTMLDivElement>(null);
  const textRef  = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const belt  = beltRef.current;
    const patch = patchRef.current;
    const text  = textRef.current;
    if (!belt || !patch || !text) return;

    // Set initial hidden state — prevents any flash before the timeline fires
    gsap.set(belt,  { scaleX: 0, transformOrigin: 'left center' });
    gsap.set(patch, { scale: 0.68, opacity: 0 });
    gsap.set(text,  { opacity: 0 });

    const tl = gsap.timeline({ delay: 0.04 });

    // 1. Belt body sweeps left → right.
    //    scaleX from a left origin is compositor-only — no layout, no paint,
    //    no element boundaries to create seams.
    tl.to(belt, {
      scaleX:   1,
      duration: BELT_DURATION_S,
      ease:     'expo.out',   // fast start, smooth deceleration — no elastic bounce
    });

    // 2. Patch snaps in with a back.out overshoot just before the sweep lands.
    tl.to(patch, {
      scale:    1,
      opacity:  1,
      duration: PATCH_DURATION_S,
      ease:     'back.out(2.2)',
    }, `-=${PATCH_DURATION_S * 0.45}`);

    // 3. Date text fades in
    tl.to(text, {
      opacity:  1,
      duration: TEXT_DURATION_S,
      ease:     'power2.out',
    }, '<0.06');

    return () => { tl.kill(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // overflow:hidden clips the patch back.out scale overshoot at the right edge
    <div style={{ position: 'relative', height: 48, overflow: 'hidden' }}>

      {/* ── Belt body — single element, sweeps from left ─────────────────────── */}
      <div
        ref={beltRef}
        style={{
          position:   'absolute',
          top:        0,
          bottom:     0,
          left:       0,
          right:      PATCH_W,
          background: ribbed(beltColor),
          boxShadow:  BELT_INSET_SHADOW,
        }}
      />

      {/* ── Patch (rightmost) ────────────────────────────────────────────────── */}
      <div
        ref={patchRef}
        style={{
          position:        'absolute',
          top:             0,
          bottom:          0,
          right:           0,
          width:           PATCH_W,
          backgroundColor: patchColor,
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          gap:             STRIPE_GAP,
          opacity:         0,
        }}
      >
        {Array.from({ length: n }, (_, i) => (
          <div
            key={i}
            style={{
              width:           STRIPE_W,
              height:          STRIPE_H,
              backgroundColor: 'rgba(255,255,255,0.85)',
              borderRadius:    2,
              flexShrink:      0,
            }}
          />
        ))}
      </div>

      {/* ── Date text ────────────────────────────────────────────────────────── */}
      <span
        ref={textRef}
        style={{
          position:      'absolute',
          top:           '50%',
          left:          0,
          right:         0,
          transform:     'translateY(-50%)',
          textAlign:     'center',
          paddingLeft:   12,
          paddingRight:  PATCH_W + 8,
          fontSize:      15,
          fontWeight:    600,
          letterSpacing: '0.02em',
          color:         textColor,
          userSelect:    'none',
          pointerEvents: 'none',
          opacity:       0,
        }}
      >
        {formatDate(value)}
      </span>

      {/* ── Transparent input — captures taps, opens native picker ───────────── */}
      <input
        type="date"
        value={value}
        required={required}
        onChange={e => onChange(e.target.value)}
        style={{
          position: 'absolute',
          inset:    0,
          opacity:  0,
          width:    '100%',
          height:   '100%',
          cursor:   'pointer',
          zIndex:   10,
        }}
      />
    </div>
  );
}
