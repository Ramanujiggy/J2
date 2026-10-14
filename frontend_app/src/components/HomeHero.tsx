// HomeHero — "Your record" identity block. Shows the total session count
// (a number that only accrues, never resets) + tenure + streak pill.
// Replaces the previous streak-hero that led with the daily count.

import { COPPER, PALE_YELLOW, FONT_EDITORIAL, GLOW_SOFT, TEXT_TERTIARY, TEXT_HINT } from '../lib/theme.ts';

interface Props {
  totalSessions: number;
  tenure: string;
  streakDays: number;
  rouletteSlot?: React.ReactNode;
}

export default function HomeHero({
  totalSessions,
  tenure,
  streakDays,
  rouletteSlot,
}: Props) {
  const hours = new Date().getHours();
  const greeting = hours < 12 ? 'Good morning' : hours < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ padding: '0 4px 4px' }}>
      {/* Masthead — greeting + streak pill + Sharpen slot */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase' as const,
              color: COPPER,
            }}
          >
            {greeting}
          </div>
          <div style={{ fontSize: 13, color: TEXT_HINT, marginTop: 4 }}>
            {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {streakDays > 0 && (
            <span
              style={{
                padding: '7px 12px',
                fontSize: 13,
                fontWeight: 700,
                color: PALE_YELLOW,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 20,
                background: 'rgba(255,255,255,0.035)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8 8 4 10 4 14a8 8 0 0016 0c0-4-4-6-8-12z" fill="#DA7422" opacity={0.85} />
              </svg>
              {streakDays}
            </span>
          )}
          {rouletteSlot}
        </div>
      </div>

      {/* Record — the number that only accrues */}
      <div className="j2-label-micro" style={{ color: TEXT_TERTIARY }}>
        Your record
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10 }}>
        <span
          style={{
            fontFamily: FONT_EDITORIAL,
            fontSize: 52,
            lineHeight: 0.85,
            color: PALE_YELLOW,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            textShadow: GLOW_SOFT,
          }}
        >
          {totalSessions}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase' as const,
            color: TEXT_TERTIARY,
          }}
        >
          Sessions<br />remembered
        </span>
      </div>
      <div style={{ fontSize: 13, color: TEXT_HINT, marginTop: 12 }}>
        {tenure}
      </div>
    </div>
  );
}
