import { useState, useRef, useCallback } from 'react';
import { SURFACE_2, SURFACE_2_BORDER, COPPER } from '../lib/theme.ts';
import { formatDuration } from '../lib/sessionUtils.ts';
import { EIGHT_GATES } from '../lib/constants.ts';
import { generateBurstParticles } from '../lib/particles.ts';

interface Props {
  streak: number;
  longestStreak: number;
  weekSessionCount: number;
  weekTotalMinutes: number;
  consistentWeeks: number;
  onTap?: () => void;
}

// Find the highest gate tier reached
function getActiveGate(consistentWeeks: number) {
  return [...EIGHT_GATES].reverse().find(g => consistentWeeks >= g.weeks) ?? null;
}

const BURST_PARTICLES = generateBurstParticles();

export default function StatStrip({ streak, longestStreak, weekSessionCount, weekTotalMinutes, consistentWeeks, onTap }: Props) {
  const [view, setView] = useState<'daily' | 'weekly'>('daily');
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
      setView(v => v === 'daily' ? 'weekly' : 'daily');
      setFading(false);
    }, 120);
  }, [fading]);

  // Daily streak cell content
  const dailyValue   = streak > 0 ? `${streak}d` : '—';
  const dailyAccent  = streak > 0 ? COPPER : undefined;
  const dailySub     = isPersonalBest && streak > 1
    ? 'personal best'
    : longestStreak > 0 ? `best: ${longestStreak}d` : undefined;

  // Weekly consistency cell content
  const weeklyValue  = consistentWeeks > 0 ? `${consistentWeeks}` : '—';
  const weeklyAccent = gate ? gate.color : undefined;

  const streakCellGlow = view === 'weekly' && gate
    ? `0 0 10px 2px ${gate.glow}`
    : undefined;

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
      {/* ── Streak / Consistent Weeks cell — tappable flip ── */}
      <button
        onClick={handleStreakTap}
        className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 relative rounded-l-xl touch-manipulation overflow-hidden"
        style={{
          borderRight: '1px solid rgba(255,255,255,0.06)',
          boxShadow: streakCellGlow,
          transition: 'box-shadow 0.4s ease',
        }}
      >
        {/* Burst particles — gate 8, one-shot */}
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
          <span
            className="text-lg font-bold block text-center"
            style={{ color: view === 'weekly' ? (weeklyAccent ?? 'rgba(255,255,255,0.88)') : (dailyAccent ?? 'rgba(255,255,255,0.88)') }}
          >
            {view === 'daily' && streak > 0 && (
              <span style={{ marginRight: 4, fontSize: 14 }}>🔥</span>
            )}
            {view === 'daily' ? dailyValue : weeklyValue}
          </span>
          <span className="text-[11px] block text-center" style={{ color: 'rgba(255,255,255,0.38)' }}>
            {view === 'daily' ? 'streak' : 'week streak'}
          </span>
          {view === 'daily' && dailySub && (
            <span
              className="text-[10px] block text-center"
              style={{ color: isPersonalBest ? COPPER : 'rgba(255,255,255,0.22)' }}
            >
              {dailySub}
            </span>
          )}
        </div>

        {/* Flip hint */}
        <span
          className="absolute bottom-1 right-1.5 text-[8px] select-none"
          style={{ color: 'rgba(255,255,255,0.22)' }}
        >
          ⇄
        </span>
      </button>

      {/* ── Sessions this week ── */}
      <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5"
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>
          {weekSessionCount}
        </span>
        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
          {weekSessionCount === 1 ? 'session' : 'sessions'}
        </span>
      </div>

      {/* ── Time this week ── */}
      <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
        <span className="text-lg font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>
          {weekTotalMinutes > 0 ? formatDuration(weekTotalMinutes) : '0h'}
        </span>
        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
          this week
        </span>
      </div>
    </button>
  );
}
