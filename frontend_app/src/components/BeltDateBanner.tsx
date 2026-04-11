// BeltDateBanner — Venetian-Blind belt unfurl using GSAP.
// 9 belt-body slices + 1 patch slice each flip from rotateX(-90deg) to flat
// with a 40 ms left-to-right stagger, so the belt appears to unroll section
// by section rather than sliding in as a whole. The patch "slaps" down last.
// Tapping the belt opens the native date picker via a transparent overlay input.

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
const SLICES     = 9;    // number of belt-body slices (excluding patch)

// ─── Animation timing ─────────────────────────────────────────────────────────
const STAGGER_S        = 0.04;   // 40 ms between each slice start
const SLAT_DURATION_S  = 0.38;   // each slat animation duration
const PATCH_DURATION_S = 0.32;   // patch "slap" animation duration
const TEXT_DURATION_S  = 0.25;   // date text fade-in duration

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  });
}

// Inset box-shadow applied to every slat — simulates the top-edge catch-light
// and bottom inner-shadow of a real fabric belt, giving it perceived thickness.
const SLAT_INSET_SHADOW =
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

  // Refs for GSAP targets
  const slatsRef    = useRef<(HTMLDivElement | null)[]>(Array(SLICES).fill(null));
  const patchRef    = useRef<HTMLDivElement>(null);
  const textRef     = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const slats = slatsRef.current.filter((el): el is HTMLDivElement => el !== null);
    const patch = patchRef.current;
    const text  = textRef.current;
    if (!slats.length || !patch || !text) return;

    // Set everything invisible before the animation starts (prevents flash)
    gsap.set([slats, patch], {
      rotateX:         -90,
      opacity:         0,
      transformOrigin: 'top center',
    });
    gsap.set(text, { opacity: 0 });

    const tl = gsap.timeline({ delay: 0.04 });

    // 1. Belt slices unfurl left → right with elastic spring
    tl.to(slats, {
      rotateX:  0,
      opacity:  1,
      duration: SLAT_DURATION_S,
      stagger:  STAGGER_S,
      ease:     'elastic.out(1, 0.65)',
    });

    // 2. Patch "slaps" down — starts just before the last slat finishes so the
    //    visual climax of the patch and the last slat overlap slightly.
    tl.to(patch, {
      rotateX:  0,
      opacity:  1,
      duration: PATCH_DURATION_S,
      ease:     'elastic.out(1.1, 0.5)',   // slightly bouncier slap
    }, `-=${PATCH_DURATION_S * 0.35}`);

    // 3. Date text fades in once most of the belt is flat
    tl.to(text, {
      opacity:  1,
      duration: TEXT_DURATION_S,
      ease:     'power2.out',
    }, '<0.08');

    return () => { tl.kill(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Precomputed belt-slice geometry using CSS calc so it's responsive
  const sliceW = `calc((100% - ${PATCH_W}px) / ${SLICES})`;

  return (
    // perspective on the parent gives all slats a shared vanishing point.
    // overflow:hidden clips any sub-pixel overshoot during the elastic spring.
    <div style={{ position: 'relative', height: 48, overflow: 'hidden', perspective: '500px' }}>

      {/* ── Belt-body slices (indices 0 … SLICES-1, left → right) ──────────── */}
      {Array.from({ length: SLICES }, (_, i) => (
        <div
          key={i}
          ref={el => { slatsRef.current[i] = el; }}
          style={{
            position:  'absolute',
            top:       0,
            bottom:    0,
            left:      `calc(${i} * (100% - ${PATCH_W}px) / ${SLICES})`,
            width:     sliceW,
            background: ribbed(beltColor),
            boxShadow: SLAT_INSET_SHADOW,
            // Initial hidden state (GSAP will override on mount, but this
            // prevents a one-frame flash on very fast devices)
            opacity:   0,
          }}
        />
      ))}

      {/* ── Patch slice (rightmost, appears last) ───────────────────────────── */}
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

      {/* ── Date text overlay (fades in after belt is mostly flat) ───────────── */}
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

      {/* ── Transparent date input — captures taps, opens native picker ──────── */}
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
