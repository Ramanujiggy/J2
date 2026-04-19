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
      // Journal is the "every entry you've ever logged" surface — fetch all.
      const res = await api.get<SessionsResponse>('/api/sessions');
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
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '56px 64px 96px' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <div className="j2-label-micro" style={{ marginBottom: 14 }}>Journal</div>
        <h1 className="j2-serif-display j2-heading-glow" style={{ fontSize: 68, margin: 0, lineHeight: 1 }}>
          Your training log.
        </h1>
        <div
          className="j2-serif-italic"
          style={{ marginTop: 14, fontSize: 19, color: 'rgba(255,255,255,0.60)' }}
        >
          {allSessions.length} {allSessions.length === 1 ? 'entry' : 'entries'} · {totalHours} hour{totalHours === 1 ? '' : 's'} logged.
        </div>
      </div>

      {fetchError && <p style={{ fontSize: 14, color: '#F87171', marginBottom: 18 }}>{fetchError}</p>}

      {/* ── Search + filter chips ──────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 32, alignItems: 'center' }}>
        <input
          placeholder="Search positions, focus, notes…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            flex: 1,
            background: 'var(--j2-surface-3)',
            border: '1px solid var(--j2-border-2)',
            borderRadius: 12,
            padding: '14px 18px',
            color: 'rgba(255,255,255,0.90)',
            fontSize: 15,
            outline: 'none',
            transition: 'border-color 180ms ease, background 180ms ease',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(196,145,95,0.5)'; e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--j2-border-2)'; e.currentTarget.style.background = 'var(--j2-surface-3)'; }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['All', ...SKILL_TAGS.map(t => t.value)] as Filter[]).map(v => {
            const label = v === 'All' ? 'All' : (SKILL_TAGS.find(t => t.value === v)?.label ?? v);
            const active = filter === v;
            return (
              <button
                key={v}
                onClick={() => setFilter(v)}
                style={{
                  height: 36, padding: '0 16px',
                  display: 'inline-flex', alignItems: 'center',
                  fontSize: 13, fontWeight: 600,
                  background: active ? 'rgba(196,145,95,0.16)' : 'var(--j2-surface-2)',
                  border: `1px solid ${active ? COPPER : 'var(--j2-border-2)'}`,
                  borderRadius: 18,
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
          <div key={month} style={{ marginBottom: 44 }}>
            <div
              style={{
                display: 'flex', alignItems: 'baseline', gap: 16,
                marginBottom: 14, paddingBottom: 10,
                borderBottom: '1px solid var(--j2-border-2)',
              }}
            >
              <div className="j2-serif-display" style={{ fontSize: 32 }}>
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
        gridTemplateColumns: '64px 1fr auto',
        gap: 22,
        alignItems: 'center',
        width: '100%',
        padding: '22px 6px',
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
        <div className="j2-serif-display" style={{ fontSize: 34, lineHeight: 1 }}>
          {d.getDate()}
        </div>
        <div className="j2-label-micro" style={{ fontSize: 10.5, marginTop: 4 }}>
          {DAY_NAMES[d.getDay()]}
        </div>
      </div>

      {/* Middle column */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
          <span
            aria-hidden
            style={{
              width: 12, height: 12, borderRadius: '50%',
              background: intColor,
              boxShadow: `0 0 10px ${intColor}60`,
              flexShrink: 0,
            }}
          />
          <div style={{ fontSize: 19, fontWeight: 600, color: PALE_YELLOW, fontFamily: FONT_EDITORIAL }}>
            {focusLabel}
          </div>
          <span className="j2-label-micro" style={{ marginLeft: 2 }}>·</span>
          <div
            style={{
              fontSize: 13, color: 'rgba(255,255,255,0.40)',
              textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600,
            }}
          >
            {classLabel}
          </div>
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.60)' }}>
          {secondaryLabels.length > 0 ? secondaryLabels.join(' · ') : 'Open rolling'}
        </div>
      </div>

      {/* Right column — duration + style */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 17, fontFamily: FONT_EDITORIAL, color: 'rgba(255,255,255,0.90)' }}>
          {formatDuration(session.duration ?? 0)}
        </div>
        <div
          style={{
            fontSize: 12, color: 'rgba(255,255,255,0.40)',
            letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4,
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
