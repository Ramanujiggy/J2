// Last30IntensityCard — 5-bucket bar chart of the last 30 days' session
// intensity. Migrated from the desktop PathAhead right rail when the IA
// tightened to "operational vs reflective" — looking back a month is
// reflective and now lives on the Atlas Analytics tab.
//
// Extracted from AtlasPage.tsx during the 2026-05-09 refactor pass.

import { CARD_BG, CARD_GLOW, CARD_GLOW_BORDER, INT_COLORS } from '../../lib/theme.ts';
import { toDateString } from '../../lib/sessionUtils.ts';
import type { SessionSummary } from '../../types/api.ts';

interface Props {
  sessions: SessionSummary[];
}

export default function Last30IntensityCard({ sessions }: Props) {
  const today = new Date();
  const thirtyMs = 30 * 86_400_000;
  const last30 = sessions.filter(s => {
    const key = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
    return today.getTime() - new Date(key + 'T00:00:00').getTime() < thirtyMs;
  });
  const dist = [1, 2, 3, 4, 5].map(i => last30.filter(s => (s.intensity ?? 3) === i).length);
  const max = Math.max(1, ...dist);

  return (
    <div
      style={{
        backgroundColor: CARD_BG,
        border: `1px solid ${CARD_GLOW_BORDER}`,
        boxShadow: CARD_GLOW,
        borderRadius: 16,
        padding: 32,
        marginBottom: 28,
      }}
    >
      <div className="j2-label-copper" style={{ marginBottom: 22 }}>◈ Last 30 days · intensity</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140 }}>
        {dist.map((n, i) => {
          const h = max ? (n / max) * 116 + 14 : 8;
          const c = INT_COLORS[(i + 1) as 1 | 2 | 3 | 4 | 5];
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ width: '100%', height: h, background: c, borderRadius: 5, boxShadow: `0 0 12px ${c}60` }} />
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)', letterSpacing: '0.1em' }}>{n}</div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 12, color: 'rgba(255,255,255,0.40)',
          letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 8,
        }}
      >
        <span>Light</span><span>Moderate</span><span>High</span>
      </div>
    </div>
  );
}
