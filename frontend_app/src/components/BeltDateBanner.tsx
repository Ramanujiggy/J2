// BeltDateBanner — animated belt strip that acts as the date picker header
// for LogSessionForm. On mount the belt unrolls from the right and smacks
// down (like a real belt landing on the mat). Tapping it opens the native
// date picker via a transparent <input type="date"> overlay.

import { useProfile } from '../context/ProfileContext.tsx';
import { BELT_COLORS, PATCH_COLORS, ribbed } from '../lib/belt.ts';
import type { BeltRank } from '../lib/belt.ts';

interface Props {
  value: string;              // YYYY-MM-DD
  onChange: (date: string) => void;
  required?: boolean;
}

const PATCH_W    = 52;  // px — right patch zone width
const STRIPE_W   = 4;   // px — each stripe mark width
const STRIPE_H   = 28;  // px — each stripe mark height
const STRIPE_GAP = 5;   // px — gap between stripe marks

function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  });
}

export default function BeltDateBanner({ value, onChange, required }: Props) {
  const { beltRank, stripes } = useProfile();
  const rank: BeltRank       = (beltRank as BeltRank) ?? 'white';
  const beltColor            = BELT_COLORS[rank];
  const patchColor           = PATCH_COLORS[rank];
  const isDark               = rank !== 'white';
  const textColor            = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(20,20,20,0.82)';
  const n                    = Math.min(Math.max(Math.round(stripes ?? 0), 0), 4);

  return (
    <>
      <style>{`
        @keyframes j2BeltDateUnroll {
          0%   { clip-path: inset(0 0 0 100%); transform: perspective(400px) rotateX(20deg); }
          25%  { transform: perspective(400px) rotateX(10deg); }
          65%  { clip-path: inset(0 0 0 0%);   transform: perspective(400px) rotateX(0deg); }
          78%  { clip-path: inset(0 0 0 2%); }
          90%  { clip-path: inset(0 0 0 0.5%); }
          100% { clip-path: inset(0 0 0 0); }
        }
        @keyframes j2BeltDateSmack {
          0%   { box-shadow: none; }
          60%  { box-shadow: 0 6px 24px rgba(0,0,0,0.50); }
          100% { box-shadow: 0 3px 10px rgba(0,0,0,0.30); }
        }
      `}</style>

      {/* Wrapper: clip-path on the belt strip handles visibility; no overflow:hidden needed */}
      <div style={{ position: 'relative', height: 48 }}>

        {/* Belt strip */}
        <div style={{
          position:        'absolute',
          inset:           0,
          background:      ribbed(beltColor),
          display:         'flex',
          alignItems:      'center',
          animation:       'j2BeltDateUnroll 0.65s cubic-bezier(0.22,1,0.36,1) both, j2BeltDateSmack 0.65s ease-out both',
        }}>
          {/* Date text */}
          <span style={{
            flex:          1,
            textAlign:     'center',
            paddingLeft:   12,
            paddingRight:  PATCH_W + 8,
            fontSize:      15,
            fontWeight:    600,
            letterSpacing: '0.02em',
            color:         textColor,
            userSelect:    'none',
            pointerEvents: 'none',
          }}>
            {formatDate(value)}
          </span>

          {/* Patch zone */}
          <div style={{
            width:           PATCH_W,
            height:          '100%',
            backgroundColor: patchColor,
            flexShrink:      0,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            gap:             STRIPE_GAP,
          }}>
            {Array.from({ length: n }).map((_, i) => (
              <div key={i} style={{
                width:           STRIPE_W,
                height:          STRIPE_H,
                backgroundColor: 'rgba(255,255,255,0.85)',
                borderRadius:    2,
                flexShrink:      0,
              }} />
            ))}
          </div>
        </div>

        {/* Transparent date input — captures taps, opens native picker */}
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
          }}
        />
      </div>
    </>
  );
}
