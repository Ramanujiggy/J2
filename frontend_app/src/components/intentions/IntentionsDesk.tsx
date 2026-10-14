// IntentionsDesk — what you chose to work on, and everything that touched it.
//
// Left: the active intention, the eras track for this year, the intentions
// that already ran, and the Plus gate. Right: the thread — the entries that
// attached themselves — with the citation card at the very bottom.
//
// There is no separate thread page on desktop: the thread lives beside the
// intention. The routed /intentions/:id/journal survives for mobile, which
// still navigates there from the home hero.
//
// The citation card is the ONLY external-link surface in the app. It is a
// citation in service of study, at the bottom of the thread, never an ad
// and never near the user's own writing.

import { useMemo } from 'react';
import StudyGlyph from './StudyGlyph.tsx';
import { sessionTouchesHeading } from '../../lib/analyticsUtils.ts';
import { dominantPillar, pillarLabel } from '../../lib/prismGeometry.ts';
import { toDateString, addDays } from '../../lib/sessionUtils.ts';
import { excerptOf } from '../../lib/homeViewModel.ts';
import { COPPER, PALE_YELLOW, SAGE, BRAND_ORANGE, FONT_EDITORIAL, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY, TEXT_HINT } from '../../lib/theme.ts';
import type { Intention, SessionSummary } from '../../types/api.ts';

const HAIRLINE       = '1px solid rgba(255,255,255,0.06)';
const CARD_GRADIENT  = 'radial-gradient(120% 130% at 20% -10%, #1d3b2b 0%, #14291e 55%, #0f2016 100%)';

const LABEL: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700,
  letterSpacing: '0.15em', textTransform: 'uppercase',
  color: TEXT_TERTIARY,
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ORDINAL_WEEK = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];

function weeksSince(startStr: string): number {
  const start = new Date(startStr.slice(0, 10) + 'T00:00:00').getTime();
  return Math.floor((Date.now() - start) / (7 * 86_400_000)) + 1;
}

function sessionDate(s: SessionSummary): string {
  return (typeof s.date === 'string' ? s.date : toDateString(new Date(s.date))).slice(0, 10);
}

/** Sessions logged inside an intention's window that touch its heading. */
function attachedSessions(intention: Intention, sessions: SessionSummary[]): SessionSummary[] {
  const start = intention.week_start.slice(0, 10);
  return sessions
    .filter(s => {
      if (sessionDate(s) < start) return false;
      return intention.heading ? sessionTouchesHeading(s, intention.heading) : true;
    })
    .sort((a, b) => sessionDate(b).localeCompare(sessionDate(a)));
}

interface Props {
  intentions: Intention[];
  sessions: SessionSummary[];
  activeIntention: Intention | null;
  pastIntentions: Intention[];
  onOpenSession: (session: SessionSummary) => void;
  onOpenCreate: () => void;
  onOpenEdit: (intention: Intention) => void;
  /** Plus is not built. The gate renders; the CTA explains and stops. */
  onSeePlus: () => void;
}

export default function IntentionsDesk({
  sessions, activeIntention, pastIntentions,
  onOpenSession, onOpenCreate, onOpenEdit, onSeePlus,
}: Props) {
  const year = new Date().getFullYear();

  const thread = useMemo(
    () => (activeIntention ? attachedSessions(activeIntention, sessions) : []),
    [activeIntention, sessions],
  );

  // Which pillar the attached sessions kept landing on — the auto-attach
  // sentence's subject. Computed, never declared: they attached themselves.
  const studied = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of thread) {
      const p = dominantPillar(s.pillar_distribution);
      if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? { pillar: top[0] as Parameters<typeof pillarLabel>[0], count: top[1] } : null;
  }, [thread]);

  // Era segments for this year — one bar per intention window, the live one
  // lit. Positions are a fraction of the calendar year.
  const eras = useMemo(() => {
    const all = [...(activeIntention ? [activeIntention] : []), ...pastIntentions];
    const yearStart = new Date(year, 0, 1).getTime();
    const yearLen = new Date(year + 1, 0, 1).getTime() - yearStart;
    return all.map(i => {
      const start = new Date(i.week_start.slice(0, 10) + 'T00:00:00').getTime();
      const endStr = addDays(i.week_start.slice(0, 10), (i.duration_days ?? 7) - 1);
      const end = new Date(endStr + 'T00:00:00').getTime();
      return {
        id: i.id,
        live: i.id === activeIntention?.id,
        left: Math.max(0, Math.min(100, ((start - yearStart) / yearLen) * 100)),
        width: Math.max(1.5, Math.min(100, ((end - start) / yearLen) * 100)),
      };
    }).filter(e => e.left < 100);
  }, [activeIntention, pastIntentions, year]);

  return (
    <div className="j2-desk-page">
      <div className="j2-intentions-body">
        {/* ── The intention ────────────────────────────────────────── */}
        <div className="j2-intentions-col">
          <div style={LABEL}>Intentions</div>
          <h1
            style={{
              fontFamily: FONT_EDITORIAL, fontSize: 33, fontWeight: 600,
              color: PALE_YELLOW, letterSpacing: '-0.01em', margin: '8px 0 0',
            }}
          >
            What you chose to work on
          </h1>

          {activeIntention ? (
            <div
              style={{
                marginTop: 26, borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.1)',
                background: CARD_GRADIENT,
                padding: '26px 28px',
              }}
            >
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: COPPER }}>
                Active · {ORDINAL_WEEK[Math.min(8, weeksSince(activeIntention.week_start))] ?? ''} week
              </div>
              <button
                type="button"
                onClick={() => onOpenEdit(activeIntention)}
                style={{
                  display: 'block', textAlign: 'left', width: '100%',
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontFamily: FONT_EDITORIAL, fontSize: 26, lineHeight: 1.3, fontWeight: 600,
                  color: TEXT_PRIMARY, marginTop: 12, textWrap: 'pretty',
                }}
              >
                {activeIntention.intent_label}
              </button>
              <div style={{ fontSize: 12.5, color: TEXT_TERTIARY, marginTop: 12 }}>
                Set {new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' })
                  .format(new Date(activeIntention.week_start.slice(0, 10) + 'T00:00:00'))}
                {' · '}
                {thread.length} {thread.length === 1 ? 'entry has' : 'entries have'} touched it
              </div>

              {studied && (
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    marginTop: 20, paddingTop: 18, borderTop: HAIRLINE,
                    fontSize: 13, color: TEXT_SECONDARY,
                  }}
                >
                  <StudyGlyph pillar={studied.pillar} size={30} />
                  <span>
                    {studied.count} {studied.count === 1 ? 'session has' : 'sessions have'} studied{' '}
                    <b style={{ color: PALE_YELLOW, fontWeight: 600 }}>{pillarLabel(studied.pillar)}</b>{' '}
                    since you set this. They attached themselves.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenCreate}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                marginTop: 26, borderRadius: 16,
                border: '1px dashed rgba(255,255,255,0.14)',
                background: 'none', padding: '26px 28px', cursor: 'pointer',
              }}
            >
              <span style={{ display: 'block', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: COPPER }}>
                Nothing active
              </span>
              <span
                style={{
                  display: 'block', fontFamily: FONT_EDITORIAL, fontSize: 26,
                  lineHeight: 1.3, fontWeight: 600, color: TEXT_PRIMARY, marginTop: 12,
                }}
              >
                Name one thing to work on
              </span>
              <span style={{ display: 'block', fontSize: 12.5, color: TEXT_TERTIARY, marginTop: 12 }}>
                Sessions attach themselves when the study matches. →
              </span>
            </button>
          )}

          {/* The eras */}
          {eras.length > 0 && (
            <>
              <div style={{ ...LABEL, marginTop: 34 }}>The eras · {year}</div>
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  {MONTHS.map(m => (
                    <span key={m} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: TEXT_HINT }}>
                      {m}
                    </span>
                  ))}
                </div>
                <div style={{ position: 'relative', height: 14, borderRadius: 999, background: 'rgba(255,255,255,0.05)' }}>
                  {eras.map(e => (
                    <span
                      key={e.id}
                      style={{
                        position: 'absolute', top: 3, bottom: 3,
                        left: `${e.left}%`, width: `${e.width}%`,
                        borderRadius: 999,
                        background: e.live ? COPPER : 'rgba(196,145,95,0.55)',
                        boxShadow: e.live ? '0 0 12px rgba(196,145,95,0.5)' : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* What already ran */}
          <div style={{ marginTop: 14 }}>
            {pastIntentions.map(i => {
              const attached = attachedSessions(i, sessions);
              const start = new Date(i.week_start.slice(0, 10) + 'T00:00:00');
              const endStr = addDays(i.week_start.slice(0, 10), (i.duration_days ?? 7) - 1);
              const end = new Date(endStr + 'T00:00:00');
              const span = start.getMonth() === end.getMonth()
                ? MONTHS[start.getMonth()]
                : `${MONTHS[start.getMonth()]} – ${MONTHS[end.getMonth()]}`;
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => onOpenEdit(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 20, width: '100%',
                    textAlign: 'left', padding: '17px 0', borderTop: HAIRLINE,
                    background: 'none', border: 'none', borderTopWidth: 1,
                    borderTopStyle: 'solid', borderTopColor: 'rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ flex: 1, fontFamily: FONT_EDITORIAL, fontSize: 19, color: TEXT_SECONDARY, textWrap: 'pretty' }}>
                    {i.intent_label}
                  </span>
                  <span style={{ width: 200, flex: 'none', fontSize: 11, color: TEXT_TERTIARY, textAlign: 'right' }}>
                    {span} · {attached.length} {attached.length === 1 ? 'entry' : 'entries'}
                    {i.heading ? ` · ${i.heading}` : ''}
                  </span>
                </button>
              );
            })}

            {/* The gate. Free is one active intention; writing, memories and
                seals are never gated — this gates parallelism and archive. */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '17px 0', borderTop: '1px dashed rgba(255,255,255,0.14)',
                color: TEXT_TERTIARY, fontSize: 13,
              }}
            >
              <span
                style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
                  padding: '4px 9px', borderRadius: 12,
                  background: 'rgba(196,145,95,0.18)', color: COPPER,
                }}
              >
                Plus
              </span>
              <span>A second intention alongside this one, and the full archive.</span>
              <button
                type="button"
                onClick={onSeePlus}
                style={{
                  marginLeft: 'auto', fontSize: 12.5, fontWeight: 600,
                  color: BRAND_ORANGE, background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                See Plus →
              </button>
            </div>
          </div>
        </div>

        <div className="j2-intentions-rule" aria-hidden />

        {/* ── The thread ───────────────────────────────────────────── */}
        <div className="j2-intentions-col" style={{ paddingTop: 10 }}>
          <div style={LABEL}>
            The thread{activeIntention ? ` · ${thread.length} ${thread.length === 1 ? 'entry' : 'entries'}` : ''}
          </div>

          <div style={{ marginTop: 14 }}>
            {thread.length === 0 ? (
              <div style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 17, color: TEXT_TERTIARY, marginTop: 20, textWrap: 'pretty' }}>
                {activeIntention
                  ? 'Nothing has attached yet. It will, the next time the study matches.'
                  : 'Declare an intention and the entries that touch it collect here.'}
              </div>
            ) : thread.map(s => {
              const d = new Date(sessionDate(s) + 'T00:00:00');
              const text = excerptOf(s, 130);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpenSession(s)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 18, width: '100%',
                    textAlign: 'left', padding: '16px 0', borderTop: HAIRLINE,
                    background: 'none', border: 'none', borderTopWidth: 1,
                    borderTopStyle: 'solid', borderTopColor: 'rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ width: 72, flex: 'none', lineHeight: 1.15 }}>
                    <span style={{ display: 'block', fontFamily: FONT_EDITORIAL, fontSize: 17, color: SAGE, whiteSpace: 'nowrap' }}>
                      {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d)}
                    </span>
                    <span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: TEXT_TERTIARY, marginTop: 3 }}>
                      {new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d)}
                    </span>
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: SAGE, marginBottom: 6 }}>
                      Session
                    </span>
                    <span
                      style={{
                        display: 'block', fontFamily: FONT_EDITORIAL, fontSize: 16,
                        lineHeight: 1.5, color: TEXT_SECONDARY, textWrap: 'pretty',
                      }}
                    >
                      {text ?? 'Logged, but nothing written yet.'}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* The citation — the only external link in the app */}
          {activeIntention && (
            <button
              type="button"
              onClick={onSeePlus}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                textAlign: 'left', marginTop: 26, padding: '15px 17px',
                border: HAIRLINE, borderRadius: 10, background: 'none', cursor: 'pointer',
              }}
            >
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: TEXT_TERTIARY }}>
                  Studying this?
                </span>
                <span
                  style={{
                    display: 'block', fontFamily: FONT_EDITORIAL, fontSize: 17,
                    color: TEXT_SECONDARY, marginTop: 5, textWrap: 'pretty',
                  }}
                >
                  Instructional material on {activeIntention.heading ?? 'this position'} — the library
                </span>
              </span>
              <span aria-hidden style={{ color: COPPER }}>↗</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
