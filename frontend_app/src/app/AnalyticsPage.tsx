import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, ApiError } from '../lib/api.ts';
import { useOnlineRefetch } from '../hooks/useOnlineRefetch.ts';
import { usePendingSessions } from '../hooks/usePendingSessions.ts';
import SkillRadar from '../components/SkillRadar.tsx';
import ErrorBoundary from '../components/ErrorBoundary.tsx';
import { PALE_YELLOW, GLOW_SOFT, CARD_BG, COPPER_BORDER, CARD_SHADOW } from '../lib/theme.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import type { SessionSummary, SessionsResponse, Intention } from '../types/api.ts';
import PageContent from '../components/PageContent.tsx';
import { CATEGORY_COLORS } from '../lib/constants.ts';
import { type TimeWindow, WINDOW_DAYS, formatWeekShort, topTagInRange, computeAlignment } from '../lib/analyticsUtils.ts';
import { useCountUp } from '../hooks/useCountUp.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import { SURFACE_2, SURFACE_2_BORDER } from '../lib/theme.ts';

const LS_WINDOW_KEY = 'j2-analytics-timeWindow';

// ── Time window labels for the stat strip ────────────────────────────────────
const WINDOW_LABELS: Partial<Record<TimeWindow, string>> = {
  '7d': '7 days', '14d': '2 weeks', '30d': '30 days',
  '90d': '90 days', '180d': '6 months', '1y': '1 year',
};

export default function AnalyticsPage() {
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
    <div className={`mx-auto space-y-5 ${isDesktop ? 'max-w-6xl px-8 py-5' : 'max-w-5xl px-4 sm:px-6 py-6'}`}>

      <h2
        className="text-2xl font-bold tracking-tight"
        style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}
      >
        Analytics
      </h2>

      {fetchError && <p className="text-sm text-red-400">{fetchError}</p>}

      {/* ── Hero Stats Strip ─────────────────────────────────── */}
      <div
        className="rounded-xl flex animate-j2-card-enter"
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

      {/* ── Intention vs Ambient Focus ─────────────────────────── */}
      {intentions.length > 0 && (
        <div className="animate-j2-card-enter" style={{ animationDelay: '120ms' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.60)', letterSpacing: '0.04em' }}>
            Intention vs Training Telemetry
          </h3>

          <div
            className="mt-3 rounded-2xl overflow-hidden"
            style={{ backgroundColor: CARD_BG, border: `1px solid ${COPPER_BORDER}`, boxShadow: CARD_SHADOW }}
          >
              {/* Column headers */}
              <div className="hidden sm:grid grid-cols-[80px_1fr_1fr] gap-4 px-4 pt-3 pb-2">
                <span className="text-[11px] text-white/25 uppercase tracking-wide">Week</span>
                <span className="text-[11px] text-white/25 uppercase tracking-wide">Intention</span>
                <span className="text-[11px] text-white/25 uppercase tracking-wide">Training Telemetry</span>
              </div>

              <div className="sm:divide-y sm:divide-white/[0.05] flex flex-col sm:block gap-2 sm:gap-0 p-3 sm:p-0">
                {intentions.map(intention => {
                  const top         = topTagInRange(allSessions, intention.week_start, intention.duration_days);
                  const alignment   = computeAlignment(intention, top);
                  const alignColor  = alignment === 'aligned'  ? 'rgba(82,181,108,0.85)'
                                    : alignment === 'diverged' ? 'rgba(218,116,34,0.6)'
                                    : 'rgba(255,255,255,0.08)';
                  const alignTitle  = alignment === 'aligned'  ? 'Training aligned with intention'
                                    : alignment === 'diverged' ? 'Training diverged from intention'
                                    : 'No sessions logged';
                  const categoryColor = CATEGORY_COLORS[intention.intent_category ?? ''] ?? 'rgba(255,255,255,0.3)';
                  return (
                    <div
                      key={intention.id}
                      className="grid sm:grid-cols-[80px_1fr_1fr] gap-2 sm:gap-4 sm:items-center px-3 sm:px-4 py-3
                                 rounded-xl sm:rounded-none
                                 bg-white/[0.03] sm:bg-transparent
                                 border border-white/[0.07] sm:border-0"
                    >
                      {/* Week */}
                      <span className="text-[11px] font-medium tracking-wide uppercase text-white/30 sm:text-xs sm:font-normal sm:tracking-normal sm:normal-case sm:text-white/35">
                        {formatWeekShort(intention.week_start)}
                      </span>

                      {/* Intention */}
                      <div className="flex items-center gap-2 min-w-0">
                        {intention.intent_category && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium capitalize"
                            style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}
                          >
                            {intention.intent_category}
                          </span>
                        )}
                        <span className="text-sm text-white/80 truncate">{intention.intent_label}</span>
                      </div>

                      {/* Ambient Focus + alignment dot */}
                      <div className="flex items-center gap-1.5">
                        <span
                          title={alignTitle}
                          style={{
                            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                            backgroundColor: alignColor, flexShrink: 0,
                          }}
                        />
                        {top ? (
                          <>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(218,116,34,0.85)' }}>
                              ◎ {top.label}
                            </span>
                            {top.count > 1 && (
                              <span style={{ fontSize: 12, color: 'rgba(218,116,34,0.45)' }}>
                                × {top.count}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-white/20 italic">— no sessions</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
        </div>
      )}

    </div>
    </PageContent>
  );
}
