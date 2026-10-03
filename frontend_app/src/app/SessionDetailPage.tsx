// The entry as a page — desktop-only routed view at /journal/:id.
//
// The read-only body is EntryReadView, shared with SessionDetailModal so the
// entry reads identically wherever it's opened. This page adds what only a
// routed view can carry: similar sessions, and prev/next through the whole
// history. Editing opens the same Margin Notes editor the modal uses.

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSessions } from '../context/SessionsContext.tsx';
import { usePendingSessions } from '../hooks/usePendingSessions.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { useUserConstraints } from '../hooks/useUserConstraints.ts';
import { useCanonicalConstraints } from '../hooks/useCanonicalConstraints.ts';
import PageContent from '../components/PageContent.tsx';
import EntryReadView from '../components/EntryReadView.tsx';
import SessionDetailModal from '../components/SessionDetailModal.tsx';
import { api } from '../lib/api.ts';
import { SKILL_TAGS, MONTH_NAMES } from '../lib/constants.ts';
import { toDateString, DAY_NAMES, formatDuration } from '../lib/sessionUtils.ts';
import { CARD_BG, COPPER, FONT_EDITORIAL, STATUS_ERROR } from '../lib/theme.ts';
import type { SessionSummary } from '../types/api.ts';

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isDesktop) navigate('/home', { replace: true });
  }, [isDesktop, navigate]);

  // Sessions come from the shared context (perf Tier 3 #8). The full session
  // history is needed so prev/next reaches the oldest entries and "similar
  // sessions" can surface old ones with matching focus — that matches the
  // context's default unfiltered fetch.
  const { sessions, loading, error: fetchError, refresh } = useSessions();

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

  // Constraint names feed the "one question" fallback in EntryReadView.
  const { byId: userConstraintById } = useUserConstraints();
  const { byId: canonicalConstraintById } = useCanonicalConstraints();
  const constraints = useMemo<string[]>(() => {
    if (!session) return [];
    const names: string[] = [];
    for (const cid of session.canonical_constraint_ids ?? []) {
      const c = canonicalConstraintById.get(cid);
      if (c) names.push(c.name);
    }
    for (const cid of session.user_constraint_ids ?? []) {
      const c = userConstraintById.get(cid);
      if (c) names.push(c.name);
    }
    return names;
  }, [session, canonicalConstraintById, userConstraintById]);

  const headingLabel = session?.heading
    ? (SKILL_TAGS.find(s => s.value === session.heading)?.label ?? session.heading)
    : null;

  const sessionDate = session
    ? new Date((typeof session.date === 'string' ? session.date.slice(0, 10) : toDateString(new Date(session.date))) + 'T00:00:00')
    : null;

  // Every mutation has to invalidate SessionsContext — the provider fetches
  // once at app mount and has no other refresh path, so without this the page
  // (and /journal behind it) keep showing pre-edit or already-deleted rows.
  const handleDelete = useCallback(async () => {
    if (!session) return;
    setDeleting(true);
    try {
      await api.delete(`/api/sessions/${session.id}`);
      await refresh();
      navigate('/journal', { replace: true });
    } catch {
      setDeleting(false);
    }
  }, [session, navigate, refresh]);

  const handleSaved = useCallback(() => {
    setEditing(false);
    void refresh();
  }, [refresh]);

  if (!isDesktop) return null;

  return (
    <>
    <PageContent ready={!loading} loadingMessages={['Opening the entry...', 'Smoothing the page...']}>
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 80px 104px' }}>

      {fetchError && <p style={{ fontSize: 13, color: STATUS_ERROR, marginBottom: 16 }}>{fetchError}</p>}

      {!session && !loading ? (
        <NotFound onBack={() => navigate('/journal')} />
      ) : session && sessionDate ? (
        <>
          <EntryReadView
            session={session}
            date={sessionDate}
            constraints={constraints}
            headingLabel={headingLabel}
            backLabel="Journal"
            onBack={() => navigate('/journal')}
            onEdit={() => setEditing(true)}
            onDelete={handleDelete}
            deleting={deleting}
          />

          <div style={{ maxWidth: 640, marginInline: 'auto', marginTop: 64 }}>
            {related.length > 0 && <RelatedRow sessions={related} onOpen={(sid) => navigate(`/journal/${sid}`)} />}
            <PrevNext
              prev={prev}
              next={next}
              onOpen={(sid) => navigate(`/journal/${sid}`)}
            />
          </div>
        </>
      ) : null}

    </div>
    </PageContent>

    {/* Editing reuses the modal's Margin Notes panel — the read view stays
        on the page behind it, so the modal opens straight into the editor. */}
    {editing && session && sessionDate && (
      <SessionDetailModal
        session={session}
        date={sessionDate}
        initialEditing
        onClose={() => setEditing(false)}
        onSaved={handleSaved}
        onDeleted={() => { void refresh(); navigate('/journal', { replace: true }); }}
      />
    )}
    </>
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
