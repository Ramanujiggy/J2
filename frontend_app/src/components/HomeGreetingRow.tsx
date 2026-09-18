// HomeGreetingRow — the only chrome above the hero.
//
// Greeting + today's date, and the die button on the right. Deliberately
// carries NO number: the record count, tenure and streak that used to live
// here moved to Profile. Today's date is the one number home is allowed.

import { COPPER } from '../lib/theme.ts';

interface Props {
  /** The die / Sharpen control. Rendered as-is on the right. */
  rouletteSlot?: React.ReactNode;
  /** Injectable for tests; defaults to now. */
  now?: Date;
}

export default function HomeGreetingRow({ rouletteSlot, now }: Props) {
  const when = now ?? new Date();
  const hours = when.getHours();
  const greeting = hours < 12 ? 'Good morning' : hours < 17 ? 'Good afternoon' : 'Good evening';
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(when);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        padding: '0 4px',
      }}
    >
      {/* minWidth:0 lets the greeting compress rather than shoving the die
          button — which becomes a fixed-width card when opened — off-screen. */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: COPPER,
          }}
        >
          {greeting}
        </div>
        {/* 0.46 alpha is the contrast floor for small text — see the handoff's
            contrast rule. Do not dim this to 0.26. */}
        <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.46)', marginTop: 5 }}>
          {dateLabel}
        </div>
      </div>
      <div style={{ flex: 'none' }}>{rouletteSlot}</div>
    </div>
  );
}
