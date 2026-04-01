import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../lib/api.ts';
import SkillRadar, { type TimeWindow } from '../components/SkillRadar.tsx';
import ErrorBoundary from '../components/ErrorBoundary.tsx';
import { PALE_YELLOW, GLOW_SOFT, CARD_BG, COPPER_BORDER, CARD_SHADOW } from '../lib/theme.ts';
import type { SessionSummary } from '../components/TrainingHeatmap.tsx';
import LoadingScreen from '../components/LoadingScreen.tsx';
import { SKILL_TAGS } from '../lib/constants.ts';

interface SessionsResponse {
  sessions: SessionSummary[];
}

interface Intention {
  id: string;
  week_start: string;
  intent_label: string;
  intent_category: string | null;
  duration_days: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  technical:   '#60a5fa',
  physical:    '#f87171',
  mental:      '#a78bfa',
  positional:  '#34d399',
  competitive: '#fbbf24',
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const WINDOW_DAYS: Partial<Record<TimeWindow, number>> = { '30d': 30, '60d': 60, '90d': 90 };

function formatWeek(weekStart: string): string {
  const d = new Date(weekStart.slice(0, 10) + 'T00:00:00');
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function topTagInRange(
  sessions: SessionSummary[],
  weekStart: string,
  durationDays: number,
): { label: string; count: number } | null {
  const start = weekStart.slice(0, 10);
  const end = new Date(start + 'T00:00:00');
  end.setDate(end.getDate() + durationDays - 1);
  const endStr = end.toISOString().slice(0, 10);

  const counts: Record<string, number> = {};
  sessions.forEach(s => {
    const d = s.date.slice(0, 10);
    if (d >= start && d <= endStr) {
      s.tags?.forEach(t => { counts[t] = (counts[t] ?? 0) + 1; });
    }
  });

  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  const label = SKILL_TAGS.find(s => s.value === top[0])?.label ?? top[0];
  return { label, count: top[1] };
}

export default function AnalyticsPage() {
  const [sessions,    setSessions]    = useState<SessionSummary[]>([]);
  const [intentions,  setIntentions]  = useState<Intention[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [fetchError,  setFetchError]  = useState<string | null>(null);
  const [focusOpen,   setFocusOpen]   = useState(false);
  const [timeWindow,  setTimeWindow]  = useState<TimeWindow>('90d');

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const days = WINDOW_DAYS[timeWindow];
      const sessionUrl = days != null
        ? `/api/sessions?from=${new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)}`
        : '/api/sessions';
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
  }, [timeWindow]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <LoadingScreen />;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

      <h2
        className="text-2xl font-bold tracking-tight"
        style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}
      >
        Analytics
      </h2>

      {fetchError && <p className="text-sm text-red-400">{fetchError}</p>}

      <ErrorBoundary>
        <SkillRadar sessions={sessions} timeWindow={timeWindow} onWindowChange={setTimeWindow} />
      </ErrorBoundary>

      {/* ── Intention vs Ambient Focus ─────────────────────────── */}
      {intentions.length > 0 && (
        <div>
          <button
            onClick={() => setFocusOpen(v => !v)}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: focusOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            <span className="font-medium">Intention vs Training Telemetry</span>
            <span className="text-xs text-white/20">({intentions.length})</span>
          </button>

          {focusOpen && (
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

              <div className="divide-y divide-white/[0.05]">
                {intentions.map(intention => {
                  const top = topTagInRange(sessions, intention.week_start, intention.duration_days);
                  const categoryColor = CATEGORY_COLORS[intention.intent_category ?? ''] ?? 'rgba(255,255,255,0.3)';
                  return (
                    <div
                      key={intention.id}
                      className="grid sm:grid-cols-[80px_1fr_1fr] gap-1 sm:gap-4 sm:items-center px-4 py-3"
                    >
                      {/* Week */}
                      <span className="text-xs text-white/35">{formatWeek(intention.week_start)}</span>

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

                      {/* Ambient Focus */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-white/25 sm:hidden">Telemetry: </span>
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
          )}
        </div>
      )}

    </div>
  );
}
