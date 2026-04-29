// TopPartnersCard — right-rail card on Path Ahead (desktop). Aggregates the
// `partners` freetext array across the last 30 days of sessions, shows the
// top 5 by frequency. Names are normalised (trimmed + lowercased) for
// counting; the original casing of the first occurrence is preserved for
// display. No data → don't render.

import { useMemo } from 'react';
import type { SessionSummary } from '../types/api.ts';
import { PALE_YELLOW, COPPER, FONT_EDITORIAL } from '../lib/theme.ts';

interface Props {
  sessions: SessionSummary[];
  softCardStyle: React.CSSProperties;
}

interface PartnerRow {
  display: string;
  count: number;
}

const WINDOW_DAYS = 30;
const MAX_ROWS = 5;

function aggregate(sessions: SessionSummary[]): PartnerRow[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const counts = new Map<string, { display: string; count: number }>();
  for (const s of sessions) {
    if (s.date < cutoffStr) continue;
    for (const raw of s.partners ?? []) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { display: trimmed, count: 1 });
    }
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display))
    .slice(0, MAX_ROWS);
}

export default function TopPartnersCard({ sessions, softCardStyle }: Props) {
  const rows = useMemo(() => aggregate(sessions), [sessions]);
  if (rows.length === 0) return null;

  const max = rows[0].count;

  return (
    <div style={{ ...softCardStyle, padding: 32 }}>
      <div className="j2-label-copper" style={{ marginBottom: 22 }}>◈ Top partners · 30 days</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rows.map(r => {
          const pct = (r.count / max) * 100;
          return (
            <div key={r.display} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 16, fontFamily: FONT_EDITORIAL, fontWeight: 600, color: PALE_YELLOW }}>
                  {r.display}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em' }}>
                  {r.count}×
                </span>
              </div>
              <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div
                  style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${pct}%`,
                    background: COPPER,
                    boxShadow: `0 0 8px ${COPPER}80`,
                    borderRadius: 2,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
