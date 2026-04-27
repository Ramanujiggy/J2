// Atlas — desktop-only aggregate view with 4 sub-tabs:
//
//   • Timeline — year-by-year horizontal strips with session dots + focus ribbon
//   • Prism    — merged Prism Lab + Analytics: time-windowed pentagon (BigPrism)
//                with 5-view sub-rail, hero stats strip, alignment overlay, and
//                vertex-selected sessions/intentions panel below
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
import { useCountUp } from '../hooks/useCountUp.ts';
import PageContent from '../components/PageContent.tsx';
import TrainingHeatmap from '../components/TrainingHeatmap.tsx';
import ErrorBoundary from '../components/ErrorBoundary.tsx';
import { SKILL_COLORS } from '../components/charts/RadarChart.tsx';
import { SKILL_TAGS } from '../lib/constants.ts';
import { toDateString, formatDuration, addDays } from '../lib/sessionUtils.ts';
import {
  type TimeWindow, WINDOW_DAYS,
  sessionPillarHours, computeAlignment, topTagInRange, tagHoursInRange, formatWeekShort,
} from '../lib/analyticsUtils.ts';
import {
  PALE_YELLOW, COPPER, CARD_BG, CARD_GLOW, CARD_GLOW_BORDER,
  FONT_EDITORIAL, INT_COLORS, GLOW_SOFT,
} from '../lib/theme.ts';
import type { SessionSummary, Intention, SessionsResponse, IntentionsResponse, CalendarIntention } from '../types/api.ts';
import AtlasPrismDeck from '../components/atlas/AtlasPrismDeck.tsx';

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

  // Mobile renders Prism-only (the merged analytics view). The other Atlas
  // tabs (Timeline / Library / Calendar) stay desktop-only for now —
  // Calendar mobile users have the dedicated `/calendar` route in the
  // bottom nav, Timeline/Library don't have mobile analogues yet.
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

  // Prism tab state — lifted so the user's window/vertex selections persist
  // across Atlas-tab switches (they unmount the panel otherwise).
  // localStorage key kept as `j2-analytics-timeWindow` so existing user
  // preferences carry over from the retired /analytics route.
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(() => {
    if (typeof window === 'undefined') return '30d';
    const stored = window.localStorage.getItem('j2-analytics-timeWindow');
    return (stored as TimeWindow) ?? '30d';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('j2-analytics-timeWindow', timeWindow);
    }
  }, [timeWindow]);
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>(SKILL_TAGS[0]!.value);

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

  // ── Mobile: Prism-only ───────────────────────────────────────────────
  if (!isDesktop) {
    return (
      <PageContent ready={!loading} loadingMessages={['Charting the year...']}>
        <div className="mx-auto space-y-4 max-w-5xl px-4 sm:px-6 py-6">
          <div>
            <h2
              className="text-2xl font-display font-bold tracking-tight"
              style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}
            >
              Atlas
            </h2>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
              The patterns in your training
            </p>
          </div>
          {fetchError && <p className="text-sm text-red-400">{fetchError}</p>}
          <PrismPanel
            sessions={allSessions}
            intentions={intentions}
            timeWindow={timeWindow}
            onWindowChange={setTimeWindow}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            onOpenSession={(id) => navigate(`/journal/${id}`)}
            onOpenIntentionJournal={(id) => navigate(`/intentions/${id}/journal`)}
            isDesktop={false}
          />
        </div>
      </PageContent>
    );
  }

  // ── Desktop: full 4-tab editorial layout ─────────────────────────────
  return (
    <PageContent ready={!loading} loadingMessages={['Charting the year...', 'Measuring the ring...', 'Lacing up for the long look...']}>
    <div style={{ maxWidth: 1680, margin: '0 auto', padding: '64px 64px 104px' }}>

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
        <PrismPanel
          sessions={allSessions}
          intentions={intentions}
          timeWindow={timeWindow}
          onWindowChange={setTimeWindow}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
          selectedTag={selectedTag}
          onSelectTag={setSelectedTag}
          onOpenSession={(id) => navigate(`/journal/${id}`)}
          onOpenIntentionJournal={(id) => navigate(`/intentions/${id}/journal`)}
          isDesktop={true}
        />
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

// ── Prism panel — merged Atlas/Analytics view ─────────────────────────────
// Vertical layout:
//   1. Hero stats strip (lifted from former AnalyticsPage)
//   2. AtlasPrismDeck (5 sub-views: Prism / Volume / Split / Format / Weekly)
//   3. Selected-vertex readout (4 stat cards)
//   4. Recent sessions for selected vertex

function PrismPanel({
  sessions, intentions, timeWindow, onWindowChange, customRange, onCustomRangeChange,
  selectedTag, onSelectTag, onOpenSession, onOpenIntentionJournal, isDesktop,
}: {
  sessions: SessionSummary[];
  intentions: Intention[];
  timeWindow: TimeWindow;
  onWindowChange: (w: TimeWindow) => void;
  customRange: { start: string; end: string } | null;
  onCustomRangeChange: (r: { start: string; end: string } | null) => void;
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  onOpenSession: (id: string) => void;
  onOpenIntentionJournal: (id: string) => void;
  isDesktop: boolean;
}) {
  // ── Hero stats — filtered to current time window ──
  const filtered = useMemo(() => {
    if (timeWindow === 'custom' && customRange) {
      const start = new Date(customRange.start + 'T00:00:00');
      const end   = new Date(customRange.end   + 'T23:59:59');
      return sessions.filter(s => {
        const d = new Date(s.date + 'T00:00:00');
        return d >= start && d <= end;
      });
    }
    const days = WINDOW_DAYS[timeWindow];
    const cutoff = days != null ? new Date(Date.now() - days * 86_400_000) : null;
    return cutoff ? sessions.filter(s => new Date(s.date) >= cutoff) : sessions;
  }, [sessions, timeWindow, customRange]);

  const priorFiltered = useMemo(() => {
    if (timeWindow === 'custom') return null;
    const days = WINDOW_DAYS[timeWindow];
    if (!days) return null;
    const cutoff      = new Date(Date.now() - days * 86_400_000);
    const priorCutoff = new Date(Date.now() - days * 2 * 86_400_000);
    return sessions.filter(s => {
      const d = new Date(s.date + 'T00:00:00');
      return d >= priorCutoff && d < cutoff;
    });
  }, [sessions, timeWindow]);

  const totalHours = filtered.reduce((sum, s) => sum + (s.duration ?? 0) / 60, 0);
  const sessionCount = filtered.length;

  // For 'all' (no fixed window), measure the actual span from earliest session
  // to today so weekly averages don't lie. Otherwise use the preset.
  const windowDays = useMemo(() => {
    if (timeWindow === 'custom' && customRange) {
      const start = new Date(customRange.start + 'T00:00:00').getTime();
      const end   = new Date(customRange.end   + 'T23:59:59').getTime();
      return Math.max(1, Math.round((end - start) / 86_400_000));
    }
    const days = WINDOW_DAYS[timeWindow];
    if (days != null) return days;
    if (filtered.length === 0) return 1;
    const earliest = Math.min(...filtered.map(s => new Date((typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date))) + 'T00:00:00').getTime()));
    return Math.max(1, Math.ceil((Date.now() - earliest) / 86_400_000));
  }, [timeWindow, customRange, filtered]);

  const avgPerWeek = windowDays > 0 ? totalHours / (windowDays / 7) : 0;
  const priorTotalHours = priorFiltered?.reduce((sum, s) => sum + (s.duration ?? 0) / 60, 0) ?? null;

  function delta(current: number, prior: number | null): string | null {
    if (prior === null || prior < 0.01) return null;
    const p = Math.round(((current - prior) / prior) * 100);
    return (p >= 0 ? '↑' : '↓') + Math.abs(p) + '%';
  }
  const hoursDelta = delta(totalHours, priorTotalHours);

  const animHours    = useCountUp(Math.round(totalHours * 10) / 10);
  const animSessions = useCountUp(sessionCount);
  const animAvg      = useCountUp(Math.round(avgPerWeek * 10) / 10);

  const WINDOW_LABELS: Partial<Record<TimeWindow, string>> = {
    '7d': 'last 7 days', '14d': 'last 2 weeks', '30d': 'last 30 days',
    '90d': 'last 90 days', '180d': 'last 6 months', '1y': 'last year',
    'all': 'all time',
  };
  const windowLabel = timeWindow === 'custom' ? 'custom range' : (WINDOW_LABELS[timeWindow] ?? 'all time');
  // Detect the unbounded case so stat-card subs can adapt their copy.
  const isAllTime = timeWindow === 'all' || (timeWindow === 'custom' && !customRange);

  // ── Selected-vertex stats ──
  // ALL pillar stats source from `filtered` so the Selected Vertex card
  // reflects the active time window. When the user picks "All time", filtered
  // === sessions and the values match the career-long view.
  const pillarStats = useMemo(() => {
    const stats: Record<string, { count: number; minutes: number; intensitySum: number }> = {};
    SKILL_TAGS.forEach(t => { stats[t.value] = { count: 0, minutes: 0, intensitySum: 0 }; });
    filtered.forEach(s => {
      // pillar_distribution-aware: a session contributes proportionally to each
      // pillar that had weight, so multi-chip sessions don't double-count.
      const ph = sessionPillarHours(s);
      const totalH = (s.duration ?? 0) / 60;
      for (const [k, v] of Object.entries(ph)) {
        if (k in stats && v > 0 && totalH > 0) {
          const share = v / totalH;
          stats[k]!.count += share;
          stats[k]!.minutes += v * 60;
          stats[k]!.intensitySum += (s.intensity ?? 3) * share;
        }
      }
    });
    return stats;
  }, [filtered]);

  const totalCount = filtered.length;
  const selected = pillarStats[selectedTag] ?? { count: 0, minutes: 0, intensitySum: 0 };
  const selectedLabel = SKILL_TAGS.find(t => t.value === selectedTag)?.label ?? selectedTag;

  // Intentions whose week_start falls in the active window. Mirrors the
  // semantics of `filtered` for sessions.
  const intentionsInWindow = useMemo(() => {
    if (isAllTime) return intentions;
    let windowStart: Date | null = null;
    let windowEnd: Date | null = null;
    if (timeWindow === 'custom' && customRange) {
      windowStart = new Date(customRange.start + 'T00:00:00');
      windowEnd   = new Date(customRange.end   + 'T23:59:59');
    } else {
      const days = WINDOW_DAYS[timeWindow];
      if (days != null) windowStart = new Date(Date.now() - days * 86_400_000);
    }
    return intentions.filter(i => {
      const ws = new Date(i.week_start + 'T00:00:00');
      if (windowStart && ws < windowStart) return false;
      if (windowEnd && ws > windowEnd) return false;
      return true;
    });
  }, [intentions, timeWindow, customRange, isAllTime]);

  const weeksAsFocus = intentionsInWindow.filter(i => i.heading === selectedTag).length;
  const avgIntensity = selected.count > 0 ? selected.intensitySum / selected.count : 0;

  // Recent sessions for the selected vertex — windowed.
  const recentSessions = useMemo(() => {
    return filtered
      .filter(s => s.tags?.includes(selectedTag) || s.heading === selectedTag)
      .slice()
      .sort((a, b) => {
        const ak = typeof a.date === 'string' ? a.date.slice(0, 10) : toDateString(new Date(a.date));
        const bk = typeof b.date === 'string' ? b.date.slice(0, 10) : toDateString(new Date(b.date));
        return bk.localeCompare(ak);
      })
      .slice(0, 6);
  }, [filtered, selectedTag]);

  // Intentions targeting the selected vertex within the active window, with
  // alignment computed from the original (un-windowed) sessions so an
  // intention's score reflects the full week it covered, even if the window
  // chops a piece off.
  const focusIntentions = useMemo(() => {
    return intentionsInWindow
      .filter(i => i.heading === selectedTag)
      .slice()
      .sort((a, b) => b.week_start.localeCompare(a.week_start))
      .slice(0, 6)
      .map(i => {
        const top   = topTagInRange(sessions, i.week_start, i.duration_days);
        const hours = tagHoursInRange(sessions, i.week_start, i.duration_days);
        const a     = computeAlignment(i, top, hours);
        return { intention: i, alignment: a };
      });
  }, [intentionsInWindow, sessions, selectedTag]);

  const descriptions: Record<string, string> = {
    standup:     'Where it begins. Grip fighting, entries, takedowns, the scramble before the mat.',
    guard:       'Where you live on your back. Sweeps, submissions, off-balancing — the long exchange.',
    passing:     'The long game above the legs. Pressure, angles, and the patience of the knee-cut.',
    pins:        'Mount, side, back — dynamic control. The art of staying and arriving.',
    submissions: 'The ending itself. Finish mechanics that carry across every belt.',
  };

  return (
    <>
      {/* ── Hero stats strip ───────────────────────────────────────────
          Three columns share the same card chrome as the deck and selected-
          vertex card below — consistent visual weight unifies the page. */}
      <div
        className="rounded-2xl flex animate-j2-card-enter select-none"
        style={{
          backgroundColor: CARD_BG,
          border: `1px solid ${CARD_GLOW_BORDER}`,
          boxShadow: CARD_GLOW,
          marginBottom: isDesktop ? 20 : 16,
        }}
      >
        <div className="flex-1 flex flex-col items-center justify-center py-5 gap-1">
          <div className="flex items-baseline gap-2">
            <span style={{ fontSize: isDesktop ? 30 : 24, fontFamily: FONT_EDITORIAL, fontWeight: 600, color: PALE_YELLOW, textShadow: GLOW_SOFT, lineHeight: 1 }}>
              {animHours.toFixed(1)}h
            </span>
            {hoursDelta && (
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: hoursDelta.startsWith('↑') ? 'rgba(82,181,108,0.90)' : 'rgba(218,90,70,0.80)',
              }}>
                {hoursDelta}
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em' }}>
            Hours, {windowLabel}
          </span>
        </div>
        <div className="w-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <div className="flex-1 flex flex-col items-center justify-center py-5 gap-1">
          <span style={{ fontSize: isDesktop ? 30 : 24, fontFamily: FONT_EDITORIAL, fontWeight: 600, color: PALE_YELLOW, textShadow: GLOW_SOFT, lineHeight: 1 }}>
            {Math.round(animSessions)}
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em' }}>
            {sessionCount === 1 ? 'session' : 'sessions'} logged
          </span>
        </div>
        <div className="w-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <div className="flex-1 flex flex-col items-center justify-center py-5 gap-1">
          <span style={{ fontSize: isDesktop ? 30 : 24, fontFamily: FONT_EDITORIAL, fontWeight: 600, color: PALE_YELLOW, textShadow: GLOW_SOFT, lineHeight: 1 }}>
            {animAvg.toFixed(1)}h
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em' }}>
            average per week
          </span>
        </div>
      </div>

      {/* ── 5-view deck (Prism / Volume / Split / Format / Weekly) ────── */}
      <ErrorBoundary>
        <AtlasPrismDeck
          sessions={sessions}
          intentions={intentions}
          timeWindow={timeWindow}
          onWindowChange={onWindowChange}
          customRange={customRange}
          onCustomRangeChange={onCustomRangeChange}
          selectedTag={selectedTag}
          onSelectTag={onSelectTag}
          bigPrismSize={isDesktop ? 520 : 280}
        />
      </ErrorBoundary>

      {/* ── Selected vertex card — title row + stat strip + 2 columns ──
          Consolidates what used to be two stacked cards. The user just
          clicked a vertex; reward them with concrete sessions + intentions
          immediately, with stats inlined as supporting context. */}
      <div
        style={{
          backgroundColor: CARD_BG,
          border: `1px solid ${CARD_GLOW_BORDER}`,
          boxShadow: CARD_GLOW,
          borderRadius: isDesktop ? 20 : 16,
          padding: isDesktop ? 32 : 20,
          marginTop: isDesktop ? 24 : 16,
        }}
      >
        {/* Header row: label + name + stat metadata strip */}
        <div
          style={{
            display: 'flex',
            flexDirection: isDesktop ? 'row' : 'column',
            alignItems: isDesktop ? 'flex-end' : 'flex-start',
            justifyContent: 'space-between',
            gap: isDesktop ? 32 : 14,
            marginBottom: isDesktop ? 28 : 20,
            paddingBottom: isDesktop ? 20 : 16,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div className="j2-label-copper" style={{ marginBottom: 6 }}>◇ Selected vertex</div>
            <div className="j2-serif-display j2-heading-glow" style={{ fontSize: isDesktop ? 44 : 32, lineHeight: 1 }}>
              {selectedLabel}
            </div>
            <p
              style={{
                fontSize: isDesktop ? 14 : 13, lineHeight: 1.55,
                color: 'rgba(255,255,255,0.50)',
                marginTop: 8, marginBottom: 0,
                maxWidth: isDesktop ? 460 : 'none',
              }}
            >
              {descriptions[selectedTag] ?? 'Your training in this pillar.'}
            </p>
          </div>

          {/* Inline stat strip — 4 small readouts */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, auto)',
              columnGap: isDesktop ? 28 : 18,
              rowGap: 4,
              flexShrink: 0,
            }}
          >
            {([
              {
                k: 'Sessions',
                v: Math.round(selected.count),
                sub: totalCount > 0 && selected.count > 0
                  ? `${Math.round(selected.count / totalCount * 100)}% of mat time`
                  : (isAllTime ? 'none yet' : 'none in window'),
              },
              {
                k: 'Hours',
                v: Math.round(selected.minutes / 60),
                sub: windowLabel,
              },
              {
                k: 'Weeks as focus',
                v: weeksAsFocus,
                sub: weeksAsFocus === 1 ? 'week set this intent' : 'weeks set this intent',
              },
              {
                k: 'Avg intensity',
                v: selected.count > 0 ? avgIntensity.toFixed(1) : '—',
                sub: selected.count > 0 ? 'on a 5-point scale' : 'log one to see',
              },
            ]).map((s, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div className="j2-label-micro" style={{ fontSize: 10, marginBottom: 2 }}>{s.k}</div>
                <div
                  style={{
                    fontSize: isDesktop ? 24 : 20, fontFamily: FONT_EDITORIAL, fontWeight: 600,
                    color: PALE_YELLOW, lineHeight: 1,
                  }}
                >
                  {s.v}
                </div>
                <div
                  style={{
                    fontSize: 10, color: 'rgba(255,255,255,0.40)',
                    marginTop: 2, letterSpacing: '0.06em',
                  }}
                >
                  {s.sub}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Two columns: Recent sessions | Intentions for this focus */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr',
            gap: isDesktop ? 32 : 24,
          }}
        >
          {/* Left column — Recent sessions */}
          <div>
            <div className="j2-label-copper" style={{ marginBottom: 14 }}>
              ◈ Recent sessions
            </div>
            {recentSessions.length === 0 ? (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)', fontStyle: 'italic' }}>
                {isAllTime
                  ? 'No sessions logged with this focus yet.'
                  : `No ${selectedLabel} sessions in this window.`}
              </p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: isDesktop ? 12 : 10,
                }}
              >
                {recentSessions.map(s => {
                  const dateStr = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
                  const d = new Date(dateStr + 'T00:00:00');
                  const intensity = Math.max(1, Math.min(5, s.intensity ?? 3));
                  const intColor = INT_COLORS[intensity as 1 | 2 | 3 | 4 | 5] ?? '#A8CB72';
                  return (
                    <button
                      key={s.id}
                      onClick={() => onOpenSession(s.id)}
                      style={{
                        padding: isDesktop ? 16 : 14,
                        background: 'var(--j2-surface-2)',
                        border: '1px solid var(--j2-border-1)',
                        borderRadius: 12,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 160ms ease, transform 160ms ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'var(--j2-surface-2)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div className="j2-label-micro" style={{ fontSize: 10 }}>
                        {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <span
                          style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: intColor,
                            boxShadow: `0 0 8px ${intColor}60`,
                            flexShrink: 0,
                          }}
                        />
                        <div
                          style={{
                            fontSize: 14, fontFamily: FONT_EDITORIAL,
                            color: 'rgba(255,255,255,0.90)',
                          }}
                        >
                          {formatDuration(s.duration ?? 0)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column — Intentions for this focus */}
          <div>
            <div className="j2-label-copper" style={{ marginBottom: 16 }}>
              ◇ Intentions for {selectedLabel}
            </div>
            {focusIntentions.length === 0 ? (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)', fontStyle: 'italic' }}>
                No intentions have targeted this pillar yet.
              </p>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--j2-surface-2)', border: '1px solid var(--j2-border-1)' }}>
                {focusIntentions.map(({ intention, alignment }, i) => {
                  const endDate = addDays(intention.week_start, intention.duration_days);
                  return (
                    <button
                      key={intention.id}
                      onClick={() => onOpenIntentionJournal(intention.id)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                        background: 'transparent',
                        border: 'none',
                        borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 160ms ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div
                        style={{
                          width: 5, height: 28, borderRadius: 999,
                          backgroundColor:
                            alignment.status === 'aligned'  ? 'rgba(82,181,108,0.70)'
                          : alignment.status === 'diverged' ? 'rgba(218,116,34,0.50)'
                          : 'rgba(255,255,255,0.06)',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13, fontWeight: 600,
                            color: 'rgba(255,255,255,0.85)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                        >
                          {intention.intent_label || selectedLabel}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginTop: 2 }}>
                          {formatWeekShort(intention.week_start)} – {formatWeekShort(endDate)}
                        </div>
                      </div>
                      {alignment.status !== 'no-data' ? (
                        <span
                          style={{
                            fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
                            backgroundColor:
                              alignment.status === 'aligned' ? 'rgba(82,181,108,0.12)' : 'rgba(218,116,34,0.12)',
                            color:
                              alignment.status === 'aligned' ? 'rgba(82,181,108,0.85)' : 'rgba(218,116,34,0.75)',
                            flexShrink: 0,
                          }}
                        >
                          {alignment.score !== null ? `${alignment.score}%` : (alignment.status === 'aligned' ? 'Aligned' : 'Diverged')}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, fontStyle: 'italic', color: 'rgba(255,255,255,0.20)', flexShrink: 0 }}>
                          No data
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// (BigPrism extracted to components/atlas/BigPrism.tsx — animation transitions
// + normalized-prop API live there now.)

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
