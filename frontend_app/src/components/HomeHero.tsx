// HomeHero — editorial top-of-Home block. Replaces HomeHeader + StatStrip
// on the mobile PathAhead layout. No card chrome: greeting kicker, hero
// streak numeral in Cormorant, and a flat row of this-week numerals
// underneath. Preserves StatStrip's tap-to-cycle behaviour and the outer
// tap-to-expand-telemetry affordance.

import { useState, useRef, useCallback } from 'react';
import { COPPER, PRESTIGE_TEAL, PRESTIGE_TEAL_GLOW, FONT_EDITORIAL } from '../lib/theme.ts';
import { EIGHT_GATES } from '../lib/constants.ts';
import { generateBurstParticles } from '../lib/particles.ts';
import type { ACWRResult, DecayResult, PillarACWRResult } from '../lib/analyticsModels.ts';

interface Props {
  name: string | null;
  streak: number;
  longestStreak: number;
  weekSessionCount: number;
  consistentWeeks: number;
  acwr?: ACWRResult | null;
  rustiest?: DecayResult | null;
  spikiest?: PillarACWRResult | null;
  onTap?: () => void;
  rouletteSlot?: React.ReactNode;
}

function getActiveGate(consistentWeeks: number) {
  return [...EIGHT_GATES].reverse().find(g => consistentWeeks >= g.weeks) ?? null;
}

const BURST_PARTICLES = generateBurstParticles();

export default function HomeHero({
  name,
  streak,
  longestStreak,
  weekSessionCount,
  consistentWeeks,
  acwr,
  rustiest: rustiestPillar,
  spikiest,
  onTap,
  rouletteSlot,
}: Props) {
  type View = 'daily' | 'weekly' | 'sessions' | 'readiness' | 'rustiest' | 'spike';
  const views: View[] = [
    'daily', 'weekly', 'sessions',
    ...(acwr && acwr.zone !== 'no-data' ? ['readiness' as const] : []),
    ...(rustiestPillar ? ['rustiest' as const] : []),
    ...(spikiest ? ['spike' as const] : []),
  ];
  const [view, setView] = useState<View>('daily');
  const [fading, setFading] = useState(false);
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPersonalBest = streak > 0 && streak >= longestStreak;
  const gate = getActiveGate(consistentWeeks);
  const isPrestige = consistentWeeks >= 26;

  const handleStreakTap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (fading) return;
    setFading(true);
    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    flipTimerRef.current = setTimeout(() => {
      setView(v => { const idx = views.indexOf(v); return views[(idx + 1) % views.length]; });
      setFading(false);
    }, 120);
  }, [fading, views]);

  // Greeting + date
  const hours = new Date().getHours();
  const greeting = hours < 12 ? 'Good morning' : hours < 17 ? 'Good afternoon' : 'Good evening';
  const displayGreeting = name ? `${greeting}, ${name}` : greeting;
  const dateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const acwrColor =
    acwr?.zone === 'sweet-spot' ? 'rgba(82,181,108,0.92)' :
    acwr?.zone === 'caution'    ? 'rgba(218,180,60,0.92)' :
    acwr?.zone === 'danger'     ? 'rgba(218,90,70,0.92)' :
    acwr?.zone === 'deload'     ? 'rgba(90,175,210,0.92)' :
    'rgba(255,255,255,0.92)';

  const spikeColor =
    spikiest?.zone === 'danger'  ? 'rgba(218,90,70,0.92)' :
    spikiest?.zone === 'caution' ? 'rgba(218,180,60,0.92)' :
    'rgba(255,255,255,0.92)';

  const valueColor =
    view === 'weekly'    ? (isPrestige ? PRESTIGE_TEAL : gate ? gate.color : 'rgba(255,255,255,0.92)') :
    view === 'daily'     ? (streak > 0 ? COPPER : 'rgba(255,255,255,0.92)') :
    view === 'readiness' ? acwrColor :
    view === 'rustiest'  ? 'rgba(218,116,34,0.92)' :
    view === 'spike'     ? spikeColor :
    'rgba(255,255,255,0.92)';

  const cellValue =
    view === 'daily'     ? `${streak}` :
    view === 'weekly'    ? (consistentWeeks > 0 ? `${consistentWeeks}` : '0') :
    view === 'readiness' ? (acwr?.ratio != null ? acwr.ratio.toFixed(1) : '—') :
    view === 'rustiest'  ? (rustiestPillar ? `${Math.round(rustiestPillar.retention * 100)}%` : '—') :
    view === 'spike'     ? (spikiest?.ratio != null ? spikiest.ratio.toFixed(1) : '—') :
    `${weekSessionCount}`;

  const cellLabel =
    view === 'daily'     ? 'day streak' :
    view === 'weekly'    ? 'weeks of consistent mat time' :
    view === 'readiness' ? (acwr?.zone === 'sweet-spot' ? 'readiness — sweet spot' : acwr?.zone === 'danger' ? 'readiness — spike risk' : acwr?.zone === 'caution' ? 'readiness — watch it' : 'readiness — deloading') :
    view === 'rustiest'  ? (rustiestPillar ? `${rustiestPillar.label} retention` : 'retention') :
    view === 'spike'     ? (spikiest ? `${spikiest.label} load — ${spikiest.zone === 'danger' ? 'spike risk' : 'watch it'}` : 'pillar load') :
    weekSessionCount === 1 ? 'session this week' : 'sessions this week';

  const cellSub =
    view === 'daily' && isPersonalBest && streak > 1 ? 'personal best' :
    view === 'daily' && longestStreak > 0            ? `best: ${longestStreak}d` :
    view === 'rustiest' && rustiestPillar && rustiestPillar.daysSince < Infinity ? `${rustiestPillar.daysSince}d since last session` :
    null;

  const showBurst = view === 'weekly' && consistentWeeks >= 26;
  const showPrestigeAura = view === 'weekly' && isPrestige;

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full text-left touch-manipulation"
      style={{
        background: 'transparent',
        border: 'none',
        padding: '0px 4px 8px',
        cursor: onTap ? 'pointer' : 'default',
      }}
    >
      {/* Kicker — greeting + date, quiet so the hero numeral leads */}
      <div className="flex flex-col gap-0.5" style={{ marginBottom: 8 }}>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(242,228,168,0.62)',
          }}
        >
          {displayGreeting}
        </span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', letterSpacing: '0.01em' }}>
          {dateStr}
        </span>
      </div>

      {/* Hero streak + roulette — two-column layout */}
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      <button
        type="button"
        onClick={handleStreakTap}
        className="block text-left touch-manipulation relative"
        style={{ background: 'transparent', border: 'none', padding: 0, flex: '0 0 50%' }}
      >
        {showPrestigeAura && (
          <div
            aria-hidden="true"
            className="absolute pointer-events-none"
            style={{
              left: -24, right: -24, top: -16, bottom: -8,
              background: `radial-gradient(ellipse 55% 75% at 16% 50%, ${PRESTIGE_TEAL_GLOW} 0%, rgba(0,212,170,0.14) 35%, transparent 75%)`,
              animation: 'j2PrestigeBreathe 4.2s ease-in-out infinite',
              mixBlendMode: 'screen',
            }}
          />
        )}

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

        <div style={{ transition: 'opacity 0.12s', opacity: fading ? 0 : 1, position: 'relative' }}>
          <div
            style={{
              fontFamily: FONT_EDITORIAL,
              fontWeight: 500,
              fontSize: 128,
              lineHeight: 0.9,
              letterSpacing: '-0.025em',
              marginBottom: 8,
              color: valueColor,
              textShadow: view === 'daily' && streak > 0 ? '0 0 28px rgba(196,145,95,0.20)' : undefined,
            }}
          >
            {cellValue}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.44)',
            }}
          >
            {cellLabel}
          </div>
          {cellSub && (
            <div
              style={{
                marginTop: 2,
                fontSize: 12,
                letterSpacing: '0.01em',
                color: isPersonalBest && view === 'daily' ? COPPER : 'rgba(255,255,255,0.44)',
              }}
            >
              {cellSub}
            </div>
          )}
        </div>

        {/* Cycle hint — sits on the same baseline as the kicker date so it
            reads as a quiet affordance rather than chrome on the numeral. */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 4,
            right: 0,
            fontSize: 11,
            color: 'rgba(255,255,255,0.22)',
            letterSpacing: '0.1em',
          }}
        >
          ⇄
        </span>
      </button>

      {/* Roulette slot — right half */}
      {rouletteSlot && (
        <div style={{ flex: '0 0 50%', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', paddingTop: 8, position: 'relative', zIndex: 45 }}>
          {rouletteSlot}
        </div>
      )}
      </div>
    </button>
  );
}
