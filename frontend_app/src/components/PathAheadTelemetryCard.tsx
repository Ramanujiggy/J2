import { COPPER, FONT_EDITORIAL } from '../lib/theme.ts';
import { formatDuration } from '../lib/sessionUtils.ts';
import type { TelemetryResult } from '../lib/analyticsModels.ts';

interface Props {
  telemetry: TelemetryResult;
}

function describeWeek(delta: number | null, minutesDelta: number | null, topPillar: string | null, secondPillar: string | null): string | null {
  if (delta == null && minutesDelta == null) return null;
  const matPhrase = minutesDelta != null && Math.abs(minutesDelta) > 0.10
    ? (minutesDelta > 0 ? 'More mat time than a usual week' : 'A lighter week than usual')
    : 'A steady week on the mat';
  if (topPillar && secondPillar) {
    return `${matPhrase} — splitting rounds between ${topPillar.toLowerCase()} and ${secondPillar.toLowerCase()}.`;
  }
  if (topPillar) {
    return `${matPhrase} — leaning into ${topPillar.toLowerCase()}.`;
  }
  return `${matPhrase}.`;
}

export default function PathAheadTelemetryCard({ telemetry }: Props) {
  const { acute, sessionDelta, minutesDelta, hasBaseline } = telemetry;

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

  const qualitativeSentence = hasBaseline
    ? describeWeek(sessionDelta, minutesDelta, acute.topPillarLabel, acute.secondPillarLabel)
    : (acute.count > 0 ? "Still building your baseline — keep showing up." : null);

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Copper hairline divider */}
      <div style={{ width: 40, height: 1, backgroundColor: 'rgba(196,145,95,0.25)', marginBottom: 10 }} />

      {/* Eyebrow label + inline copper rule */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span className="j2-label-micro" style={{ whiteSpace: 'nowrap' }}>
          This week
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

      {qualitativeSentence && (
        <p style={{
          fontSize: 18,
          fontFamily: FONT_EDITORIAL,
          fontStyle: 'italic',
          color: 'rgba(255,255,255,0.50)',
          margin: 0,
          lineHeight: 1.45,
        }}>
          {qualitativeSentence}
        </p>
      )}
    </div>
  );
}
