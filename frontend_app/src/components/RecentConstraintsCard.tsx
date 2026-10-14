// RecentConstraintsCard — right-rail card on Path Ahead (desktop). Aggregates
// canonical_constraint_ids + user_constraint_ids from sessions in the last
// 30 days, resolves IDs to names via the canonical/user constraint hooks,
// and shows the top 5 by session-count. No data → don't render.

import { useMemo } from 'react';
import type { SessionSummary } from '../types/api.ts';
import { useCanonicalConstraints } from '../hooks/useCanonicalConstraints.ts';
import { useUserConstraints } from '../hooks/useUserConstraints.ts';
import { PALE_YELLOW, COPPER, FONT_EDITORIAL, TEXT_TERTIARY } from '../lib/theme.ts';

interface Props {
  sessions: SessionSummary[];
  softCardStyle: React.CSSProperties;
}

interface ConstraintRow {
  name: string;
  count: number;
}

const WINDOW_DAYS = 30;
const MAX_ROWS = 5;

export default function RecentConstraintsCard({ sessions, softCardStyle }: Props) {
  const { byId: canonicalById } = useCanonicalConstraints();
  const { byId: userById } = useUserConstraints();

  const rows: ConstraintRow[] = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const counts = new Map<string, number>();
    for (const s of sessions) {
      if (s.date < cutoffStr) continue;
      const seen = new Set<string>();
      for (const id of s.canonical_constraint_ids ?? []) {
        const c = canonicalById.get(id);
        if (c && !seen.has(c.name)) {
          seen.add(c.name);
          counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
        }
      }
      for (const id of s.user_constraint_ids ?? []) {
        const c = userById.get(id);
        if (c && !seen.has(c.name)) {
          seen.add(c.name);
          counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
        }
      }
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, MAX_ROWS);
  }, [sessions, canonicalById, userById]);

  if (rows.length === 0) return null;

  const max = rows[0].count;

  return (
    <div style={{ ...softCardStyle, padding: 22 }}>
      <div className="j2-label-copper" style={{ marginBottom: 16 }}>◈ Recent constraints · 30 days</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rows.map(r => {
          const pct = (r.count / max) * 100;
          return (
            <div key={r.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <span
                  style={{
                    fontSize: 16, fontFamily: FONT_EDITORIAL, fontWeight: 600,
                    color: PALE_YELLOW,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  title={r.name}
                >
                  {r.name}
                </span>
                <span style={{ fontSize: 12, color: TEXT_TERTIARY, letterSpacing: '0.12em', flexShrink: 0 }}>
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
