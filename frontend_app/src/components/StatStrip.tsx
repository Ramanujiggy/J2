import { useState, useRef, useCallback } from 'react';
import { SURFACE_2, SURFACE_2_BORDER, COPPER } from '../lib/theme.ts';
import { formatDuration } from '../lib/sessionUtils.ts';
import { EIGHT_GATES } from '../lib/constants.ts';
import { generateBurstParticles } from '../lib/particles.ts';
import type { ACWRResult, DecayResult } from '../lib/analyticsModels.ts';

interface Props {
  streak: number;
  longestStreak: number;
  weekSessionCount: number;
  weekTotalMinutes: number;
  consistentWeeks: number;
  acwr?: ACWRResult | null;
  rustiest?: DecayResult | null;
  onTap?: () => void;
}

// Find the highest gate tier reached
function getActiveGate(consistentWeeks: number) {
  return [...EIGHT_GATES].reverse().find(g => consistentWeeks >= g.weeks) ?? null;
}

const BURST_PARTICLES = generateBurstParticles();

export default function StatStrip({ streak, longestStreak, weekSessionCount, weekTotalMinutes, consistentWeeks, acwr, rustiest: rustiestPillar, onTap }: Props) {
  type View = 'daily' | 'weekly' | 'sessions' | 'readiness' | 'rustiest';
  const views: View[] = ['daily', 'weekly', 'sessions', ...(acwr && acwr.zone !== 'no-data' ? ['readiness' as const] : []), ...(rustiestPillar ? ['rustiest' as const] : [])];
  const [view, setView] = useState<View>('daily');
  const [fading, setFading] = useState(false);
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPersonalBest = streak > 0 && streak >= longestStreak;
  const gate = getActiveGate(consistentWeeks);

  const handleStreakTap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (fading) return;
    setFading(true);
    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    flipTimerRef.current = setTimeout(() => {
      setView(v => { const idx = views.indexOf(v); return views[(idx + 1) % views.length]; });
      setFading(false);
    }, 120);
  }, [fading]);

  // Per-view display values
  const acwrColor =
    acwr?.zone === 'sweet-spot' ? 'rgba(82,181,108,0.85)' :
    acwr?.zone === 'caution'    ? 'rgba(218,180,60,0.85)' :
    acwr?.zone === 'danger'     ? 'rgba(218,90,70,0.85)' :
    acwr?.zone === 'deload'     ? 'rgba(90,175,210,0.85)' :
    'rgba(255,255,255,0.88)';

  const valueColor =
    view === 'weekly'    ? (gate ? gate.color : 'rgba(255,255,255,0.88)') :
    view === 'daily'     ? (streak > 0 ? COPPER : 'rgba(255,255,255,0.88)') :
    view === 'readiness' ? acwrColor :
    view === 'rustiest'  ? 'rgba(218,116,34,0.85)' :
    'rgba(255,255,255,0.88)';

  const cellValue =
    view === 'daily'     ? (streak > 0 ? `${streak}d` : '—') :
    view === 'weekly'    ? (consistentWeeks > 0 ? `${consistentWeeks}` : '—') :
    view === 'readiness' ? (acwr?.ratio != null ? `${acwr.ratio.toFixed(1)}` : '—') :
    view === 'rustiest'  ? (rustiestPillar ? `${Math.round(rustiestPillar.retention * 100)}%` : '—') :
    `${weekSessionCount}`;

  const cellLabel =
    view === 'daily'     ? 'streak' :
    view === 'weekly'    ? 'weeks of consistent mat time' :
    view === 'readiness' ? (acwr?.zone === 'sweet-spot' ? 'readiness — sweet spot' : acwr?.zone === 'danger' ? 'readiness — spike risk' : acwr?.zone === 'caution' ? 'readiness — watch it' : 'readiness — deloading') :
    view === 'rustiest'  ? (rustiestPillar ? `${rustiestPillar.label} retention` : 'retention') :
    weekSessionCount === 1 ? 'session this week' : 'sessions this week';

  const cellSub =
    view === 'daily' && isPersonalBest && streak > 1 ? 'personal best' :
    view === 'daily' && longestStreak > 0            ? `best: ${longestStreak}d` :
    view === 'rustiest' && rustiestPillar && rustiestPillar.daysSince < Infinity ? `${rustiestPillar.daysSince}d since last session` :
    null;

  const cellGlow = view === 'weekly' && gate ? `0 0 10px 2px ${gate.glow}` : undefined;
  const showBurst = view === 'weekly' && consistentWeeks >= 26;

  return (
    <button
      onClick={onTap}
      className="w-full rounded-xl flex touch-manipulation"
      style={{
        backgroundColor: SURFACE_2,
        border: `1px solid ${SURFACE_2_BORDER}`,
        cursor: onTap ? 'pointer' : 'default',
      }}
    >
      {/* ── Left cell: streak / weekly / sessions — tappable cycle ── */}
      <button
        onClick={handleStreakTap}
        className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 relative rounded-l-xl touch-manipulation overflow-hidden"
        style={{
          borderRight: '1px solid rgba(255,255,255,0.06)',
          boxShadow: cellGlow,
          transition: 'box-shadow 0.4s ease',
        }}
      >
        {/* Burst particles — 26-week milestone, one-shot */}
        {showBurst && (
          <div key={consistentWeeks} className="absolute inset-0 pointer-events-none overflow-hidden">
            {BURST_PARTICLES.map((p, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  left: p.left,
                  bottom: p.bottom,
                  width: p.size,
                  height: p.size,
                  backgroundColor: gate?.color ?? COPPER,
                  '--drift': p.drift,
                  animation: `j2IntentParticleRise ${p.duration}s ease-in-out ${p.delay}s 1 forwards`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        )}

        <div style={{ transition: 'opacity 0.12s', opacity: fading ? 0 : 1 }}>
          <span className="text-lg font-bold block text-center" style={{ color: valueColor }}>
            {cellValue}
          </span>
          <span className="text-xs block text-center" style={{ color: 'rgba(255,255,255,0.38)' }}>
            {cellLabel}
          </span>
          {cellSub && (
            <span
              className="text-[11px] block text-center"
              style={{ color: isPersonalBest && view === 'daily' ? COPPER : 'rgba(255,255,255,0.22)' }}
            >
              {cellSub}
            </span>
          )}
        </div>

        {/* Cycle hint */}
        <span
          className="absolute bottom-1 right-1.5 text-[10px] select-none"
          style={{ color: 'rgba(255,255,255,0.30)' }}
        >
          ⇄
        </span>
      </button>

      {/* ── Right cell: time this week — always visible ── */}
      <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
        <span className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>
          {weekTotalMinutes > 0 ? formatDuration(weekTotalMinutes) : '0h'}
        </span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
          this week
        </span>
      </div>
    </button>
  );
}
