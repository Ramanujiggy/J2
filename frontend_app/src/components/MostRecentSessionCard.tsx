// MostRecentSessionCard — desktop sidebar card on Path Ahead.
//
// Lives in its own component so the reveal timer fires on *card* mount, not
// page mount. (Page mount fires before data arrives, so the reveal silently
// elapsed before the card existed. Scoping fixes that.)
//
// Three-phase reveal:
//   Phase 'dot':    copper dot, glowing (brightness breathe, no scale change).
//   Phase 'line':   dot stretches rightward into a thin horizontal line.
//   Phase 'reveal': the line dissolves and the eyebrow text rises up from
//                   where the line was. Eyebrow reads "Focus:" or "Deep Work:"
//                   depending on whether the heading pillar carried the
//                   long-press deep_work flag.
//
// Both shape and text live inside a fixed-width slot so the surrounding
// layout doesn't lurch as the morph plays.
//
// Extracted from PathAheadPage.tsx during the 2026-05-09 refactor pass.

import { useState, useEffect } from 'react';
import { COPPER, TEXT_SECONDARY, TEXT_TERTIARY } from '../lib/theme.ts';
import { SKILL_TAGS, MONTH_NAMES } from '../lib/constants.ts';
import { toDateString, formatDuration, DAY_NAMES, SESSION_TYPE_LABELS, formatGiNogi } from '../lib/sessionUtils.ts';
import type { SessionSummary } from '../types/api.ts';

interface Props {
  mostRecent: SessionSummary;
  softCardStyle: React.CSSProperties;
}

export default function MostRecentSessionCard({ mostRecent, softCardStyle }: Props) {
  type Phase = 'dot' | 'line' | 'reveal';
  const [phase, setPhase] = useState<Phase>('dot');

  useEffect(() => {
    if (typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setPhase('reveal');
      return;
    }
    const t1 = setTimeout(() => setPhase('line'),   1000);
    const t2 = setTimeout(() => setPhase('reveal'), 1450);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const dateStr = typeof mostRecent.date === 'string'
    ? mostRecent.date.slice(0, 10)
    : toDateString(new Date(mostRecent.date));
  const dateObj = new Date(dateStr + 'T00:00:00');
  const giLabel = formatGiNogi(mostRecent.gi_nogi);
  const typeLabel = SESSION_TYPE_LABELS[mostRecent.session_type] ?? mostRecent.session_type;
  // Prefer `heading` (mig 007 dynamic-pillar primary) over the older `tags[0]`.
  const headingPillar = (mostRecent.heading ?? mostRecent.tags?.[0]) as string | undefined;
  const focusLabel = headingPillar
    ? (SKILL_TAGS.find(s => s.value === headingPillar)?.label ?? headingPillar)
    : 'Free rolling';

  const isDeepWorkFocus = !!headingPillar
    && Array.isArray(mostRecent.deep_work_pillars)
    && (mostRecent.deep_work_pillars as string[]).includes(headingPillar);
  const eyebrowText = isDeepWorkFocus ? 'Deep Work:' : 'Focus:';

  // Slot dimensions — wide enough for "Deep Work:" plus a buffer.
  const SLOT_WIDTH = 118;
  const SHAPE_W = phase === 'dot' ? 14 : Math.max(SLOT_WIDTH - 12, 100);
  const SHAPE_H = phase === 'dot' ? 14 : 2;

  return (
    <div style={{ ...softCardStyle, padding: 32 }}>
      <div className="j2-label-copper" style={{ marginBottom: 16 }}>◈ Most recent session</div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10,
        minHeight: 42,
      }}>
        {/* Animated slot — dot → line → text emerges out of line via clip-path */}
        <div
          style={{
            position: 'relative',
            width: SLOT_WIDTH,
            height: 24,
            flexShrink: 0,
          }}
        >
          {/* The dot/line shape — fades out as the text unveils from its midline */}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              marginTop: -(SHAPE_H / 2),
              width: SHAPE_W,
              height: SHAPE_H,
              borderRadius: phase === 'dot' ? '50%' : 1,
              background: COPPER,
              boxShadow: phase === 'dot'
                ? `0 0 14px ${COPPER}DD, 0 0 30px ${COPPER}66`
                : `0 0 10px ${COPPER}88`,
              animation: phase === 'dot' ? 'j2DotGlow 2000ms ease-in-out infinite' : 'none',
              opacity: phase === 'reveal' ? 0 : 1,
              transition:
                'width 460ms cubic-bezier(0.65,0,0.35,1), ' +
                'height 320ms cubic-bezier(0.65,0,0.35,1), ' +
                'margin-top 320ms cubic-bezier(0.65,0,0.35,1), ' +
                'border-radius 320ms ease-out, ' +
                'box-shadow 460ms ease-out, ' +
                'opacity 380ms ease-out 100ms',
            }}
          />
          {/* Eyebrow — clipped to a 0-height horizontal slice at the line's vertical center
              until reveal, then the inset shrinks symmetrically to reveal the full letters.
              Effectively the line's strip *unfolds* into the text. */}
          <span
            className="j2-label-copper"
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              clipPath: phase === 'reveal'
                ? 'inset(-2px 0 -2px 0)'
                : 'inset(50% 0 50% 0)',
              WebkitClipPath: phase === 'reveal'
                ? 'inset(-2px 0 -2px 0)'
                : 'inset(50% 0 50% 0)',
              transition:
                'clip-path 560ms cubic-bezier(0.16,1,0.3,1) 80ms, ' +
                '-webkit-clip-path 560ms cubic-bezier(0.16,1,0.3,1) 80ms',
              whiteSpace: 'nowrap',
            }}
          >
            {eyebrowText}
          </span>
        </div>
        <div className="j2-serif-display" style={{ fontSize: 30 }}>
          {focusLabel}
        </div>
      </div>
      <div style={{ fontSize: 15, color: TEXT_SECONDARY }}>
        {formatDuration(mostRecent.duration ?? 0)} · {typeLabel} · {giLabel}
      </div>
      <div style={{ fontSize: 14, color: TEXT_TERTIARY, marginTop: 8 }}>
        {DAY_NAMES[dateObj.getDay()]}, {MONTH_NAMES[dateObj.getMonth()]} {dateObj.getDate()}
      </div>
    </div>
  );
}
