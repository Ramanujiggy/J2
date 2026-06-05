import { COPPER, FONT_EDITORIAL } from '../lib/theme.ts';
import { formatDuration } from '../lib/sessionUtils.ts';
import type { TelemetryResult } from '../lib/analyticsModels.ts';

interface Props {
  telemetry: TelemetryResult;
}

// Phrase the comparison delta as natural language. Bands are tuned so a
// noisy ±5% swing reads as "steady" rather than "down".
function describeDelta(delta: number | null, kind: 'sessions' | 'minutes'): string | null {
  if (delta == null) return null;
  const abs = Math.abs(delta);
  const direction = delta > 0 ? 'up' : 'down';
  const noun = kind === 'sessions' ? 'session count' : 'mat time';
  if (abs < 0.10) return `steady on ${noun}`;
  if (abs < 0.25) return `slightly ${direction} on ${noun}`;
  if (abs < 0.50) return `${direction} ${Math.round(abs * 100)}% on ${noun}`;
  return `${direction} ${Math.round(abs * 100)}% — a real swing in ${noun}`;
}

export default function PathAheadTelemetryCard({ telemetry }: Props) {
  const { acute, chronicPerWeek, sessionDelta, minutesDelta, hasBaseline } = telemetry;

  // Headline line — the acute snapshot. Always shown.
  const headline = (
    <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.50)', marginBottom: 6 }}>
      <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.78)' }}>{acute.count}</span>
      {' session'}{acute.count !== 1 ? 's' : ''}
      <span style={{ color: 'rgba(255,255,255,0.20)', margin: '0 6px' }}>·</span>
      <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.78)' }}>{formatDuration(acute.totalMinutes)}</span>
      {' this week'}
    </div>
  );

  // Pillar focus narrative — same shape as before but scoped to the 7d window.
  const pillarNarrative = acute.topPillarLabel ? (() => {
    const pct = acute.topPillarHours / Math.max(1, acute.topPillarHours + (acute.secondPillarLabel ? 1 : 0));
    void pct;
    if (acute.secondPillarLabel) {
      return { before: 'Splitting time between ', h1: acute.topPillarLabel, join: ' and ', h2: acute.secondPillarLabel };
    } else if (acute.count > 1) {
      return { before: `All ${acute.count} sessions went into `, h1: acute.topPillarLabel, join: null, h2: null };
    } else {
      return { before: 'Leaning into ', h1: acute.topPillarLabel, join: null, h2: null };
    }
  })() : null;

  // Comparison narrative — only when chronic has enough data to anchor it.
  // Prefer the more interpretable of the two deltas (mat time is usually more
  // sensitive than session count for users with consistent session length).
  const comparison = (() => {
    if (!hasBaseline) {
      return acute.count > 0
        ? "Still building your baseline — give it a few more weeks of training to compare against."
        : null;
    }
    const sessionPhrase = describeDelta(sessionDelta, 'sessions');
    const minutesPhrase = describeDelta(minutesDelta, 'minutes');
    // Use mat-time delta as the headline if it's bigger than the session
    // delta — captures intensity / duration changes the count would miss.
    const useMinutes =
      sessionPhrase == null ||
      (minutesDelta != null && sessionDelta != null && Math.abs(minutesDelta) > Math.abs(sessionDelta));
    const chosen = useMinutes ? minutesPhrase : sessionPhrase;
    if (!chosen) return null;
    const baseline = `Typical week (last 28d): ${chronicPerWeek.count.toFixed(1)} sessions, ${formatDuration(chronicPerWeek.totalMinutes)}.`;
    return { delta: chosen, baseline };
  })();

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Copper hairline divider */}
      <div style={{ width: 40, height: 1, backgroundColor: 'rgba(196,145,95,0.25)', marginBottom: 10 }} />

      {/* Eyebrow label + inline copper rule */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.28)',
          }}
        >
          Training Telemetry
        </span>
        <span
          style={{
            flex: 1,
            height: 1,
            backgroundColor: 'rgba(196,145,95,0.25)',
            borderRadius: 1,
          }}
        />
      </div>

      {headline}

      {pillarNarrative && (
        <p style={{
          fontSize: 18,
          fontFamily: FONT_EDITORIAL,
          fontStyle: 'italic',
          color: 'rgba(255,255,255,0.50)',
          margin: 0,
          marginBottom: comparison ? 8 : 0,
          lineHeight: 1.45,
        }}>
          {pillarNarrative.before}
          <strong style={{ color: COPPER, fontWeight: 600, fontStyle: 'normal' }}>{pillarNarrative.h1}</strong>
          {pillarNarrative.join && pillarNarrative.h2 ? (
            <>{pillarNarrative.join}<strong style={{ color: COPPER, fontWeight: 600, fontStyle: 'normal' }}>{pillarNarrative.h2}</strong></>
          ) : null}
          {'.'}
        </p>
      )}

      {comparison && typeof comparison !== 'string' && (
        <div style={{ marginTop: 4 }}>
          <p style={{
            fontSize: 14,
            color: 'rgba(255,255,255,0.65)',
            margin: 0,
            lineHeight: 1.45,
          }}>
            {comparison.delta}.
          </p>
          <p style={{
            fontSize: 11.5,
            color: 'rgba(255,255,255,0.32)',
            margin: 0,
            marginTop: 2,
            lineHeight: 1.4,
          }}>
            {comparison.baseline}
          </p>
        </div>
      )}

      {typeof comparison === 'string' && (
        <p style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.45)',
          margin: 0,
          marginTop: 4,
          lineHeight: 1.45,
          fontStyle: 'italic',
        }}>
          {comparison}
        </p>
      )}
    </div>
  );
}
