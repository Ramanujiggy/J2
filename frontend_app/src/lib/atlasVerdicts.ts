// atlasVerdicts — the sentence beside the instrument.
//
// The desktop handoff specifies hand-authored verdicts ("the instrument
// shows, the sentence says"). That works for a prototype with one fictional
// user; in production every practitioner has a different shape and nobody
// is writing sentences for them. So the facts are computed and phrased in
// the handoff's voice — which the mission explicitly allows: real math is
// welcome *behind* the corpus, never in front of it.
//
// Rules these follow:
//   • Never claim a trend the data does not support. Below the confidence
//     floor the sentence describes rather than concludes.
//   • The emphasised clause is the finding, and it must be literally true.
//   • No praise, no encouragement, no "keep it up". The mirror does not
//     congratulate.

import { PILLAR_ORDER, dominantPillar, pillarLabel } from './prismGeometry.ts';
import type { Pillar, PillarDistribution, SessionSummary } from '../types/api.ts';

export interface Verdict {
  /** Plain lead-in, rendered in the secondary tier. */
  lead: string;
  /** The finding — rendered champagne. Always literally true. */
  emphasis: string;
  /** Optional tail after the emphasis. */
  tail?: string;
}

/** Fewer sessions than this and no shape claim is honest. */
const MIN_SESSIONS_FOR_TREND = 12;

const SPELLED = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen', 'Twenty',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function spell(n: number): string {
  if (n <= 20) return SPELLED[n] ?? String(n);
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)]!;
    const r = n % 10;
    return r === 0 ? t : `${t}-${SPELLED[r]!.toLowerCase()}`;
  }
  return String(n);
}

/** Share of total weight per pillar, largest first. */
export function pillarShares(shapes: PillarDistribution[]): { pillar: Pillar; share: number }[] {
  const acc = new Map<Pillar, number>();
  for (const d of shapes) {
    for (const p of PILLAR_ORDER) acc.set(p.value, (acc.get(p.value) ?? 0) + (d[p.value] ?? 0));
  }
  const total = [...acc.values()].reduce((a, b) => a + b, 0) || 1;
  return PILLAR_ORDER
    .map(p => ({ pillar: p.value, share: (acc.get(p.value) ?? 0) / total }))
    .sort((a, b) => b.share - a.share);
}

/** Roughly-a-quarter, a third, and so on — a share said the way a person
 *  would. Nothing below 22% gets a fraction: five pillars split evenly is
 *  20% each, so "about a fifth" would dress up an even spread as a finding. */
function shareInWords(share: number): string | null {
  if (share >= 0.45) return 'nearly half';
  if (share >= 0.30) return 'about a third';
  if (share >= 0.22) return 'nearly a quarter';
  return null;
}

/** Overlay — what the whole stack says. */
export function overlayVerdict(shapes: PillarDistribution[], sessionCount: number): Verdict {
  if (sessionCount === 0) {
    return { lead: 'Nothing stacked yet.', emphasis: 'The shape arrives with the sessions.' };
  }
  const shares = pillarShares(shapes);
  const top = shares[0];
  const opening = `${spell(sessionCount)} ${sessionCount === 1 ? 'session' : 'sessions'}, one shape.`;

  if (!top || sessionCount < MIN_SESSIONS_FOR_TREND) {
    return {
      lead: opening,
      emphasis: 'Too early to call it a game',
      tail: ' — the shape is still mostly which classes you happened to attend.',
    };
  }

  const words = shareInWords(top.share);
  return {
    lead: opening,
    emphasis: `${pillarLabel(top.pillar)} has carried the most weight`,
    tail: words ? ` — ${words} of your mat time.` : '.',
  };
}

/** By week — does the shape settle, or is every week a different person? */
export function byWeekVerdict(weeks: PillarDistribution[][]): Verdict {
  const populated = weeks.filter(w => w.length > 0);
  if (populated.length < 6) {
    return {
      lead: `${populated.length} ${populated.length === 1 ? 'week' : 'weeks'} on the mat.`,
      emphasis: 'Not enough weeks yet to see whether the shape steadies.',
    };
  }

  // Volatility = mean absolute change in the dominant pillar's share,
  // week to week. Low means the weeks look like the same person.
  const shares = populated.map(w => pillarShares(w));
  let drift = 0;
  for (let i = 1; i < shares.length; i++) {
    const prev = shares[i - 1]!, cur = shares[i]!;
    const prevTop = prev[0]!.pillar;
    const curForPrevTop = cur.find(s => s.pillar === prevTop)?.share ?? 0;
    drift += Math.abs(prev[0]!.share - curForPrevTop);
  }
  drift /= (shares.length - 1);

  const half = Math.floor(shares.length / 2);
  const earlyDrift = shares.slice(0, half);
  const lateDrift = shares.slice(half);
  const spread = (set: typeof shares) => {
    let d = 0;
    for (let i = 1; i < set.length; i++) {
      const prevTop = set[i - 1]![0]!.pillar;
      d += Math.abs(set[i - 1]![0]!.share - (set[i]!.find(s => s.pillar === prevTop)?.share ?? 0));
    }
    return set.length > 1 ? d / (set.length - 1) : 0;
  };

  const lead = `${populated.length} weeks on the mat.`;
  if (spread(lateDrift) < spread(earlyDrift) * 0.7) {
    return { lead, emphasis: 'The shape steadies later on', tail: ' — the weeks stop looking like different people.' };
  }
  if (drift > 0.25) {
    return { lead, emphasis: 'No two weeks look alike yet', tail: ' — the shape is still being set by the class, not by you.' };
  }
  return { lead, emphasis: 'The shape holds week to week', tail: '.' };
}

/** Ghost — this year against a past one. */
export function ghostVerdict(
  current: PillarDistribution[],
  past: PillarDistribution[],
  pastLabel: string,
): Verdict {
  if (past.length === 0) {
    return {
      lead: 'Nothing to compare against yet.',
      emphasis: 'The ghost appears once you have a full year behind you.',
    };
  }
  const now = pillarShares(current);
  const then = pillarShares(past);
  const deltas = now.map(n => ({
    pillar: n.pillar,
    delta: n.share - (then.find(t => t.pillar === n.pillar)?.share ?? 0),
  })).sort((a, b) => b.delta - a.delta);

  const risen = deltas.filter(d => d.delta > 0.04).slice(0, 2);
  const fallen = deltas[deltas.length - 1];

  if (risen.length === 0 && (!fallen || fallen.delta > -0.04)) {
    return {
      lead: `Against ${pastLabel},`,
      emphasis: 'your shape has barely moved',
      tail: ' — the same game, played longer.',
    };
  }

  const rising = risen.map(r => pillarLabel(r.pillar)).join(' and ');
  return {
    lead: `Your shape moved toward`,
    emphasis: rising || pillarLabel(deltas[0]!.pillar),
    tail: fallen && fallen.delta < -0.06
      ? ` since ${pastLabel} — the ${pillarLabel(fallen.pillar).toLowerCase()} year is over.`
      : ` since ${pastLabel}.`,
  };
}

/** Hours per pillar, for the quiet bars beside the Overlay radar. */
export function hoursPerPillar(sessions: SessionSummary[]): { pillar: Pillar; label: string; hours: number; pct: number }[] {
  const acc = new Map<Pillar, number>();
  for (const s of sessions) {
    const dist = s.pillar_distribution;
    const hours = (s.duration ?? 0) / 60;
    if (dist) {
      const total = PILLAR_ORDER.reduce((sum, p) => sum + (dist[p.value] ?? 0), 0);
      if (total > 0) {
        for (const p of PILLAR_ORDER) {
          acc.set(p.value, (acc.get(p.value) ?? 0) + hours * ((dist[p.value] ?? 0) / total));
        }
        continue;
      }
    }
    // No distribution recorded — attribute to the dominant pillar if we can
    // infer one, otherwise the session contributes to no pillar rather than
    // being spread evenly, which would invent a shape.
    const p = dominantPillar(dist);
    if (p) acc.set(p, (acc.get(p) ?? 0) + hours);
  }
  const rows = PILLAR_ORDER.map(p => ({
    pillar: p.value, label: p.label, hours: acc.get(p.value) ?? 0,
  })).sort((a, b) => b.hours - a.hours);
  const peak = rows[0]?.hours || 1;
  return rows.map(r => ({ ...r, pct: Math.round((r.hours / peak) * 100) }));
}
