// BeltDateBanner — belt-colored date input with a left-to-right reveal.
// The belt body and patch share the same scaleX sweep from their respective
// left edges, so the whole banner reads as one continuous piece of fabric
// being laid down. Replaces the previous 9-slat Venetian Blind (visible seams)
// and the back.out patch pop-in (visually separate from the belt).
// Tapping opens the native date picker via a transparent overlay input.
//
// Animation choreography (≈1s total):
//   1. Belt body sweeps L→R (expo.out, 0.52s) — clean, fast, no overshoot.
//   2. Patch hands off and lands with a subtle stamp (back.out(1.4), 0.20s).
//   3. Stripes stamp in one-by-one (back.out(1.6), 0.07s stagger) — same
//      language as adding stripes on graduation day.
//   4. Date text fades in.
//   5. A single quiet sheen sweep travels L→R across the belt body (~0.65s)
//      as the closing beat — restrained editorial settle, not a loop.

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useProfile } from '../context/ProfileContext.tsx';
import { BELT_COLORS, PATCH_COLORS, ribbed } from '../lib/belt.ts';
import { CARD_BG } from '../lib/theme.ts';
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
const PATCH_DURATION_S = 0.20;   // patch sweep (continues belt's motion)
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

  const beltRef    = useRef<HTMLDivElement>(null);
  const patchRef   = useRef<HTMLDivElement>(null);
  const textRef    = useRef<HTMLSpanElement>(null);
  const sheenRef   = useRef<HTMLDivElement>(null);
  const stripeRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const belt  = beltRef.current;
    const patch = patchRef.current;
    const text  = textRef.current;
    const sheen = sheenRef.current;
    const stripeEls = stripeRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!belt || !patch || !text || !sheen) return;

    // Both elements start at scaleX=0 — hidden without needing opacity tricks.
    // transformOrigin 'left center' on both means each scales from its own left
    // edge: belt body from the banner's left wall, patch from the belt/patch
    // junction. The two sweeps travel in the same direction and hand off
    // seamlessly — the whole banner reads as one piece being laid down.
    gsap.set(belt,  { scaleX: 0, transformOrigin: 'left center' });
    gsap.set(patch, { scaleX: 0, transformOrigin: 'left center' });
    gsap.set(text,  { opacity: 0 });
    gsap.set(sheen, { opacity: 0, x: '-40%' });
    if (stripeEls.length) {
      gsap.set(stripeEls, { scale: 0, opacity: 0, transformOrigin: 'center center' });
    }

    const tl = gsap.timeline({ delay: 0.04 });

    // 1. Belt body sweeps left → right. Clean, fast, no overshoot — the
    //    sweep should feel taut, like fabric being pulled into place.
    tl.to(belt, {
      scaleX:   1,
      duration: BELT_DURATION_S,
      ease:     'expo.out',
    });

    // 2. Patch hands off the sweep and lands with a subtle stamp.
    //    back.out(1.4) gives a tactile end-state without losing the
    //    handoff — the overshoot is small enough that it still reads
    //    as one continuous motion, not a separate "pop in".
    tl.to(patch, {
      scaleX:   1,
      duration: PATCH_DURATION_S,
      ease:     'back.out(1.4)',
    }, `-=${PATCH_DURATION_S * 0.55}`);

    // 3. Stripes stamp in one-by-one, each with a soft overshoot.
    //    Mirrors the ceremony of receiving a stripe at the dojo: not
    //    all-at-once, but one … then the next. Reference language
    //    cribbed from Duolingo/Brilliant achievement reveals.
    if (stripeEls.length) {
      tl.to(stripeEls, {
        scale:    1,
        opacity:  1,
        duration: 0.22,
        ease:     'back.out(1.6)',
        stagger:  0.07,
      }, '-=0.06');
    }

    // 4. Date text fades in alongside the last stripe (or right after the
    //    patch lands, when there are no stripes).
    tl.to(text, {
      opacity:  1,
      duration: TEXT_DURATION_S,
      ease:     'power2.out',
    }, stripeEls.length ? '-=0.18' : '<0.06');

    // 5. Settle sheen — a single quiet highlight sweep across the belt
    //    body. Editorial closing beat: not a loop, not a sparkle, just a
    //    brief gleam that says "the belt is here". Plays once on mount.
    tl.to(sheen, {
      opacity:  0.45,
      duration: 0.18,
      ease:     'power1.in',
    }, '+=0.04');
    tl.to(sheen, {
      x:        '140%',
      duration: 0.62,
      ease:     'power2.out',
    }, '<');
    tl.to(sheen, {
      opacity:  0,
      duration: 0.32,
      ease:     'power2.out',
    }, '-=0.36');

    return () => { tl.kill(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // overflow:hidden clips the patch scaleX overshoot at the right edge.
    // backgroundColor ensures the top 48px is never transparent — prevents the
    // modal backdrop-filter from bleeding through before the belt animates in.
    <div style={{ position: 'relative', height: 48, overflow: 'hidden', backgroundColor: CARD_BG }}>

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
          overflow:   'hidden',
        }}
      >
        {/* Settle sheen — a thin, soft highlight that sweeps L→R once after
            the belt is laid down. Lives inside the belt body so it's clipped
            by overflow:hidden and doesn't bleed onto the patch. The angle and
            blur soften the edge so it reads as a gleam, not a hard bar. */}
        <div
          ref={sheenRef}
          aria-hidden
          style={{
            position:  'absolute',
            top:       -8,
            bottom:    -8,
            left:      0,
            width:     '38%',
            background:
              'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
            filter:        'blur(2px)',
            opacity:       0,
            pointerEvents: 'none',
            mixBlendMode:  isDark ? 'screen' : 'overlay',
          }}
        />
      </div>

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
          // Junction seam — a faint inner shadow on the patch's left edge
          // suggests the patch is sewn on top of the belt rather than
          // butting against it. Free detail, no motion, no perf cost.
          boxShadow: 'inset 2px 0 4px rgba(0,0,0,0.22), ' + BELT_INSET_SHADOW,
        }}
      >
        {Array.from({ length: n }, (_, i) => (
          <div
            key={i}
            ref={el => { stripeRefs.current[i] = el; }}
            style={{
              width:           STRIPE_W,
              height:          STRIPE_H,
              backgroundColor: 'rgba(255,255,255,0.88)',
              borderRadius:    2,
              flexShrink:      0,
              boxShadow:       '0 0 4px rgba(255,255,255,0.18)',
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
