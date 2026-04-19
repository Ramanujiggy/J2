// Journal — desktop-only editorial index of every logged session.
//
// Sessions reverse-chronological, grouped by month. Each entry opens the
// routed single-session detail view at /journal/:id (no modal). Mobile
// users are redirected back to /home where sessions are already reachable
// via the existing modal flow.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api.ts';
import { useOnlineRefetch } from '../hooks/useOnlineRefetch.ts';
import { usePendingSessions } from '../hooks/usePendingSessions.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import PageContent from '../components/PageContent.tsx';
import { SKILL_TAGS } from '../lib/constants.ts';
import { toDateString, DAY_NAMES, SESSION_TYPE_LABELS, INTENSITY_COLOR, formatDuration } from '../lib/sessionUtils.ts';
import {
  PALE_YELLOW, COPPER, CARD_BG, FONT_EDITORIAL,
} from '../lib/theme.ts';
import type { SessionSummary, SessionsResponse } from '../types/api.ts';

type Filter = 'All' | typeof SKILL_TAGS[number]['value'];

export default function JournalIndexPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!isDesktop) navigate('/home', { replace: true });
  }, [isDesktop, navigate]);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      setFetchError(null);
      // Wide window — Journal needs deep history, not just the last 6mo.
      const from = new Date(Date.now() - 730 * 86_400_000).toISOString().slice(0, 10);
      const res = await api.get<SessionsResponse>(`/api/sessions?from=${from}`);
      setSessions(res.sessions ?? []);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        setFetchError('Could not load sessions. Please refresh.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useOnlineRefetch(fetchAll);

  const pendingSessions = usePendingSessions();
  const allSessions = useMemo(() => [...sessions, ...pendingSessions], [sessions, pendingSessions]);

  const totalHours = useMemo(
    () => Math.round(allSessions.reduce((a, s) => a + (s.duration ?? 0), 0) / 60),
    [allSessions],
  );

  // Filter + search — matches either primary tag or notes text
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allSessions
      .filter(s => {
        if (filter !== 'All' && s.tags?.[0] !== filter) return false;
        if (!q) return true;
        const inNotes = s.notes?.toLowerCase().includes(q);
        const inTags = s.tags?.some(t => t.toLowerCase().includes(q));
        const primary = s.tags?.[0];
        const primaryLabel = primary ? SKILL_TAGS.find(x => x.value === primary)?.label : null;
        return Boolean(inNotes || inTags || primaryLabel?.toLowerCase().includes(q));
      })
      .slice()
      .sort((a, b) => {
        const ak = typeof a.date === 'string' ? a.date.slice(0, 10) : toDateString(new Date(a.date));
        const bk = typeof b.date === 'string' ? b.date.slice(0, 10) : toDateString(new Date(b.date));
        return bk.localeCompare(ak);
      });
  }, [allSessions, filter, query]);

  // Group by month (YYYY-MM)
  const groups = useMemo(() => {
    const out = new Map<string, SessionSummary[]>();
    filtered.forEach(s => {
      const key = (typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date))).slice(0, 7);
      const bucket = out.get(key) ?? [];
      bucket.push(s);
      out.set(key, bucket);
    });
    return Array.from(out.entries());
  }, [filtered]);

  if (!isDesktop) return null;

  return (
    <PageContent ready={!loading} loadingMessages={['Pulling entries...', 'Dusting the pages...', 'Finding the margin notes...']}>
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '40px 48px 80px' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div className="j2-label-micro" style={{ marginBottom: 10 }}>Journal</div>
        <h1 className="j2-serif-display j2-heading-glow" style={{ fontSize: 56, margin: 0, lineHeight: 1 }}>
          Your training log.
        </h1>
        <div
          className="j2-serif-italic"
          style={{ marginTop: 10, fontSize: 17, color: 'rgba(255,255,255,0.60)' }}
        >
          {allSessions.length} {allSessions.length === 1 ? 'entry' : 'entries'} · {totalHours} hour{totalHours === 1 ? '' : 's'} logged.
        </div>
      </div>

      {fetchError && <p style={{ fontSize: 13, color: '#F87171', marginBottom: 16 }}>{fetchError}</p>}

      {/* ── Search + filter chips ──────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, alignItems: 'center' }}>
        <input
          placeholder="Search positions, focus, notes…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            flex: 1,
            background: 'var(--j2-surface-3)',
            border: '1px solid var(--j2-border-2)',
            borderRadius: 10,
            padding: '12px 14px',
            color: 'rgba(255,255,255,0.90)',
            fontSize: 14,
            outline: 'none',
            transition: 'border-color 180ms ease, background 180ms ease',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(196,145,95,0.5)'; e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--j2-border-2)'; e.currentTarget.style.background = 'var(--j2-surface-3)'; }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['All', ...SKILL_TAGS.map(t => t.value)] as Filter[]).map(v => {
            const label = v === 'All' ? 'All' : (SKILL_TAGS.find(t => t.value === v)?.label ?? v);
            const active = filter === v;
            return (
              <button
                key={v}
                onClick={() => setFilter(v)}
                style={{
                  height: 30, padding: '0 12px',
                  display: 'inline-flex', alignItems: 'center',
                  fontSize: 12, fontWeight: 600,
                  background: active ? 'rgba(196,145,95,0.16)' : 'var(--j2-surface-2)',
                  border: `1px solid ${active ? COPPER : 'var(--j2-border-2)'}`,
                  borderRadius: 16,
                  color: active ? PALE_YELLOW : 'rgba(255,255,255,0.60)',
                  cursor: 'pointer',
                  transition: 'all 160ms ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Month-grouped entries ──────────────────────────── */}
      {filtered.length === 0 && !loading ? (
        <EmptyState hasAny={allSessions.length > 0} />
      ) : (
        groups.map(([month, items]) => (
          <div key={month} style={{ marginBottom: 36 }}>
            <div
              style={{
                display: 'flex', alignItems: 'baseline', gap: 14,
                marginBottom: 12, paddingBottom: 8,
                borderBottom: '1px solid var(--j2-border-2)',
              }}
            >
              <div className="j2-serif-display" style={{ fontSize: 26 }}>
                {new Date(month + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
              <div className="j2-label-micro">{items.length} {items.length === 1 ? 'entry' : 'entries'}</div>
            </div>
            {items.map(s => (
              <JournalRow key={s.id} session={s} onOpen={() => navigate(`/journal/${s.id}`)} />
            ))}
          </div>
        ))
      )}

    </div>
    </PageContent>
  );
}

function JournalRow({ session, onOpen }: { session: SessionSummary; onOpen: () => void }) {
  const dateStr = typeof session.date === 'string' ? session.date.slice(0, 10) : toDateString(new Date(session.date));
  const d = new Date(dateStr + 'T00:00:00');
  const intensity = Math.max(1, Math.min(5, session.intensity ?? 3));
  const intColor = INTENSITY_COLOR[intensity] ?? '#A8CB72';
  const primary = session.tags?.[0];
  const focusLabel = primary ? (SKILL_TAGS.find(t => t.value === primary)?.label ?? primary) : 'Free rolling';
  const classLabel = SESSION_TYPE_LABELS[session.session_type] ?? session.session_type;
  const giLabel = session.gi_nogi === 'gi' ? 'Gi' : 'No-Gi';
  const secondaryTags = session.tags?.slice(1, 4) ?? [];
  const secondaryLabels = secondaryTags.map(t => SKILL_TAGS.find(x => x.value === t)?.label ?? t);

  return (
    <button
      onClick={onOpen}
      style={{
        display: 'grid',
        gridTemplateColumns: '56px 1fr auto',
        gap: 18,
        alignItems: 'center',
        width: '100%',
        padding: '18px 4px',
        borderBottom: '1px solid var(--j2-border-1)',
        background: 'transparent',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'background 160ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Date column — large serif day + weekday */}
      <div style={{ textAlign: 'center' }}>
        <div className="j2-serif-display" style={{ fontSize: 28, lineHeight: 1 }}>
          {d.getDate()}
        </div>
        <div className="j2-label-micro" style={{ fontSize: 9.5, marginTop: 2 }}>
          {DAY_NAMES[d.getDay()]}
        </div>
      </div>

      {/* Middle column */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <span
            aria-hidden
            style={{
              width: 10, height: 10, borderRadius: '50%',
              background: intColor,
              boxShadow: `0 0 8px ${intColor}60`,
              flexShrink: 0,
            }}
          />
          <div style={{ fontSize: 16, fontWeight: 600, color: PALE_YELLOW, fontFamily: FONT_EDITORIAL }}>
            {focusLabel}
          </div>
          <span className="j2-label-micro" style={{ marginLeft: 2 }}>·</span>
          <div
            style={{
              fontSize: 12, color: 'rgba(255,255,255,0.40)',
              textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600,
            }}
          >
            {classLabel}
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.60)' }}>
          {secondaryLabels.length > 0 ? secondaryLabels.join(' · ') : 'Open rolling'}
        </div>
      </div>

      {/* Right column — duration + style */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 15, fontFamily: FONT_EDITORIAL, color: 'rgba(255,255,255,0.90)' }}>
          {formatDuration(session.duration ?? 0)}
        </div>
        <div
          style={{
            fontSize: 11, color: 'rgba(255,255,255,0.40)',
            letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2,
          }}
        >
          {giLabel}
        </div>
      </div>
    </button>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
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
      <h2 className="j2-serif-display" style={{ fontSize: 26, margin: 0 }}>
        {hasAny ? 'No sessions match.' : 'No entries yet.'}
      </h2>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.50)', lineHeight: 1.6, marginTop: 10 }}>
        {hasAny
          ? 'Adjust the filter or search — your training is wider than it looks.'
          : 'Log your first session from the Path Ahead and it will live here.'}
      </p>
    </div>
  );
}
