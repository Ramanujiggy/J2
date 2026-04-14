import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { api, ApiError } from '../lib/api.ts';
import { useOnlineRefetch } from '../hooks/useOnlineRefetch.ts';
import { usePendingSessions } from '../hooks/usePendingSessions.ts';
import SkillRadar from '../components/SkillRadar.tsx';
import ErrorBoundary from '../components/ErrorBoundary.tsx';
import { PALE_YELLOW, GLOW_SOFT, CARD_BG, COPPER, COPPER_BORDER, CARD_SHADOW, SURFACE_2, SURFACE_2_BORDER } from '../lib/theme.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import type { SessionSummary, SessionsResponse, Intention } from '../types/api.ts';
import PageContent from '../components/PageContent.tsx';
import { SKILL_TAGS, CATEGORY_COLORS } from '../lib/constants.ts';
import { type TimeWindow, WINDOW_DAYS, formatWeekShort, topTagInRange, computeAlignment } from '../lib/analyticsUtils.ts';
import { useCountUp } from '../hooks/useCountUp.ts';
import { vibrate } from '../lib/haptics.ts';

const LS_WINDOW_KEY = 'j2-analytics-timeWindow';

// ── Time window labels for the stat strip ────────────────────────────────────
const WINDOW_LABELS: Partial<Record<TimeWindow, string>> = {
  '7d': '7 days', '14d': '2 weeks', '30d': '30 days',
  '90d': '90 days', '180d': '6 months', '1y': '1 year',
};

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

  // ── Dominant skill (for insight sentence) ──
  const dominantSkill = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of filtered) {
      for (const t of s.tags ?? []) { counts[t] = (counts[t] ?? 0) + 1; }
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? (SKILL_TAGS.find(s => s.value === top[0])?.label ?? top[0]) : null;
  }, [filtered]);

  // ── Insight sentence ──
  const insightSentence = useMemo(() => {
    if (filtered.length === 0) return 'No sessions in this window. Roll around, it counts.';
    const deltaNum = priorTotalHours != null && priorTotalHours >= 0.01
      ? Math.round(((totalHours - priorTotalHours) / priorTotalHours) * 100) : null;
    if (deltaNum != null && deltaNum >= 20) return `Volume is up ${deltaNum}% from the prior period. Momentum.`;
    if (deltaNum != null && deltaNum <= -20) return `Volume is down ${Math.abs(deltaNum)}% from the prior period. The mat is patient.`;
    if (dominantSkill) return `Your training is gravitating toward ${dominantSkill}.`;
    return 'Keep showing up.';
  }, [filtered, totalHours, priorTotalHours, dominantSkill]);

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
        className="text-2xl font-bold tracking-tight"
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
              <span className="text-[11px] font-semibold" style={{
                color: hoursDelta.startsWith('↑') ? 'rgba(82,181,108,0.85)' : 'rgba(218,90,70,0.75)',
              }}>
                {hoursDelta}
              </span>
            )}
          </div>
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
            {windowLabel}
          </span>
        </div>
        <div className="w-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
          <span className="text-lg font-bold" style={{ color: PALE_YELLOW }}>
            {Math.round(animSessions)}
          </span>
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
            sessions
          </span>
        </div>
        <div className="w-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <div className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
          <span className="text-lg font-bold" style={{ color: PALE_YELLOW }}>
            {animAvg.toFixed(1)}h
          </span>
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
            avg / wk
          </span>
        </div>
      </div>

      {/* ── Insight sentence ─────────────────────────────────── */}
      <p
        className="text-sm leading-relaxed animate-j2-card-enter"
        style={{ color: 'rgba(255,255,255,0.45)', animationDelay: '40ms' }}
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
        <div className="animate-j2-card-enter" style={{ animationDelay: '120ms' }}>
          {/* Section header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.80)' }}>
              Intention vs Training Telemetry
            </h3>
            <button
              onClick={() => { vibrate(8); navigate('/intentions'); }}
              className="flex items-center gap-0.5 text-xs font-medium touch-manipulation j2-press"
              style={{ color: COPPER }}
            >
              View all <ChevronRight size={13} strokeWidth={2} />
            </button>
          </div>

          {/* Intention cards — matching IntentionsPage visual pattern */}
          <div className="space-y-2.5">
            {intentions.map(intention => {
              const top       = topTagInRange(allSessions, intention.week_start, intention.duration_days);
              const alignment = computeAlignment(intention, top);
              const headingLabel = intention.heading
                ? (SKILL_TAGS.find(s => s.value === intention.heading)?.label ?? intention.heading)
                : null;

              return (
                <button
                  key={intention.id}
                  onClick={() => { vibrate(8); navigate(`/intentions/${intention.id}/journal`); }}
                  className="w-full text-left rounded-xl px-4 py-3.5 flex items-center gap-3 j2-press touch-manipulation"
                  style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  {/* Alignment bar */}
                  <div
                    className="rounded-full flex-shrink-0"
                    style={{
                      width: 4, height: 32,
                      backgroundColor: alignment === 'aligned'  ? 'rgba(82,181,108,0.70)'
                                     : alignment === 'diverged' ? 'rgba(218,116,34,0.50)'
                                     : 'rgba(255,255,255,0.06)',
                    }}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.90)' }}>
                        {headingLabel ?? intention.intent_label}
                      </span>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.30)' }}>
                        {formatWeekShort(intention.week_start)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {top ? (
                        <>
                          <span className="text-xs font-medium" style={{ color: COPPER }}>
                            Trained: {top.label}
                          </span>
                          {alignment !== 'no-data' && (
                            <span className="text-[10px]" style={{
                              color: alignment === 'aligned' ? 'rgba(82,181,108,0.65)' : 'rgba(218,116,34,0.50)',
                            }}>
                              {alignment === 'aligned' ? 'Aligned' : 'Diverged'}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs italic" style={{ color: 'rgba(255,255,255,0.20)' }}>
                          No sessions logged
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  <ChevronRight size={14} strokeWidth={2} style={{ color: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        </div>
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
            border: `1px solid ${COPPER_BORDER}`,
            boxShadow: CARD_SHADOW,
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
