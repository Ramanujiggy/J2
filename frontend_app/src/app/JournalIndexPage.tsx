// Journal — index of every logged session.
//
// Desktop: editorial layout, sessions reverse-chronological grouped by month,
// each entry opens the routed single-session detail view at /journal/:id.
// Mobile: narrower list layout, same data, taps open the SessionDetailModal
// in-place (keeps mobile feeling native, no full-page route push).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VariableSizeList, type ListChildComponentProps } from 'react-window';
import { useSessions } from '../context/SessionsContext.tsx';
import { usePendingSessions } from '../hooks/usePendingSessions.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import PageContent from '../components/PageContent.tsx';
import SessionDetailModal from '../components/SessionDetailModal.tsx';
import JournalEmptyHero from '../components/empty/JournalEmptyHero.tsx';
import SegmentedToggle from '../components/SegmentedToggle.tsx';
import { SKILL_TAGS } from '../lib/constants.ts';
import { toDateString, DAY_NAMES, SESSION_TYPE_LABELS, INTENSITY_COLOR, formatDuration, formatGiNogi } from '../lib/sessionUtils.ts';
import {
  PALE_YELLOW, COPPER, CARD_BG, FONT_EDITORIAL,
} from '../lib/theme.ts';
import type { SessionSummary } from '../types/api.ts';

type Filter = 'All' | typeof SKILL_TAGS[number]['value'];

// ── Virtualized item shapes ──────────────────────────────────────────────
// Mobile interleaves month headers with per-day groups; desktop interleaves
// month headers with individual session rows. Heights are estimated below in
// `mobileItemHeight` / `desktopItemHeight` and fed into VariableSizeList.

type MobileItem =
  | { kind: 'month';   key: string; month: string; count: number }
  | { kind: 'day';     key: string; dateStr: string; sessions: SessionSummary[] };

type DesktopItem =
  | { kind: 'month';   key: string; month: string; count: number }
  | { kind: 'session'; key: string; session: SessionSummary };

function mobileItemHeight(item: MobileItem): number {
  if (item.kind === 'month') return 56;
  // 14+14 padding + ~50px per session + 10px divider between stacked sessions.
  const n = item.sessions.length;
  return 28 + 50 * n + 10 * Math.max(0, n - 1);
}

function desktopItemHeight(item: DesktopItem): number {
  if (item.kind === 'month') return 122;
  return 118;
}

export default function JournalIndexPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  // Mobile detail modal state — set when a JournalRow is tapped on mobile.
  const [mobileDetailSession, setMobileDetailSession] = useState<SessionSummary | null>(null);

  // Shared sessions feed (Tier 3 perf — was independent /api/sessions fetch).
  const { sessions, loading, error: fetchError, refresh: fetchAll } = useSessions();
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');

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

  // ── Virtualization (Tier 3 perf — react-window) ───────────────────────
  // Power users may have hundreds of sessions/day-groups. Flatten the
  // month-grouped tree into a single items array so VariableSizeList can
  // recycle row DOM as the user scrolls.
  const mobileItems = useMemo<MobileItem[]>(() => {
    const out: MobileItem[] = [];
    for (const [month, monthSessions] of groups) {
      out.push({ kind: 'month', key: month, month, count: monthSessions.length });
      for (const [dateStr, daySessions] of groupByDate(monthSessions)) {
        out.push({ kind: 'day', key: dateStr, dateStr, sessions: daySessions });
      }
    }
    return out;
  }, [groups]);

  const desktopItems = useMemo<DesktopItem[]>(() => {
    const out: DesktopItem[] = [];
    for (const [month, monthSessions] of groups) {
      out.push({ kind: 'month', key: month, month, count: monthSessions.length });
      for (const s of monthSessions) {
        out.push({ kind: 'session', key: String(s.id), session: s });
      }
    }
    return out;
  }, [groups]);

  // Reset the virtualized list's internal cache when items change.
  const mobileListRef  = useRef<VariableSizeList | null>(null);
  const desktopListRef = useRef<VariableSizeList | null>(null);
  useEffect(() => { mobileListRef.current?.resetAfterIndex(0);  }, [mobileItems]);
  useEffect(() => { desktopListRef.current?.resetAfterIndex(0); }, [desktopItems]);

  if (!isDesktop) {
    return (
      <PageContent ready={!loading} loadingMessages={['Pulling entries...', 'Dusting the pages...']}>
        <div className="px-4 pt-6 pb-24">
          {/* Title row — title left, surface toggle inline-right. Synced
              with the matching toggle on IntentionsPage so users can swap
              views without round-tripping through the bottom nav.
              Mobile-only; desktop already shows both surfaces with full
              chrome. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
            <h1
              className="font-display font-bold"
              style={{
                color: PALE_YELLOW,
                fontSize: 28,
                letterSpacing: '-0.01em',
                margin: 0,
              }}
            >
              Journal
            </h1>
            <SegmentedToggle<'entries' | 'intentions'>
              size="compact"
              options={[
                { value: 'entries',    label: 'Entries' },
                { value: 'intentions', label: 'Intentions' },
              ]}
              value="entries"
              onChange={(v) => { if (v === 'intentions') navigate('/intentions', { replace: true }); }}
            />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 20 }}>
            {allSessions.length} {allSessions.length === 1 ? 'entry' : 'entries'} · {totalHours}h logged
          </p>

          {fetchError && (
            <p style={{ fontSize: 13, color: '#F87171', marginBottom: 12 }}>{fetchError}</p>
          )}

          {/* Search */}
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="Search…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full rounded-xl mb-3"
            style={{
              background: 'var(--j2-surface-3)',
              border: '1px solid var(--j2-border-1)',
              padding: '11px 14px',
              color: 'rgba(255,255,255,0.90)',
              fontSize: 14,
              outline: 'none',
            }}
          />

          {/* Filter chips — horizontal scroll on mobile */}
          <div
            className="flex gap-2 overflow-x-auto pb-2"
            style={{ marginBottom: 18, scrollbarWidth: 'none' }}
          >
            {(['All', ...SKILL_TAGS.map(t => t.value)] as Filter[]).map(v => {
              const label = v === 'All' ? 'All' : (SKILL_TAGS.find(t => t.value === v)?.label ?? v);
              const active = filter === v;
              return (
                <button
                  key={v}
                  onClick={() => setFilter(v)}
                  className="touch-manipulation"
                  style={{
                    flexShrink: 0,
                    height: 32, padding: '0 14px',
                    fontSize: 12, fontWeight: 600,
                    background: active ? 'rgba(196,145,95,0.16)' : 'var(--j2-surface-2)',
                    border: `1px solid ${active ? COPPER : 'var(--j2-border-1)'}`,
                    borderRadius: 16,
                    color: active ? PALE_YELLOW : 'rgba(255,255,255,0.55)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Entries — virtualized via react-window. Inner scroll container
              is sized to the remaining viewport below the title/search/chips. */}
          {filtered.length === 0 && !loading ? (
            <EmptyState hasAny={allSessions.length > 0} />
          ) : (
            <VariableSizeList
              ref={mobileListRef}
              height={Math.max(360, (typeof window !== 'undefined' ? window.innerHeight : 800) - 280)}
              width="100%"
              itemCount={mobileItems.length}
              itemSize={(i) => mobileItemHeight(mobileItems[i]!)}
              overscanCount={4}
              estimatedItemSize={120}
              itemKey={(i) => mobileItems[i]!.key}
            >
              {({ index, style }: ListChildComponentProps) => (
                <MobileVirtRow item={mobileItems[index]!} style={style} onOpen={setMobileDetailSession} />
              )}
            </VariableSizeList>
          )}
        </div>

        {/* Detail modal — mobile pattern. Uses the same SessionDetailModal
            as PathAheadPage + CalendarPage so edit/delete/save flows match. */}
        {mobileDetailSession && (
          <SessionDetailModal
            key={mobileDetailSession.id}
            session={mobileDetailSession}
            date={new Date(
              (typeof mobileDetailSession.date === 'string'
                ? mobileDetailSession.date.slice(0, 10)
                : toDateString(new Date(mobileDetailSession.date))) + 'T00:00:00'
            )}
            intention={null}
            sessionCount={1}
            sessionIndex={0}
            onNavigate={() => { /* single-session view — no navigation */ }}
            onClose={() => setMobileDetailSession(null)}
            onSaved={() => { fetchAll(); setMobileDetailSession(null); }}
            onDeleted={() => { fetchAll(); setMobileDetailSession(null); }}
          />
        )}
      </PageContent>
    );
  }

  return (
    <PageContent ready={!loading} loadingMessages={['Pulling entries...', 'Dusting the pages...', 'Finding the margin notes...']}>
    <div className="j2-page-container" style={{ paddingTop: 64, paddingBottom: 104 }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 48 }}>
        <div className="j2-label-micro" style={{ marginBottom: 16 }}>Journal</div>
        <h1 className="j2-serif-display j2-heading-glow" style={{ fontSize: 84, margin: 0, lineHeight: 1 }}>
          Your training log.
        </h1>
        <div
          className="j2-serif-italic"
          style={{ marginTop: 16, fontSize: 22, color: 'rgba(255,255,255,0.60)' }}
        >
          {allSessions.length} {allSessions.length === 1 ? 'entry' : 'entries'} · {totalHours} hour{totalHours === 1 ? '' : 's'} logged.
        </div>
      </div>

      {fetchError && <p style={{ fontSize: 15, color: '#F87171', marginBottom: 20 }}>{fetchError}</p>}

      {/* ── Search + filter chips ──────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 40, alignItems: 'center' }}>
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="Search positions, focus, notes…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            flex: 1,
            background: 'var(--j2-surface-3)',
            border: '1px solid var(--j2-border-2)',
            borderRadius: 12,
            padding: '16px 20px',
            color: 'rgba(255,255,255,0.90)',
            fontSize: 16,
            outline: 'none',
            transition: 'border-color 180ms ease, background 180ms ease',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(196,145,95,0.5)'; e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--j2-border-2)'; e.currentTarget.style.background = 'var(--j2-surface-3)'; }}
        />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {(['All', ...SKILL_TAGS.map(t => t.value)] as Filter[]).map(v => {
            const label = v === 'All' ? 'All' : (SKILL_TAGS.find(t => t.value === v)?.label ?? v);
            const active = filter === v;
            return (
              <button
                key={v}
                onClick={() => setFilter(v)}
                style={{
                  height: 42, padding: '0 20px',
                  display: 'inline-flex', alignItems: 'center',
                  fontSize: 14, fontWeight: 600,
                  background: active ? 'rgba(196,145,95,0.16)' : 'var(--j2-surface-2)',
                  border: `1px solid ${active ? COPPER : 'var(--j2-border-2)'}`,
                  borderRadius: 21,
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

      {/* ── Month-grouped entries — virtualized ──────────────── */}
      {filtered.length === 0 && !loading ? (
        <EmptyState hasAny={allSessions.length > 0} />
      ) : (
        <VariableSizeList
          ref={desktopListRef}
          height={Math.max(540, (typeof window !== 'undefined' ? window.innerHeight : 900) - 360)}
          width="100%"
          itemCount={desktopItems.length}
          itemSize={(i) => desktopItemHeight(desktopItems[i]!)}
          overscanCount={4}
          estimatedItemSize={118}
          itemKey={(i) => desktopItems[i]!.key}
        >
          {({ index, style }: ListChildComponentProps) => (
            <DesktopVirtRow item={desktopItems[index]!} style={style} navigate={navigate} />
          )}
        </VariableSizeList>
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
  const giLabel = formatGiNogi(session.gi_nogi);
  const secondaryTags = session.tags?.slice(1, 4) ?? [];
  const secondaryLabels = secondaryTags.map(t => SKILL_TAGS.find(x => x.value === t)?.label ?? t);

  return (
    <button
      onClick={onOpen}
      style={{
        display: 'grid',
        gridTemplateColumns: '76px 1fr auto',
        gap: 26,
        alignItems: 'center',
        width: '100%',
        padding: '26px 8px',
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
        <div className="j2-serif-display" style={{ fontSize: 40, lineHeight: 1 }}>
          {d.getDate()}
        </div>
        <div className="j2-label-micro" style={{ fontSize: 11.5, marginTop: 6 }}>
          {DAY_NAMES[d.getDay()]}
        </div>
      </div>

      {/* Middle column */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
          <span
            aria-hidden
            style={{
              width: 14, height: 14, borderRadius: '50%',
              background: intColor,
              boxShadow: `0 0 12px ${intColor}60`,
              flexShrink: 0,
            }}
          />
          <div style={{ fontSize: 22, fontWeight: 600, color: PALE_YELLOW, fontFamily: FONT_EDITORIAL }}>
            {focusLabel}
          </div>
          <span className="j2-label-micro" style={{ marginLeft: 2 }}>·</span>
          <div
            style={{
              fontSize: 14, color: 'rgba(255,255,255,0.40)',
              textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600,
            }}
          >
            {classLabel}
          </div>
        </div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.60)' }}>
          {secondaryLabels.length > 0 ? secondaryLabels.join(' · ') : 'Open rolling'}
        </div>
      </div>

      {/* Right column — duration + style */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 19, fontFamily: FONT_EDITORIAL, color: 'rgba(255,255,255,0.90)' }}>
          {formatDuration(session.duration ?? 0)}
        </div>
        <div
          style={{
            fontSize: 13, color: 'rgba(255,255,255,0.40)',
            letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 6,
          }}
        >
          {giLabel}
        </div>
      </div>
    </button>
  );
}

// Group sessions (already sorted desc by date) into [date, sessions[]] pairs,
// preserving order so the day-buckets stay reverse-chronological.
function groupByDate(items: SessionSummary[]): Array<[string, SessionSummary[]]> {
  const out = new Map<string, SessionSummary[]>();
  for (const s of items) {
    const key = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
    const bucket = out.get(key) ?? [];
    bucket.push(s);
    out.set(key, bucket);
  }
  return Array.from(out.entries());
}

/** One day's worth of journal entries on mobile.
 *  Date column rendered once on the left; each session is a stacked sub-row
 *  on the right that opens the SessionDetailModal. Single- and multi-session
 *  days share this layout — multi gets a copper "×N" badge under the date. */
function MobileDayGroup({
  dateStr,
  sessions,
  onOpen,
}: {
  dateStr: string;
  sessions: SessionSummary[];
  onOpen: (s: SessionSummary) => void;
}) {
  const d = new Date(dateStr + 'T00:00:00');
  const isMulti = sessions.length > 1;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '44px 1fr',
        gap: 14,
        padding: '14px 4px',
        borderBottom: '1px solid var(--j2-border-1)',
        alignItems: 'start',
      }}
    >
      {/* Date column — once per day */}
      <div style={{ textAlign: 'center', paddingTop: 2 }}>
        <div style={{ fontSize: 22, fontFamily: FONT_EDITORIAL, lineHeight: 1, color: PALE_YELLOW }}>
          {d.getDate()}
        </div>
        <div className="j2-label-micro" style={{ fontSize: 9.5, marginTop: 4 }}>
          {DAY_NAMES[d.getDay()]}
        </div>
        {isMulti && (
          <div
            style={{
              marginTop: 8,
              fontSize: 10, fontWeight: 700,
              color: COPPER, letterSpacing: '0.06em',
            }}
          >
            ×{sessions.length}
          </div>
        )}
      </div>

      {/* Sessions stack */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {sessions.map((s, i) => (
          <SessionMiniRow
            key={s.id}
            session={s}
            onOpen={() => onOpen(s)}
            divider={i > 0}
          />
        ))}
      </div>
    </div>
  );
}

/** A single session row inside a MobileDayGroup. No date column — that's
 *  rendered once by the parent. `divider` adds a hairline above for stacked
 *  days so the boundary between same-day sessions reads clearly. */
function SessionMiniRow({
  session,
  onOpen,
  divider,
}: {
  session: SessionSummary;
  onOpen: () => void;
  divider: boolean;
}) {
  const intensity = Math.max(1, Math.min(5, session.intensity ?? 3));
  const intColor = INTENSITY_COLOR[intensity] ?? '#A8CB72';
  const primary = session.tags?.[0];
  const focusLabel = primary ? (SKILL_TAGS.find(t => t.value === primary)?.label ?? primary) : 'Free rolling';
  const classLabel = SESSION_TYPE_LABELS[session.session_type] ?? session.session_type;
  const giLabel = formatGiNogi(session.gi_nogi);

  return (
    <button
      onClick={onOpen}
      className="w-full touch-manipulation"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 12,
        alignItems: 'center',
        padding: divider ? '10px 0 0' : '0 0 0',
        marginTop: divider ? 10 : 0,
        borderTop: divider ? '1px solid rgba(255,255,255,0.05)' : 'none',
        background: 'transparent',
        textAlign: 'left',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span
            aria-hidden
            style={{
              width: 9, height: 9, borderRadius: '50%', background: intColor,
              boxShadow: `0 0 6px ${intColor}60`, flexShrink: 0,
            }}
          />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
            {focusLabel}
          </div>
        </div>
        <div
          style={{
            fontSize: 11, color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600,
          }}
        >
          {classLabel} · {giLabel}
        </div>
      </div>

      <div style={{ fontSize: 15, fontFamily: FONT_EDITORIAL, color: 'rgba(255,255,255,0.85)' }}>
        {formatDuration(session.duration ?? 0)}
      </div>
    </button>
  );
}

// ── Virtualized row renderers ────────────────────────────────────────────

function MobileVirtRow({
  item, style, onOpen,
}: {
  item: MobileItem;
  style: React.CSSProperties;
  onOpen: (s: SessionSummary) => void;
}) {
  if (item.kind === 'month') {
    return (
      <div style={style}>
        <div
          className="j2-label-micro"
          style={{
            paddingBottom: 8, marginBottom: 8,
            borderBottom: '1px solid var(--j2-border-1)',
          }}
        >
          {new Date(item.month + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} · {item.count}
        </div>
      </div>
    );
  }
  return (
    <div style={style}>
      <MobileDayGroup dateStr={item.dateStr} sessions={item.sessions} onOpen={onOpen} />
    </div>
  );
}

function DesktopVirtRow({
  item, style, navigate,
}: {
  item: DesktopItem;
  style: React.CSSProperties;
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (item.kind === 'month') {
    return (
      <div style={style}>
        <div
          style={{
            display: 'flex', alignItems: 'baseline', gap: 20,
            marginBottom: 18, paddingBottom: 12,
            borderBottom: '1px solid var(--j2-border-2)',
          }}
        >
          <div className="j2-serif-display" style={{ fontSize: 38 }}>
            {new Date(item.month + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
          <div className="j2-label-micro">{item.count} {item.count === 1 ? 'entry' : 'entries'}</div>
        </div>
      </div>
    );
  }
  return (
    <div style={style}>
      <JournalRow session={item.session} onOpen={() => navigate(`/journal/${item.session.id}`)} />
    </div>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  // No sessions at all → editorial hero (chapter title pattern).
  if (!hasAny) return <JournalEmptyHero />;
  // Has sessions but filter yields zero — keep the lighter inline empty.
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
        No sessions match.
      </h2>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.50)', lineHeight: 1.6, marginTop: 10 }}>
        Adjust the filter or search — your training is wider than it looks.
      </p>
    </div>
  );
}
