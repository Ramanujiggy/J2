import { COPPER, FONT_EDITORIAL } from '../lib/theme.ts';
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
  const narrative = windowStats.topTagLabel ? (() => {
    const { topTagLabel, topTagCount, count, tag2Label } = windowStats;
    const pct = count > 0 ? topTagCount / count : 0;
    if (tag2Label && pct < 0.7) {
      return { before: 'Splitting time between ', h1: topTagLabel!, join: ' and ', h2: tag2Label };
    } else if (pct === 1 && count > 1) {
      return { before: `All ${count} sessions went into `, h1: topTagLabel!, join: null, h2: null };
    } else {
      return { before: 'Recent sessions have been leaning into ', h1: topTagLabel!, join: null, h2: null };
    }
  })() : null;

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Copper hairline divider */}
      <div style={{ width: 40, height: 1, backgroundColor: 'rgba(196,145,95,0.25)', marginBottom: 10 }} />

      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.28)',
          marginBottom: 6,
        }}
      >
        Training Telemetry
      </div>

      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.50)', marginBottom: 4 }}>
        <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.72)' }}>{windowStats.count}</span>
        {' session'}{windowStats.count !== 1 ? 's' : ''}
        <span style={{ color: 'rgba(255,255,255,0.20)', margin: '0 6px' }}>·</span>
        <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.72)' }}>{formatDuration(windowStats.totalMinutes)}</span>
        {' total'}
      </div>

      {narrative && (
        <p style={{
          fontSize: 15,
          fontFamily: FONT_EDITORIAL,
          fontStyle: 'italic',
          color: 'rgba(255,255,255,0.50)',
          margin: 0,
          lineHeight: 1.45,
        }}>
          {narrative.before}
          <strong style={{ color: COPPER, fontWeight: 600, fontStyle: 'normal' }}>{narrative.h1}</strong>
          {narrative.join && narrative.h2 ? (
            <>{narrative.join}<strong style={{ color: COPPER, fontWeight: 600, fontStyle: 'normal' }}>{narrative.h2}</strong></>
          ) : null}
          {'.'}
        </p>
      )}
    </div>
  );
}
