// Atlas — desktop-only aggregate view with 4 sub-tabs:
//
//   • Timeline — year-by-year horizontal strips with session dots + focus ribbon
//   • Prism    — reuses existing SkillRadar (absorbs the former /analytics page)
//   • Library  — "Coming Soon" empty state (technique catalog lands later)
//   • Calendar — reuses existing TrainingHeatmap (the traditional detailed view)
//
// Mobile visitors are redirected to /calendar — Atlas is strictly a desktop surface.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api.ts';
import { useOnlineRefetch } from '../hooks/useOnlineRefetch.ts';
import { usePendingSessions } from '../hooks/usePendingSessions.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import PageContent from '../components/PageContent.tsx';
import SkillRadar from '../components/SkillRadar.tsx';
import TrainingHeatmap from '../components/TrainingHeatmap.tsx';
import ErrorBoundary from '../components/ErrorBoundary.tsx';
import { SKILL_COLORS } from '../components/charts/RadarChart.tsx';
import { SKILL_TAGS } from '../lib/constants.ts';
import { toDateString } from '../lib/sessionUtils.ts';
import {
  PALE_YELLOW, COPPER, CARD_BG, CARD_GLOW, CARD_GLOW_BORDER,
  FONT_EDITORIAL, INT_COLORS,
} from '../lib/theme.ts';
import type { TimeWindow } from '../lib/analyticsUtils.ts';
import type { SessionSummary, Intention, SessionsResponse, IntentionsResponse, CalendarIntention } from '../types/api.ts';

const LS_TAB_KEY = 'j2_atlas_tab';
type AtlasTab = 'timeline' | 'prism' | 'library' | 'calendar';
const TABS: { id: AtlasTab; label: string }[] = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'prism',    label: 'Prism'    },
  { id: 'library',  label: 'Library'  },
  { id: 'calendar', label: 'Calendar' },
];

// ── Atlas page ─────────────────────────────────────────────────────────────

export default function AtlasPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  // Mobile fallback: Atlas is desktop-only. Redirect to the traditional
  // calendar view on narrow viewports so bookmarks don't break.
  useEffect(() => {
    if (!isDesktop) navigate('/calendar', { replace: true });
  }, [isDesktop, navigate]);

  const [tab, setTab] = useState<AtlasTab>(() => {
    const stored = localStorage.getItem(LS_TAB_KEY);
    return TABS.some(t => t.id === stored) ? (stored as AtlasTab) : 'timeline';
  });
  useEffect(() => { localStorage.setItem(LS_TAB_KEY, tab); }, [tab]);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [intentions, setIntentions] = useState<Intention[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Calendar year navigation (tab-local state)
  const currentYear = new Date().getFullYear();
  const [calendarYear, setCalendarYear] = useState(currentYear);

  // Prism tab time-window state — mirrors AnalyticsPage's window persistence
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(() => {
    return (localStorage.getItem('j2-analytics-timeWindow') as TimeWindow) ?? '30d';
  });
  useEffect(() => { localStorage.setItem('j2-analytics-timeWindow', timeWindow); }, [timeWindow]);
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);

  // ── Fetch: Atlas is THE surface for looking back across years, so we pull
  //          the full session history (no `from` filter). Backend has no
  //          row cap — user sees every year they've logged, correctly. ──
  const fetchAll = useCallback(async () => {
    try {
      setFetchError(null);
      const [sesRes, intRes] = await Promise.all([
        api.get<SessionsResponse>('/api/sessions'),
        api.get<IntentionsResponse>('/api/intentions'),
      ]);
      setSessions(sesRes.sessions ?? []);
      setIntentions(intRes.intentions ?? []);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        setFetchError('Could not load data. Please refresh.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useOnlineRefetch(fetchAll);

  const pendingSessions = usePendingSessions();
  const allSessions = useMemo(() => [...sessions, ...pendingSessions], [sessions, pendingSessions]);

  if (!isDesktop) return null;

  return (
    <PageContent ready={!loading} loadingMessages={['Charting the year...', 'Measuring the ring...', 'Lacing up for the long look...']}>
    <div style={{ maxWidth: 1480, margin: '0 auto', padding: '64px 80px 104px' }}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 44 }}>
        <div>
          <div className="j2-label-micro" style={{ marginBottom: 16 }}>Atlas</div>
          <h1 className="j2-serif-display j2-heading-glow" style={{ fontSize: 72, margin: 0 }}>
            Look back at your training.
          </h1>
          <div className="j2-serif-italic" style={{ marginTop: 14, fontSize: 22 }}>
            Where the patterns show up — across weeks, months, and years.
          </div>
        </div>
        <SegmentedToggle tabs={TABS} value={tab} onChange={setTab} />
      </div>

      {fetchError && <p style={{ fontSize: 13, color: '#F87171', marginBottom: 16 }}>{fetchError}</p>}

      {/* ── Panels ──────────────────────────────────────────────── */}
      {tab === 'timeline' && (
        <TimelinePanel sessions={allSessions} intentions={intentions} />
      )}

      {tab === 'prism' && (
        <div
          style={{
            backgroundColor: CARD_BG,
            border: `1px solid ${CARD_GLOW_BORDER}`,
            boxShadow: CARD_GLOW,
            borderRadius: 16,
            padding: 28,
          }}
        >
          <ErrorBoundary>
            <SkillRadar
              sessions={allSessions}
              timeWindow={timeWindow}
              onWindowChange={setTimeWindow}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />
          </ErrorBoundary>
        </div>
      )}

      {tab === 'library' && <LibraryComingSoon />}

      {tab === 'calendar' && (
        <CalendarPanel
          sessions={allSessions}
          intentions={intentions}
          year={calendarYear}
          onYearChange={setCalendarYear}
          currentYear={currentYear}
          loading={loading}
          onRefetch={fetchAll}
        />
      )}
    </div>
    </PageContent>
  );
}

// ── Segmented toggle (inline — desktop-only for now) ──────────────────────

function SegmentedToggle<T extends string>({
  tabs, value, onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const idx = tabs.findIndex(t => t.id === value);
  const [geom, setGeom] = useState<{ w: number; x: number }>({ w: 0, x: 0 });
  const trackRef = (el: HTMLDivElement | null) => {
    if (!el) return;
    const child = el.children[idx] as HTMLElement | undefined;
    if (!child) return;
    const next = { w: child.offsetWidth, x: child.offsetLeft - 3 };
    if (next.w !== geom.w || next.x !== geom.x) setGeom(next);
  };
  return (
    <div
      ref={trackRef}
      style={{
        display: 'inline-flex',
        position: 'relative',
        background: 'var(--j2-surface-2)',
        border: '1px solid var(--j2-border-1)',
        borderRadius: 12,
        padding: 3,
        height: 50,
      }}
    >
      {tabs.map(t => {
        const isActive = t.id === value;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              position: 'relative',
              zIndex: 1,
              padding: '0 22px',
              height: '100%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 9,
              color: isActive ? '#fff' : 'rgba(255,255,255,0.40)',
              fontWeight: 600, fontSize: 15,
              background: 'transparent',
              cursor: 'pointer',
              transition: 'color 180ms ease',
              textTransform: 'capitalize',
            }}
          >
            {t.label}
          </button>
        );
      })}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 3, left: 3,
          width: geom.w,
          height: 'calc(100% - 6px)',
          background: COPPER,
          borderRadius: 9,
          transform: `translateX(${geom.x}px)`,
          transition: 'transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1), width 280ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          zIndex: 0,
          boxShadow: '0 2px 8px rgba(196,145,95,0.3)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// ── Timeline panel ────────────────────────────────────────────────────────

function TimelinePanel({ sessions, intentions }: { sessions: SessionSummary[]; intentions: Intention[] }) {
  const years = useMemo(() => {
    const set = new Set<number>();
    sessions.forEach(s => {
      const key = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
      set.add(new Date(key + 'T00:00:00').getFullYear());
    });
    return Array.from(set).sort((a, b) => b - a); // newest first
  }, [sessions]);

  if (years.length === 0) {
    return (
      <EmptyCard
        title="No sessions yet."
        body="Log your first session and your training will start appearing here — year by year."
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {years.map(year => (
        <YearCard key={year} year={year} sessions={sessions} intentions={intentions} />
      ))}
    </div>
  );
}

function YearCard({ year, sessions, intentions }: { year: number; sessions: SessionSummary[]; intentions: Intention[] }) {
  const yearSessions = useMemo(() => sessions.filter(s => {
    const key = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
    return new Date(key + 'T00:00:00').getFullYear() === year;
  }), [sessions, year]);

  const totalHours = Math.round(yearSessions.reduce((a, s) => a + (s.duration ?? 0), 0) / 60);

  // Most common primary tag — "mostly guard" style
  const topTag = useMemo(() => {
    const counts: Record<string, number> = {};
    yearSessions.forEach(s => {
      const t = s.tags?.[0];
      if (t) counts[t] = (counts[t] ?? 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return top ? (SKILL_TAGS.find(s => s.value === top)?.label ?? top) : null;
  }, [yearSessions]);

  // 52-week ribbon — colored by intention heading covering each week's mid-day
  const ribbonColors = useMemo(() => {
    const yearStart = new Date(year, 0, 1);
    return Array.from({ length: 52 }, (_, w) => {
      const mid = new Date(yearStart);
      mid.setDate(yearStart.getDate() + w * 7 + 3);
      const midStr = toDateString(mid);
      const cov = intentions.find(i => {
        const start = i.week_start.slice(0, 10);
        const end = new Date(start + 'T00:00:00');
        end.setDate(end.getDate() + (i.duration_days ?? 7) - 1);
        const endStr = toDateString(end);
        return midStr >= start && midStr <= endStr && i.heading;
      });
      if (cov?.heading) return SKILL_COLORS[cov.heading]?.stroke ?? null;
      // fallback to top tag for that week's sessions
      const weekSessions = yearSessions.filter(s => {
        const key = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
        const d = new Date(key + 'T00:00:00').getTime();
        const a = yearStart.getTime() + w * 7 * 86_400_000;
        const b = a + 7 * 86_400_000;
        return d >= a && d < b;
      });
      if (weekSessions.length === 0) return null;
      const counts: Record<string, number> = {};
      weekSessions.forEach(s => { const t = s.tags?.[0]; if (t) counts[t] = (counts[t] ?? 0) + 1; });
      const t = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      return t ? (SKILL_COLORS[t]?.stroke ?? null) : null;
    });
  }, [year, intentions, yearSessions]);

  return (
    <div
      style={{
        background: CARD_BG,
        border: '1px solid var(--j2-border-2)',
        borderRadius: 20,
        padding: 40,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 26 }}>
        <div>
          <div className="j2-serif-display" style={{ fontSize: 60, lineHeight: 1 }}>{year}</div>
          <div
            className="j2-serif-italic"
            style={{ fontSize: 18, color: 'rgba(255,255,255,0.60)', marginTop: 8 }}
          >
            {yearSessions.length} session{yearSessions.length === 1 ? '' : 's'} · {totalHours} hour{totalHours === 1 ? '' : 's'}
            {topTag ? <> · mostly <span style={{ color: PALE_YELLOW }}>{topTag}</span></> : null}
          </div>
        </div>
      </div>

      {/* Timeline strip */}
      <TimelineStrip year={year} sessions={yearSessions} />

      {/* Focus ribbon (52 bars) */}
      <div
        style={{
          marginTop: 22,
          display: 'flex',
          gap: 2,
          height: 14,
          borderRadius: 7,
          overflow: 'hidden',
          border: '1px solid var(--j2-border-1)',
        }}
      >
        {ribbonColors.map((c, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              background: c ?? 'rgba(255,255,255,0.03)',
              opacity: c ? 0.7 : 1,
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex', gap: 24, marginTop: 18,
          fontSize: 13, color: 'rgba(255,255,255,0.40)',
        }}
      >
        {SKILL_TAGS.map(tag => (
          <div
            key={tag.value}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              letterSpacing: '0.14em', textTransform: 'uppercase',
            }}
          >
            <span
              style={{
                width: 14, height: 14,
                background: SKILL_COLORS[tag.value]?.stroke ?? COPPER,
                borderRadius: 2,
              }}
            />
            {tag.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineStrip({ year, sessions }: { year: number; sessions: SessionSummary[] }) {
  const width = 1100;
  const height = 80;
  const yearStart = new Date(year, 0, 1);

  return (
    <div style={{ position: 'relative', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: 'block' }}>
        {/* Month grid */}
        {Array.from({ length: 12 }).map((_, m) => (
          <g key={m}>
            <line x1={(m / 12) * width} y1={0} x2={(m / 12) * width} y2={height} stroke="rgba(255,255,255,0.04)" />
            <text
              x={(m / 12) * width + 6}
              y={14}
              fontSize={9.5}
              fill="rgba(255,255,255,0.35)"
              letterSpacing={2}
              fontWeight={600}
            >
              {['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][m]}
            </text>
          </g>
        ))}
        {/* Session dots */}
        {sessions.map(s => {
          const key = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
          const d = new Date(key + 'T00:00:00');
          const dayOfYear = (d.getTime() - yearStart.getTime()) / 86_400_000;
          const x = (dayOfYear / 365) * width;
          const intensity = Math.max(1, Math.min(5, s.intensity ?? 3));
          const y = height - 20 - intensity * 6;
          return (
            <circle
              key={s.id}
              cx={x}
              cy={y}
              r={2 + intensity * 0.8}
              fill={INT_COLORS[intensity as 1 | 2 | 3 | 4 | 5] ?? '#CDDFA0'}
              opacity={0.85}
            >
              <title>{key} · intensity {intensity} · {s.duration ?? 0}m</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}

// ── Library panel (Coming Soon) ───────────────────────────────────────────

function LibraryComingSoon() {
  return (
    <div
      style={{
        position: 'relative',
        background: CARD_BG,
        border: `1px solid ${CARD_GLOW_BORDER}`,
        boxShadow: CARD_GLOW,
        borderRadius: 20,
        padding: '120px 56px',
        overflow: 'hidden',
        minHeight: 580,
      }}
    >
      {/* Local seigaiha backdrop inside the card only */}
      <div
        className="j2-seigaiha-bg"
        aria-hidden
        style={{ position: 'absolute' }}
      />
      <div
        style={{
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', textAlign: 'center',
          gap: 22, maxWidth: 720, margin: '0 auto',
        }}
      >
        <div className="j2-label-copper">◇ Library</div>
        <h2 className="j2-serif-display j2-heading-glow" style={{ fontSize: 68, margin: 0, lineHeight: 1.1 }}>
          A technique catalog,<br />
          <span className="j2-serif-italic" style={{ color: COPPER, fontStyle: 'italic' }}>coming soon.</span>
        </h2>
        <p
          style={{
            fontSize: 19, lineHeight: 1.65,
            color: 'rgba(255,255,255,0.60)',
            marginTop: 8,
          }}
        >
          Journada&rsquo;s Library will give each technique its own page — videos, drill notes,
          the belts you added it at, and every session where it showed up. Until then, your
          training keeps getting captured by the tools you&rsquo;re already using.
        </p>
        <div
          style={{
            marginTop: 12,
            fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.30)',
          }}
        >
          On the roadmap
        </div>
      </div>
    </div>
  );
}

// ── Calendar panel (traditional TrainingHeatmap) ──────────────────────────

function CalendarPanel({
  sessions, intentions, year, onYearChange, currentYear, loading, onRefetch,
}: {
  sessions: SessionSummary[];
  intentions: Intention[];
  year: number;
  onYearChange: (y: number) => void;
  currentYear: number;
  loading: boolean;
  onRefetch: () => void;
}) {
  // TrainingHeatmap wants a CalendarIntention subset; our Intention type
  // already contains the required fields (structurally assignable).
  const calIntentions: CalendarIntention[] = intentions;

  return (
    <div>
      {/* Year navigation — sits above the heatmap */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <div
          style={{
            display: 'inline-flex', alignItems: 'center',
            background: 'var(--j2-surface-2)',
            border: '1px solid var(--j2-border-1)',
            borderRadius: 10,
            padding: 2,
            height: 36,
          }}
        >
          <button
            onClick={() => onYearChange(year - 1)}
            style={{
              width: 34, height: 32, borderRadius: 8,
              background: 'transparent', cursor: 'pointer',
              color: 'rgba(242,228,168,0.65)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Previous year"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span
            style={{
              width: 54, textAlign: 'center',
              fontFamily: FONT_EDITORIAL, fontSize: 16, fontWeight: 600,
              color: PALE_YELLOW, letterSpacing: '0.02em',
            }}
          >
            {year}
          </span>
          <button
            onClick={() => onYearChange(year + 1)}
            disabled={year >= currentYear}
            style={{
              width: 34, height: 32, borderRadius: 8,
              background: 'transparent',
              cursor: year >= currentYear ? 'not-allowed' : 'pointer',
              opacity: year >= currentYear ? 0.25 : 1,
              color: 'rgba(242,228,168,0.65)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Next year"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      <ErrorBoundary>
        <TrainingHeatmap
          sessions={sessions}
          intentions={calIntentions}
          loading={loading}
          onSessionUpdated={onRefetch}
          onGoToToday={() => onYearChange(currentYear)}
          year={year}
        />
      </ErrorBoundary>
    </div>
  );
}

// ── Small shared helpers ──────────────────────────────────────────────────

function EmptyCard({ title, body }: { title: string; body: string }) {
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
      <h2 className="j2-serif-display" style={{ fontSize: 28, margin: 0 }}>{title}</h2>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.50)', lineHeight: 1.6, marginTop: 10 }}>
        {body}
      </p>
    </div>
  );
}
