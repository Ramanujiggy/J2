// PathAheadTelemetryCard — the 11-day window stat card with the copper
// particle/glow treatment. Shown in both desktop and mobile branches of
// PathAheadPage.
//
// Visual language: copper-tinted card surface with a subtle radial
// pulse + drifting particle field beneath a session-count + total-time
// line, plus a copy line that interprets the dominant tag distribution
// ("Splitting time between guard and submissions" / "All 4 sessions
// went into passing" / etc).
//
// Pure presentation — windowStats is derived in the parent and passed in.
// Extracted from PathAheadPage.tsx during the 2026-05-09 refactor pass.

import { GLOW_SOFT, PALE_YELLOW, SURFACE_2, COPPER_BORDER } from '../lib/theme.ts';
import { STATS_PARTICLES } from '../lib/particles.ts';
import { formatDuration } from '../lib/sessionUtils.ts';

interface WindowStats {
  count: number;
  totalMinutes: number;
  topTagLabel: string | null;
  topTagCount: number;
  tag2Label: string | null;
}

interface Props {
  windowStats: WindowStats;
}

export default function PathAheadTelemetryCard({ windowStats }: Props) {
  return (
    <div
      className="rounded-xl px-4 py-2.5"
      style={{
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: SURFACE_2,
        border: `1px solid ${COPPER_BORDER}`,
      }}
    >
      {/* Particle / glow layer */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 45%, transparent 100%)',
        maskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 45%, transparent 100%)',
      }}>
        <div style={{
          position: 'absolute',
          bottom: -10, left: '50%',
          transform: 'translateX(-50%)',
          width: '50%', height: 40,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center bottom, rgba(196,145,95,0.15) 0%, transparent 80%)',
          animation: 'j2IntentCopperPulse 5.5s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0, height: 18,
          background: 'linear-gradient(to top, rgba(196,145,95,0.12) 0%, transparent 100%)',
          animation: 'j2IntentCopperPulse 4.5s ease-in-out infinite',
          transformOrigin: 'center bottom',
        }} />
        {STATS_PARTICLES.map((p, i) => (
          <span key={i} style={{
            position: 'absolute',
            left: p.left, bottom: p.bottom,
            width: p.size, height: p.size,
            borderRadius: '50%',
            backgroundColor: 'rgba(218,116,34,0.75)',
            boxShadow: '0 0 5px 2px rgba(218,116,34,0.45)',
            filter: 'brightness(1.2)',
            ['--drift' as string]: p.drift,
            animation: `j2IntentParticleRise ${p.duration}s ease-in-out infinite ${p.delay}s`,
            userSelect: 'none',
          } as React.CSSProperties} />
        ))}
      </div>
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>Training Telemetry</span>
          <span style={{
            display: 'inline-block', width: 20, height: 1.5,
            borderRadius: 1,
            backgroundColor: 'rgba(196,145,95,0.55)',
            boxShadow: '0 0 6px 2px rgba(196,145,95,0.3)',
            verticalAlign: 'middle',
          }} />
        </div>
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <span className="text-white/50">
            <span className="font-semibold text-white">{windowStats.count}</span> session{windowStats.count !== 1 ? 's' : ''}
          </span>
          <span className="text-white/20">·</span>
          <span className="text-white/50">
            <span className="font-semibold text-white">{formatDuration(windowStats.totalMinutes)}</span> total
          </span>
        </div>
        {windowStats.topTagLabel && (() => {
          const { topTagLabel, topTagCount, count, tag2Label } = windowStats;
          const pct = count > 0 ? topTagCount / count : 0;
          let before: string;
          let highlight: string;
          let after: string | null = null;
          let highlight2: string | null = null;
          if (tag2Label && pct < 0.7) {
            before = 'Splitting time between ';
            highlight = topTagLabel!;
            after = ' and ';
            highlight2 = tag2Label;
          } else if (pct === 1 && count > 1) {
            before = `All ${count} sessions went into `;
            highlight = topTagLabel!;
          } else {
            before = 'Recent sessions have been leaning into ';
            highlight = topTagLabel!;
          }
          return (
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.45 }}>
              {before}
              <strong style={{ color: 'rgba(218,116,34,0.85)', fontWeight: 600 }}>{highlight}</strong>
              {after && highlight2 ? (
                <>{after}<strong style={{ color: 'rgba(218,116,34,0.85)', fontWeight: 600 }}>{highlight2}</strong></>
              ) : null}
              {'.'}
            </p>
          );
        })()}
      </div>
    </div>
  );
}
