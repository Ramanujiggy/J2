// AtlasInstruments — the prism, three ways.
//
// One segmented control drives the page body. Overlay is the default and
// the honest one: every session stacked translucent, so the object reads
// as many sessions rather than one carved shape. By week breaks it into
// small multiples; Ghost sets this year against a past one.
//
// "The study" and "Density" are named in the handoff but never drawn — the
// prototype renders them at half opacity and says so. They stay stubs
// rather than being invented; the handoff is explicit about not inventing
// the surfaces its toasts mark as out of scope.
//
// Beside Overlay sit the hours-per-pillar bars, which also absorbed the
// volume / gi-no-gi / format views the old Prism deck carried — the
// measurements survive, they just stopped needing their own tabs.
//
// Every verdict is computed (lib/atlasVerdicts.ts), never hand-authored:
// a fixed sentence would be a lie for all but one user.

import { useMemo } from 'react';
import {
  PILLAR_ORDER, prismVertices, toPolygonPoints, distributionPoints, peakWeight, vertexAngle,
} from '../../lib/prismGeometry.ts';
import {
  overlayVerdict, byWeekVerdict, ghostVerdict, hoursPerPillar, type Verdict,
} from '../../lib/atlasVerdicts.ts';
import { COPPER, PALE_YELLOW, FONT_EDITORIAL } from '../../lib/theme.ts';
import type { PillarDistribution, SessionSummary } from '../../types/api.ts';

export type Instrument = 'overlay' | 'byweek' | 'ghost' | 'study' | 'density';

export const INSTRUMENTS: { id: Instrument; label: string; stub?: boolean }[] = [
  { id: 'overlay', label: 'Overlay' },
  { id: 'byweek',  label: 'By week' },
  { id: 'ghost',   label: 'Ghost' },
  { id: 'study',   label: 'The study',  stub: true },
  { id: 'density', label: 'Density',    stub: true },
];

const TEXT_SECONDARY = 'rgba(255,255,255,0.66)';
const TEXT_TERTIARY  = 'rgba(255,255,255,0.46)';

/** The web behind a radar: three rings and five spokes. */
function Web({ cx, cy, r, labels }: { cx: number; cy: number; r: number; labels?: boolean }) {
  return (
    <>
      {[0.34, 0.67, 1].map(f => (
        <polygon
          key={f}
          points={toPolygonPoints(prismVertices(cx, cy, r * f, 0))}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
        />
      ))}
      {PILLAR_ORDER.map((p, i) => {
        const a = vertexAngle(i);
        return (
          <line
            key={p.value}
            x1={cx} y1={cy}
            x2={(cx + Math.cos(a) * r).toFixed(1)}
            y2={(cy + Math.sin(a) * r).toFixed(1)}
            stroke="rgba(255,255,255,0.06)"
          />
        );
      })}
      {/* Vertex labels live ONLY here, never on home's portrait. */}
      {labels && PILLAR_ORDER.map((p, i) => {
        const a = vertexAngle(i);
        return (
          <text
            key={`l-${p.value}`}
            x={(cx + Math.cos(a) * (r + 24)).toFixed(0)}
            y={(cy + Math.sin(a) * (r + 24) + 3).toFixed(0)}
            fill="rgba(255,255,255,0.46)"
            fontSize={10.5}
            fontWeight={700}
            textAnchor="middle"
            fontFamily="Plus Jakarta Sans"
          >
            {p.label.toUpperCase()}
          </text>
        );
      })}
    </>
  );
}

function VerdictLine({ verdict, maxWidth = 520 }: { verdict: Verdict; maxWidth?: number }) {
  return (
    <p
      style={{
        fontFamily: FONT_EDITORIAL, fontSize: 20, lineHeight: 1.5,
        color: TEXT_SECONDARY, marginTop: 24, maxWidth, textWrap: 'pretty',
      }}
    >
      {verdict.lead}{' '}
      <b style={{ color: PALE_YELLOW, fontWeight: 600 }}>{verdict.emphasis}</b>
      {verdict.tail}
    </p>
  );
}

interface Props {
  instrument: Instrument;
  /** Newest-first distributions for the current window. */
  shapes: PillarDistribution[];
  sessions: SessionSummary[];
  /** Distributions grouped into weeks, oldest first. */
  weeks: { label: string; shapes: PillarDistribution[] }[];
  /** A past year's shapes for the ghost, with its label. */
  ghost: { label: string; shapes: PillarDistribution[] } | null;
  onStub: (label: string) => void;
}

export default function AtlasInstruments({ instrument, shapes, sessions, weeks, ghost }: Props) {
  const scale = useMemo(() => peakWeight(shapes), [shapes]);

  if (instrument === 'byweek') {
    const populated = weeks.filter(w => w.shapes.length > 0);
    return (
      <div>
        <div className="j2-atlas-smgrid">
          {populated.map(w => {
            const weekScale = peakWeight(w.shapes);
            return (
              <div key={w.label} style={{ textAlign: 'center' }}>
                <svg viewBox="0 0 88 88" style={{ width: '100%', maxWidth: 104, height: 'auto' }} aria-hidden>
                  <Web cx={44} cy={44} r={32} />
                  {w.shapes.map((d, i) => (
                    <polygon
                      key={i}
                      points={distributionPoints(d, 44, 44, 32, weekScale)}
                      fill="rgba(196,145,95,0.16)"
                      stroke="rgba(242,228,168,0.55)"
                      strokeWidth={1.1}
                      strokeLinejoin="round"
                    />
                  ))}
                </svg>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.26)', marginTop: 4 }}>
                  {w.label}
                </div>
              </div>
            );
          })}
        </div>
        <VerdictLine verdict={byWeekVerdict(weeks.map(w => w.shapes))} />
      </div>
    );
  }

  if (instrument === 'ghost') {
    // Each year is summed into one polygon and scaled against its own peak,
    // so the comparison is about SHAPE, not volume — a year with twice the
    // sessions shouldn't simply draw twice as large.
    const sum = (set: PillarDistribution[]): PillarDistribution => {
      const acc = { standup: 0, passing: 0, pins: 0, submissions: 0, guard: 0 } as PillarDistribution;
      for (const d of set) for (const p of PILLAR_ORDER) acc[p.value] = (acc[p.value] ?? 0) + (d[p.value] ?? 0);
      return acc;
    };
    const nowPoly = shapes.length ? distributionPoints(sum(shapes), 110, 110, 80, peakWeight([sum(shapes)])) : null;
    const ghostPoly = ghost?.shapes.length
      ? distributionPoints(sum(ghost.shapes), 110, 110, 80, peakWeight([sum(ghost.shapes)]))
      : null;
    return (
      <div className="j2-atlas-inst">
        <svg width={420} height={420} viewBox="0 0 220 220" style={{ flex: 'none', overflow: 'visible', maxWidth: '100%' }} aria-hidden>
          <Web cx={110} cy={110} r={80} labels />
          {ghostPoly && (
            <polygon points={ghostPoly} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.2} strokeDasharray="4 4" strokeLinejoin="round" />
          )}
          {nowPoly && (
            <polygon points={nowPoly} fill="rgba(196,145,95,0.14)" stroke={COPPER} strokeWidth={1.8} strokeLinejoin="round" />
          )}
        </svg>
        <div style={{ flex: '1 1 320px', maxWidth: 480, paddingTop: 40 }}>
          <div style={{ display: 'flex', gap: 18, fontSize: 11.5, color: TEXT_SECONDARY, alignItems: 'center' }}>
            <span><i style={{ display: 'inline-block', width: 16, borderTop: `2px solid ${COPPER}`, marginRight: 7, verticalAlign: 'middle' }} />This year</span>
            {ghost && (
              <span><i style={{ display: 'inline-block', width: 16, borderTop: '1px dashed rgba(255,255,255,0.45)', marginRight: 7, verticalAlign: 'middle' }} />{ghost.label} · the ghost</span>
            )}
          </div>
          <VerdictLine verdict={ghostVerdict(shapes, ghost?.shapes ?? [], ghost?.label ?? 'last year')} maxWidth={480} />
        </div>
      </div>
    );
  }

  // Overlay — the default.
  const outline = toPolygonPoints(prismVertices(110, 110, 80, 0));
  const bars = hoursPerPillar(sessions);
  return (
    <div className="j2-atlas-inst">
      <svg width={420} height={420} viewBox="0 0 220 220" style={{ flex: 'none', overflow: 'visible', maxWidth: '100%' }} aria-hidden>
        <Web cx={110} cy={110} r={80} labels />
        <polygon points={outline} fill="none" stroke="rgba(242,228,168,0.13)" strokeWidth={1.2} />
        {shapes.map((d, i) => (
          <polygon
            key={i}
            points={distributionPoints(d, 110, 110, 80, scale)}
            fill="rgba(196,145,95,0.06)"
            stroke="rgba(196,145,95,0.102)"
            strokeLinejoin="round"
          />
        ))}
      </svg>

      <div style={{ flex: '1 1 320px', maxWidth: 520 }}>
        <VerdictLine verdict={overlayVerdict(shapes, shapes.length)} />

        <div style={{ marginTop: 22, maxWidth: 440 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: TEXT_TERTIARY, marginBottom: 8 }}>
            Hours per pillar
          </div>
          {bars.map(row => (
            <div key={row.pillar} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ width: 100, flex: 'none', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: TEXT_TERTIARY }}>
                {row.label}
              </span>
              <span style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.08)', position: 'relative' }}>
                <i style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${row.pct}%`, background: COPPER }} />
              </span>
              <span style={{ width: 52, flex: 'none', textAlign: 'right', fontFamily: FONT_EDITORIAL, fontSize: 18, color: PALE_YELLOW }}>
                {row.hours >= 10 ? row.hours.toFixed(0) : row.hours.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
