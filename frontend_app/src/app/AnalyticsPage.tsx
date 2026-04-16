import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { api, ApiError } from '../lib/api.ts';
import { useOnlineRefetch } from '../hooks/useOnlineRefetch.ts';
import { usePendingSessions } from '../hooks/usePendingSessions.ts';
import SkillRadar from '../components/SkillRadar.tsx';
import ErrorBoundary from '../components/ErrorBoundary.tsx';
import { PALE_YELLOW, GLOW_SOFT, CARD_BG, COPPER, CARD_GLOW, CARD_GLOW_BORDER, SURFACE_2, SURFACE_2_BORDER } from '../lib/theme.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import type { SessionSummary, SessionsResponse, Intention } from '../types/api.ts';
import PageContent from '../components/PageContent.tsx';
import { SKILL_TAGS } from '../lib/constants.ts';
import { addDays } from '../lib/sessionUtils.ts';
import { type TimeWindow, WINDOW_DAYS, formatWeekShort, topTagInRange, computeAlignment, tagHoursInRange } from '../lib/analyticsUtils.ts';
import { computeEntropy, computeACWR, computeDecay, rustiest } from '../lib/analyticsModels.ts';
import { useCountUp } from '../hooks/useCountUp.ts';
import { vibrate } from '../lib/haptics.ts';

const LS_WINDOW_KEY = 'j2-analytics-timeWindow';

// ── Time window labels for the stat strip ────────────────────────────────────
const WINDOW_LABELS: Partial<Record<TimeWindow, string>> = {
  '7d': '7 days', '14d': '2 weeks', '30d': '30 days',
  '90d': '90 days', '180d': '6 months', '1y': '1 year',
};

// ── Alignment Timeline ────────────────────────────────────────────────────

function AlignmentTimeline({ intentions, allSessions, navigate }: {
  intentions: Intention[];
  allSessions: SessionSummary[];
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [expanded, setExpanded] = useState(false);
  const INITIAL_SHOW = 3;

  // Compute alignment for each intention
  const rows = intentions.map(intention => {
    const top       = topTagInRange(allSessions, intention.week_start, intention.duration_days);
    const hours     = tagHoursInRange(allSessions, intention.week_start, intention.duration_days);
    const alignment = computeAlignment(intention, top, hours);
    const headingLabel = intention.heading
      ? (SKILL_TAGS.find(s => s.value === intention.heading)?.label ?? intention.heading)
      : null;
    const endDate = addDays(intention.week_start, intention.duration_days);
    return { intention, top, alignment, headingLabel, endDate };
  });

  const alignedCount = rows.filter(r => r.alignment.status === 'aligned').length;
  const withDataCount = rows.filter(r => r.alignment.status !== 'no-data').length;
  const alignPct = withDataCount > 0 ? Math.round((alignedCount / withDataCount) * 100) : 0;

  const visibleRows = expanded ? rows : rows.slice(0, INITIAL_SHOW);
  const hiddenCount = rows.length - INITIAL_SHOW;

  return (
    <div className="animate-j2-card-enter" style={{ animationDelay: '120ms' }}>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.80)' }}>
          Alignment
        </h3>
        <button
          onClick={() => { vibrate(8); navigate('/intentions'); }}
          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium min-h-[40px] touch-manipulation j2-press"
          style={{ color: COPPER, backgroundColor: 'rgba(255,255,255,0.05)' }}
        >
          View all <ChevronRight size={13} strokeWidth={2} />
        </button>
      </div>

      {/* Summary stat + progress bar */}
      {withDataCount > 0 && (
        <div className="mb-3">
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-lg font-bold" style={{ color: PALE_YELLOW }}>
              {alignedCount} of {withDataCount}
            </span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.40)' }}>
              aligned ({alignPct}%)
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${alignPct}%`,
                backgroundColor: 'rgba(82,181,108,0.70)',
                transition: 'width 600ms ease-out',
              }}
            />
          </div>
        </div>
      )}

      {/* Compact timeline rows */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}
      >
        {visibleRows.map(({ intention, top, alignment, headingLabel, endDate }, i) => (
          <button
            key={intention.id}
            onClick={() => { vibrate(8); navigate(`/intentions/${intention.id}/journal`); }}
            className="w-full text-left flex items-center gap-3 px-4 py-3 j2-press touch-manipulation min-h-[48px]"
            style={i < visibleRows.length - 1 ? { borderBottom: '1px solid rgba(255,255,255,0.04)' } : undefined}
          >
            {/* Alignment bar */}
            <div
              className="rounded-full flex-shrink-0"
              style={{
                width: 6, height: 28,
                backgroundColor: alignment.status === 'aligned'  ? 'rgba(82,181,108,0.70)'
                               : alignment.status === 'diverged' ? 'rgba(218,116,34,0.50)'
                               : 'rgba(255,255,255,0.06)',
              }}
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold block truncate" style={{ color: 'rgba(255,255,255,0.90)' }}>
                {headingLabel ?? intention.intent_label}
              </span>
              <span className="text-xs block" style={{ color: 'rgba(255,255,255,0.30)' }}>
                {formatWeekShort(intention.week_start)} – {formatWeekShort(endDate)}
              </span>
            </div>

            {/* Status pill */}
            {alignment.status !== 'no-data' ? (
              <span
                className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
                style={{
                  backgroundColor: alignment.status === 'aligned' ? 'rgba(82,181,108,0.12)' : 'rgba(218,116,34,0.12)',
                  color: alignment.status === 'aligned' ? 'rgba(82,181,108,0.80)' : 'rgba(218,116,34,0.70)',
                }}
              >
                {alignment.score !== null ? `${alignment.score}%` : (alignment.status === 'aligned' ? 'Aligned' : 'Diverged')}
              </span>
            ) : (
              <span className="text-xs italic flex-shrink-0" style={{ color: 'rgba(255,255,255,0.20)' }}>
                No data
              </span>
            )}

            <ChevronRight size={14} strokeWidth={2} style={{ color: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />
          </button>
        ))}

        {/* Show more */}
        {!expanded && hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full text-center py-3 text-xs font-medium touch-manipulation j2-press min-h-[44px]"
            style={{ color: COPPER, borderTop: '1px solid rgba(255,255,255,0.04)' }}
          >
            Show {hiddenCount} more
          </button>
        )}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [sessions,    setSessions]    = useState<SessionSummary[]>([]);
  const [intentions,  setIntentions]  = useState<Intention[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [fetchError,  setFetchError]  = useState<string | null>(null);

  // Persist selected time window across visits
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(() => {
    const stored = localStorage.getItem(LS_WINDOW_KEY);
    return (stored as TimeWindow | null) ?? '30d';
  });
  useEffect(() => { localStorage.setItem(LS_WINDOW_KEY, timeWindow); }, [timeWindow]);

  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setFetchError(null);
      const sessionUrl = (() => {
        if (timeWindow === 'custom' && customRange) {
          // Fetch prior period too for delta calculation
          const start = new Date(customRange.start + 'T00:00:00');
          const end   = new Date(customRange.end   + 'T23:59:59');
          const durationMs = end.getTime() - start.getTime();
          const priorStart = new Date(start.getTime() - durationMs).toISOString().slice(0, 10);
          return `/api/sessions?from=${priorStart}&to=${customRange.end}`;
        }
        const days = WINDOW_DAYS[timeWindow];
        // Fetch 2× the window so SkillRadar can compute prior-period deltas
        return days != null
          ? `/api/sessions?from=${new Date(Date.now() - days * 2 * 86_400_000).toISOString().slice(0, 10)}`
          : '/api/sessions';
      })();
      const [sesRes, intRes] = await Promise.all([
        api.get<SessionsResponse>(sessionUrl),
        api.get<{ intentions: Intention[] }>('/api/intentions'),
      ]);
      setSessions(sesRes.sessions ?? []);
      setIntentions(intRes.intentions ?? []);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        setFetchError('Could not load sessions. Please refresh.');
      }
    } finally {
      setLoading(false);
    }
  }, [timeWindow, customRange]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useOnlineRefetch(fetchAll);

  const pendingSessions = usePendingSessions();
  const allSessions = useMemo(() => [...sessions, ...pendingSessions], [sessions, pendingSessions]);

  // ── Filtered sessions (lifted from SkillRadar for hero stats) ──
  const filtered = useMemo(() => {
    if (timeWindow === 'custom' && customRange) {
      const start = new Date(customRange.start + 'T00:00:00');
      const end   = new Date(customRange.end   + 'T23:59:59');
      return allSessions.filter(s => {
        const d = new Date(s.date + 'T00:00:00');
        return d >= start && d <= end;
      });
    }
    const days = WINDOW_DAYS[timeWindow];
    const cutoff = days != null ? new Date(Date.now() - days * 86_400_000) : null;
    return cutoff ? allSessions.filter(s => new Date(s.date) >= cutoff) : allSessions;
  }, [allSessions, timeWindow, customRange]);

  const priorFiltered = useMemo(() => {
    if (timeWindow === 'custom') return null;
    const days = WINDOW_DAYS[timeWindow];
    if (!days) return null;
    const cutoff      = new Date(Date.now() - days * 86_400_000);
    const priorCutoff = new Date(Date.now() - days * 2 * 86_400_000);
    return allSessions.filter(s => {
      const d = new Date(s.date + 'T00:00:00');
      return d >= priorCutoff && d < cutoff;
    });
  }, [allSessions, timeWindow]);

  // ── Hero stats ──
  const totalHours     = filtered.reduce((sum, s) => sum + s.duration / 60, 0);
  const sessionCount   = filtered.length;
  const windowDays     = WINDOW_DAYS[timeWindow] ?? (customRange
    ? Math.max(1, Math.round((new Date(customRange.end + 'T23:59:59').getTime() - new Date(customRange.start + 'T00:00:00').getTime()) / 86_400_000))
    : 365);
  const avgPerWeek     = windowDays > 0 ? totalHours / (windowDays / 7) : 0;
  const priorTotalHours = priorFiltered?.reduce((sum, s) => sum + s.duration / 60, 0) ?? null;

  function delta(current: number, prior: number | null): string | null {
    if (prior === null || prior < 0.01) return null;
    const p = Math.round(((current - prior) / prior) * 100);
    return (p >= 0 ? '↑' : '↓') + Math.abs(p) + '%';
  }

  const hoursDelta = delta(totalHours, priorTotalHours);

  // ── Dominant skill (hours-weighted) ──
  const hoursMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of filtered) {
      const hrs = (s.duration ?? 0) / 60;
      for (const t of s.tags ?? []) { m[t] = (m[t] ?? 0) + hrs; }
    }
    return m;
  }, [filtered]);
  const dominantSkill = useMemo(() => {
    const top = Object.entries(hoursMap).sort((a, b) => b[1] - a[1])[0];
    return top ? (SKILL_TAGS.find(s => s.value === top[0])?.label ?? top[0]) : null;
  }, [hoursMap]);

  // ── Advanced models ──
  const entropy = useMemo(() => computeEntropy(hoursMap), [hoursMap]);
  const acwr = useMemo(() => computeACWR(allSessions), [allSessions]);
  const decay = useMemo(() => computeDecay(allSessions), [allSessions]);
  const rustiestSkill = useMemo(() => rustiest(decay), [decay]);

  // ── Insight sentence (enriched with new models) ──
  const insightSentence = useMemo(() => {
    if (filtered.length === 0) return 'No sessions in this window. Roll around, it counts.';

    const deltaNum = priorTotalHours != null && priorTotalHours >= 0.01
      ? Math.round(((totalHours - priorTotalHours) / priorTotalHours) * 100) : null;

    // Priority 1: ACWR danger zone
    if (acwr.zone === 'danger') return `Your training load has spiked — ratio at ${acwr.ratio?.toFixed(1)}. Consider a lighter session.`;

    // Priority 2: Volume swings
    if (deltaNum != null && deltaNum >= 20) return `Volume is up ${deltaNum}% from the prior period. Momentum.`;
    if (deltaNum != null && deltaNum <= -20) return `Volume is down ${Math.abs(deltaNum)}% from the prior period. The mat is patient.`;

    // Priority 3: Entropy extremes
    if (entropy.score !== null && entropy.score < 0.25) return `You're deep in specialist mode — almost all ${dominantSkill}.`;
    if (entropy.score !== null && entropy.score > 0.85) return `Your game is well-rounded. Every pillar is getting time.`;

    // Priority 4: Rustiest skill
    if (rustiestSkill && rustiestSkill.retention < 0.4 && rustiestSkill.daysSince < Infinity) {
      return `${rustiestSkill.label} is getting rusty — ${rustiestSkill.daysSince} days since your last session.`;
    }

    // Priority 5: Dominant skill
    if (dominantSkill) return `Your training is gravitating toward ${dominantSkill}.`;

    return 'Keep showing up.';
  }, [filtered, totalHours, priorTotalHours, dominantSkill, acwr, entropy, rustiestSkill]);

  // Animated stat values
  const animHours    = useCountUp(Math.round(totalHours * 10) / 10);
  const animSessions = useCountUp(sessionCount);
  const animAvg      = useCountUp(Math.round(avgPerWeek * 10) / 10);

  const windowLabel  = timeWindow === 'custom' ? 'custom range' : (WINDOW_LABELS[timeWindow] ?? 'all time');

  return (
    <PageContent ready={!loading} loadingMessages={['Counting stripes...', 'Trying to remember the technique...', 'Skipping warmups...']}>
    <div
      className={`mx-auto space-y-5 ${isDesktop ? 'max-w-6xl px-8 py-5' : 'max-w-5xl px-4 sm:px-6 py-6'}`}
      style={{ overscrollBehavior: 'none' }}
    >

      <h2
        className="text-2xl font-display font-bold tracking-tight"
        style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}
      >
        Analytics
      </h2>

      {fetchError && <p className="text-sm text-red-400">{fetchError}</p>}

      {/* ── Hero Stats Strip ─────────────────────────────────── */}
      <div
        className="rounded-xl flex animate-j2-card-enter select-none"
        style={{ backgroundColor: SURFACE_2, border: `1px solid ${SURFACE_2_BORDER}` }}
      >
        <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold" style={{ color: PALE_YELLOW }}>
              {animHours.toFixed(1)}h
            </span>
            {hoursDelta && (
              <span className="text-xs font-semibold" style={{
                color: hoursDelta.startsWith('↑') ? 'rgba(82,181,108,0.85)' : 'rgba(218,90,70,0.75)',
              }}>
                {hoursDelta}
              </span>
            )}
          </div>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
            {windowLabel}
          </span>
        </div>
        <div className="w-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
          <span className="text-lg font-bold" style={{ color: PALE_YELLOW }}>
            {Math.round(animSessions)}
          </span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
            sessions
          </span>
        </div>
        <div className="w-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
          <span className="text-lg font-bold" style={{ color: PALE_YELLOW }}>
            {animAvg.toFixed(1)}h
          </span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
            avg / wk
          </span>
        </div>
      </div>

      {/* ── Insight sentence ─────────────────────────────────── */}
      <p
        className="text-sm leading-relaxed animate-j2-card-enter"
        style={{ color: 'rgba(255,255,255,0.55)', animationDelay: '40ms' }}
      >
        {insightSentence}
      </p>

      {/* ── Skill Radar ──────────────────────────────────────── */}
      <div className="animate-j2-card-enter" style={{ animationDelay: '80ms' }}>
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

      {/* ── Intention Alignment ────────────────────────────────── */}
      {intentions.length > 0 ? (
        <AlignmentTimeline
          intentions={intentions}
          allSessions={allSessions}
          navigate={navigate}
        />
      ) : allSessions.length > 0 ? (
        /* ── Nudge: has sessions but no intentions ──────────── */
        <div
          className="rounded-xl px-5 py-4 animate-j2-card-enter"
          style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)', animationDelay: '120ms' }}
        >
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>
            Set a training intention to see how your focus aligns with your mat time.
          </p>
          <button
            onClick={() => navigate('/home')}
            className="text-xs font-medium mt-2 touch-manipulation j2-press"
            style={{ color: COPPER }}
          >
            Set Intent →
          </button>
        </div>
      ) : null}

      {/* ── Empty state: no sessions at all ──────────────────── */}
      {allSessions.length === 0 && !loading && (
        <div
          className="rounded-2xl text-center animate-j2-card-enter"
          style={{
            backgroundColor: CARD_BG,
            border: `1px solid ${CARD_GLOW_BORDER}`,
            boxShadow: CARD_GLOW,
            padding: '40px 24px',
          }}
        >
          <h3 className="text-lg font-semibold mb-2" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
            Your Analytics Await
          </h3>
          <p className="text-sm mb-4 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Log your first session to start seeing your training data here.
          </p>
          <button
            onClick={() => navigate('/home')}
            className="text-sm font-medium touch-manipulation j2-press"
            style={{ color: COPPER }}
          >
            Go to Home →
          </button>
        </div>
      )}

    </div>
    </PageContent>
  );
}
