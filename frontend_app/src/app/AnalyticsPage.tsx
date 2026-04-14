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

      <ErrorBoundary>
        <SkillRadar
          sessions={allSessions}
          timeWindow={timeWindow}
          onWindowChange={setTimeWindow}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
        />
      </ErrorBoundary>

      {/* ── Intention vs Ambient Focus ─────────────────────────── */}
      {intentions.length > 0 && (
        <div>
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
