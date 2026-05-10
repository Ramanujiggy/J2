// Session editorial detail view — desktop-only routed page at /journal/:id.
// Atelier-width magazine layout: hero header, 4-stat row, Prism + tags, notes
// blockquote, related sessions, prev/next by chronological order.

import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSessions } from '../context/SessionsContext.tsx';
import { usePendingSessions } from '../hooks/usePendingSessions.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import PageContent from '../components/PageContent.tsx';
import MiniPrism from '../components/charts/MiniPrism.tsx';
import { SKILL_TAGS, MONTH_NAMES } from '../lib/constants.ts';
import { toDateString, DAY_NAMES, INTENSITY_COLOR, SESSION_TYPE_LABELS, formatDuration, formatGiNogi } from '../lib/sessionUtils.ts';
import {
  PALE_YELLOW, COPPER, CARD_BG, FONT_EDITORIAL, INT_LABELS,
} from '../lib/theme.ts';
import type { SessionSummary } from '../types/api.ts';

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!isDesktop) navigate('/home', { replace: true });
  }, [isDesktop, navigate]);

  // Sessions come from the shared context (perf Tier 3 #8). The full session
  // history is needed so prev/next reaches the oldest entries and "similar
  // sessions" can surface old ones with matching focus — that matches the
  // context's default unfiltered fetch.
  const { sessions, loading, error: fetchError } = useSessions();

  const pendingSessions = usePendingSessions();
  const allSessions = useMemo(() => [...sessions, ...pendingSessions], [sessions, pendingSessions]);

  // Sorted ascending by date — needed for prev/next navigation
  const sorted = useMemo(() => {
    return [...allSessions].sort((a, b) => {
      const ak = typeof a.date === 'string' ? a.date.slice(0, 10) : toDateString(new Date(a.date));
      const bk = typeof b.date === 'string' ? b.date.slice(0, 10) : toDateString(new Date(b.date));
      return ak.localeCompare(bk);
    });
  }, [allSessions]);

  const session = useMemo(() => sorted.find(s => s.id === id) ?? null, [sorted, id]);
  const sessionIdx = useMemo(() => sorted.findIndex(s => s.id === id), [sorted, id]);
  const prev = sessionIdx > 0 ? sorted[sessionIdx - 1] : null;
  const next = sessionIdx >= 0 && sessionIdx < sorted.length - 1 ? sorted[sessionIdx + 1] : null;

  const related = useMemo(() => {
    if (!session) return [];
    const primary = session.tags?.[0];
    if (!primary) return [];
    return sorted
      .filter(s => s.id !== session.id && s.tags?.[0] === primary)
      .slice(-3) // latest 3 in chronological order
      .reverse();
  }, [sorted, session]);

  if (!isDesktop) return null;

  return (
    <PageContent ready={!loading} loadingMessages={['Opening the entry...', 'Smoothing the page...']}>
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 80px 104px' }}>

      {/* Back link */}
      <button
        onClick={() => navigate('/journal')}
        style={{
          fontSize: 15, fontWeight: 600,
          color: COPPER, borderBottom: `1px solid ${COPPER}40`,
          background: 'transparent', padding: 0,
          cursor: 'pointer', marginBottom: 48,
          display: 'inline-block',
        }}
      >
        ← Back to journal
      </button>

      {fetchError && <p style={{ fontSize: 13, color: '#F87171', marginBottom: 16 }}>{fetchError}</p>}

      {!session && !loading ? (
        <NotFound onBack={() => navigate('/journal')} />
      ) : session ? (
        <>
          <DetailHeader session={session} />
          <StatsRow session={session} />
          <PrismAndTags session={session} />
          {session.notes?.trim() && <ReflectionBlock notes={session.notes} />}
          {related.length > 0 && <RelatedRow sessions={related} onOpen={(sid) => navigate(`/journal/${sid}`)} />}
          <PrevNext
            prev={prev}
            next={next}
            onOpen={(sid) => navigate(`/journal/${sid}`)}
          />
        </>
      ) : null}

    </div>
    </PageContent>
  );
}

// ── Hero header ───────────────────────────────────────────────────────────

function DetailHeader({ session }: { session: SessionSummary }) {
  const dateStr = typeof session.date === 'string' ? session.date.slice(0, 10) : toDateString(new Date(session.date));
  const d = new Date(dateStr + 'T00:00:00');
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(d).toUpperCase();
  const primary = session.tags?.[0];
  const focusLabel = primary ? (SKILL_TAGS.find(t => t.value === primary)?.label ?? primary) : 'Free rolling';
  const typeLabel = SESSION_TYPE_LABELS[session.session_type] ?? session.session_type;
  const subtitle =
    session.session_type === 'class'                ? 'Open-mat afternoon.' :
    session.session_type === 'drilling'             ? 'Drilling block.'     :
    session.session_type === 'competition_training' ? 'Competition training.' :
                                                      `${typeLabel} session.`;

  return (
    <div style={{ marginBottom: 56, paddingBottom: 48, borderBottom: '1px solid var(--j2-border-2)' }}>
      <div className="j2-label-copper" style={{ marginBottom: 22 }}>{dateLabel}</div>
      <h1 className="j2-serif-display j2-heading-glow" style={{ fontSize: 96, margin: 0, lineHeight: 1 }}>
        {focusLabel}
      </h1>
      <div
        className="j2-serif-italic"
        style={{ marginTop: 18, fontSize: 22, color: 'rgba(255,255,255,0.60)' }}
      >
        {subtitle}
      </div>
    </div>
  );
}

// ── 4-stat row ────────────────────────────────────────────────────────────

function StatsRow({ session }: { session: SessionSummary }) {
  const intensity = Math.max(1, Math.min(5, session.intensity ?? 3));
  const intColor = INTENSITY_COLOR[intensity] ?? '#A8CB72';
  const intLabel = INT_LABELS[intensity] || 'Steady';
  const giLabel = formatGiNogi(session.gi_nogi);
  const typeLabel = SESSION_TYPE_LABELS[session.session_type] ?? session.session_type;
  const stats: { k: string; v: React.ReactNode }[] = [
    { k: 'Duration', v: formatDuration(session.duration ?? 0) },
    {
      k: 'Intensity',
      v: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <span
            aria-hidden
            style={{
              width: 12, height: 12, borderRadius: '50%',
              background: intColor, boxShadow: `0 0 10px ${intColor}60`,
            }}
          />
          {intLabel}
        </span>
      ),
    },
    { k: 'Style', v: giLabel.toUpperCase() },
    { k: 'Class', v: typeLabel },
  ];
  return (
    <div style={{ display: 'flex', gap: 40, marginBottom: 56, flexWrap: 'wrap' }}>
      {stats.map((s, i) => (
        <div key={i}>
          <div className="j2-label-micro" style={{ marginBottom: 8 }}>{s.k}</div>
          <div
            style={{
              fontSize: 22, fontFamily: FONT_EDITORIAL,
              color: PALE_YELLOW,
              display: 'flex', alignItems: 'center', gap: 12,
            }}
          >
            {s.v}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Prism + positions 2-col ───────────────────────────────────────────────

function PrismAndTags({ session }: { session: SessionSummary }) {
  const primary = session.tags?.[0] ?? null;
  const tagChips = (session.tags ?? []).map(t => SKILL_TAGS.find(x => x.value === t)?.label ?? t);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, marginBottom: 56 }}>
      {/* LEFT — Prism */}
      <div>
        <div className="j2-label-copper" style={{ marginBottom: 18 }}>◇ Focus area</div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <MiniPrism activeTag={primary} size={360} />
        </div>
      </div>
      {/* RIGHT — positions / tags */}
      <div>
        <div className="j2-label-copper" style={{ marginBottom: 20 }}>◈ Positions worked</div>
        {tagChips.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {tagChips.map((t, i) => (
              <span
                key={`${t}-${i}`}
                style={{
                  height: 42, padding: '0 20px',
                  display: 'inline-flex', alignItems: 'center',
                  fontSize: 14, fontWeight: 600,
                  background: 'rgba(196,145,95,0.16)',
                  border: `1px solid ${COPPER}`,
                  borderRadius: 21,
                  color: PALE_YELLOW,
                  whiteSpace: 'nowrap',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.40)', fontStyle: 'italic' }}>
            Free rolling. No positions tagged.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Reflection blockquote ─────────────────────────────────────────────────

function ReflectionBlock({ notes }: { notes: string }) {
  return (
    <div style={{ marginBottom: 56 }}>
      <div className="j2-label-copper" style={{ marginBottom: 18 }}>◈ Reflection</div>
      <div
        className="j2-serif-italic"
        style={{
          fontSize: 25, lineHeight: 1.7,
          color: 'rgba(255,255,255,0.90)',
          whiteSpace: 'pre-wrap',
          paddingLeft: 28,
          borderLeft: `2px solid ${COPPER}`,
        }}
      >
        {notes}
      </div>
    </div>
  );
}

// ── Related sessions ──────────────────────────────────────────────────────

function RelatedRow({ sessions, onOpen }: { sessions: SessionSummary[]; onOpen: (id: string) => void }) {
  return (
    <div style={{ marginBottom: 56 }}>
      <div className="j2-label-copper" style={{ marginBottom: 22 }}>◈ Similar sessions</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sessions.length}, 1fr)`, gap: 16 }}>
        {sessions.map(r => {
          const dateStr = typeof r.date === 'string' ? r.date.slice(0, 10) : toDateString(new Date(r.date));
          const d = new Date(dateStr + 'T00:00:00');
          const primary = r.tags?.[0];
          const focusLabel = primary ? (SKILL_TAGS.find(t => t.value === primary)?.label ?? primary) : 'Free rolling';
          return (
            <button
              key={r.id}
              onClick={() => onOpen(r.id)}
              style={{
                padding: 22,
                background: 'var(--j2-surface-2)',
                border: '1px solid var(--j2-border-1)',
                borderRadius: 14,
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'background 160ms ease, transform 160ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--j2-surface-2)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div
                style={{
                  fontSize: 13, color: 'rgba(255,255,255,0.40)',
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                }}
              >
                {MONTH_NAMES[d.getMonth()]} {d.getDate()}
              </div>
              <div
                style={{
                  fontSize: 19, fontWeight: 600, marginTop: 8,
                  color: 'rgba(255,255,255,0.90)', fontFamily: FONT_EDITORIAL,
                }}
              >
                {focusLabel}
              </div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.40)', marginTop: 6 }}>
                {DAY_NAMES[d.getDay()]} · {formatDuration(r.duration ?? 0)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Prev / next navigation ────────────────────────────────────────────────

function PrevNext({
  prev, next, onOpen,
}: {
  prev: SessionSummary | null;
  next: SessionSummary | null;
  onOpen: (id: string) => void;
}) {
  const render = (s: SessionSummary | null, side: 'left' | 'right') => {
    if (!s) return <span />;
    const dateStr = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
    const d = new Date(dateStr + 'T00:00:00');
    const primary = s.tags?.[0];
    const focusLabel = primary ? (SKILL_TAGS.find(t => t.value === primary)?.label ?? primary) : 'Free rolling';
    return (
      <button
        onClick={() => onOpen(s.id)}
        style={{
          textAlign: side === 'right' ? 'right' : 'left',
          background: 'transparent', cursor: 'pointer', padding: 0,
        }}
      >
        <div className="j2-label-micro" style={{ marginBottom: 6 }}>
          {side === 'left' ? '← Previous' : 'Next →'}
        </div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.60)' }}>
          {focusLabel} · {MONTH_NAMES[d.getMonth()]} {d.getDate()}
        </div>
      </button>
    );
  };
  return (
    <div
      style={{
        display: 'flex', justifyContent: 'space-between',
        paddingTop: 28, borderTop: '1px solid var(--j2-border-2)',
      }}
    >
      {render(prev, 'left')}
      {render(next, 'right')}
    </div>
  );
}

// ── 404 fallback ──────────────────────────────────────────────────────────

function NotFound({ onBack }: { onBack: () => void }) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: '1px solid var(--j2-border-2)',
        borderRadius: 16,
        padding: '60px 32px',
        textAlign: 'center',
        maxWidth: 560,
        margin: '40px auto',
      }}
    >
      <h2 className="j2-serif-display" style={{ fontSize: 26, margin: 0 }}>Entry not found.</h2>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.50)', lineHeight: 1.6, marginTop: 10 }}>
        That session doesn&rsquo;t exist — it may have been deleted, or the link is wrong.
      </p>
      <button
        onClick={onBack}
        style={{
          marginTop: 16,
          fontSize: 13, fontWeight: 600,
          color: COPPER, borderBottom: `1px solid ${COPPER}40`,
          background: 'transparent', padding: 0, cursor: 'pointer',
        }}
      >
        ← Back to journal
      </button>
    </div>
  );
}
