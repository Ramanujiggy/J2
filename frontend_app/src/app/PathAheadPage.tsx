import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, ApiError } from '../lib/api.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import type { SessionSummary } from '../components/TrainingHeatmap.tsx';
import LogSessionForm from '../components/LogSessionForm.tsx';
import SessionDetailModal from '../components/SessionDetailModal.tsx';
import SetIntentionModal from '../components/SetIntentionModal.tsx';
import { PALE_YELLOW, GLOW_SOFT, CARD_BG, COPPER_BORDER } from '../lib/theme.ts';

// ── Types ──────────────────────────────────────────────────────────────────

interface Intention {
  id: string;
  user_id: string;
  week_start: string;
  intent_label: string;
  intent_category: string | null;
  created_at: string;
}

interface IntentionsResponse  { intentions: Intention[] }
interface SessionsResponse    { sessions: SessionSummary[] }
interface DeleteResponse      { message: string }

// ── Date helpers ───────────────────────────────────────────────────────────

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ISO Monday (YYYY-MM-DD) for a given date, using local timezone
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return toDateString(d);
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const INTENSITY_COLOR: Record<number, string> = {
  1: '#CDDFA0',
  2: '#CDDFA0',
  3: '#6FD08C',
  4: '#DA7422',
  5: '#DA7422',
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  class:                'Class',
  drilling:             'Drilling',
  competition_training: 'Competition',
};

const CATEGORY_COLORS: Record<string, string> = {
  technical:   '#60a5fa',
  physical:    '#f87171',
  mental:      '#a78bfa',
  positional:  '#34d399',
  competitive: '#fbbf24',
};

// ── Intent banner particles ────────────────────────────────────────────────

const INTENT_PARTICLES = [
  { left: '8%',  bottom: 3, size: 3, drift: '-4px', duration: 3.8, delay: 0.0 },
  { left: '19%', bottom: 2, size: 2, drift: '6px',  duration: 4.5, delay: 0.7 },
  { left: '31%', bottom: 5, size: 3, drift: '-3px', duration: 3.2, delay: 1.4 },
  { left: '43%', bottom: 2, size: 4, drift: '5px',  duration: 5.1, delay: 0.3 },
  { left: '52%', bottom: 4, size: 2, drift: '-6px', duration: 3.6, delay: 2.1 },
  { left: '61%', bottom: 3, size: 3, drift: '4px',  duration: 4.8, delay: 0.9 },
  { left: '70%', bottom: 2, size: 2, drift: '-5px', duration: 3.4, delay: 1.7 },
  { left: '79%', bottom: 5, size: 3, drift: '7px',  duration: 4.2, delay: 0.5 },
  { left: '88%', bottom: 3, size: 2, drift: '-3px', duration: 5.3, delay: 1.2 },
  { left: '47%', bottom: 2, size: 2, drift: '3px',  duration: 4.0, delay: 2.6 },
] as const;

// ── DayCard ────────────────────────────────────────────────────────────────

interface DayCardProps {
  day: Date;
  today: Date;
  session: SessionSummary | null;
  intention: Intention | null;
  onLogSession: () => void;
  onViewSession: (session: SessionSummary, date: Date) => void;
}

function DayCard({ day, today, session, intention, onLogSession, onViewSession }: DayCardProps) {
  const todayStr   = toDateString(today);
  const dayStr     = toDateString(day);
  const isToday    = dayStr === todayStr;
  const isFuture   = dayStr > todayStr;
  const isPast     = dayStr < todayStr;

  const intensityColor = session ? (INTENSITY_COLOR[session.intensity] ?? '#CDDFA0') : null;

  // Border style
  const borderColor = isToday
    ? 'rgba(184,122,85,0.7)'
    : 'rgba(255,255,255,0.07)';
  const boxShadow = isToday
    ? '0 0 16px rgba(184,122,85,0.25), 0 2px 8px rgba(0,0,0,0.4)'
    : '0 2px 8px rgba(0,0,0,0.3)';

  return (
    <div
      className="min-w-[128px] sm:flex-1 rounded-2xl flex flex-col flex-shrink-0 overflow-hidden"
      style={{
        backgroundColor: CARD_BG,
        border: `1px solid ${borderColor}`,
        boxShadow,
        opacity: isFuture ? 0.55 : 1,
      }}
    >
      {/* Card header */}
      <div className="px-3 pt-3 pb-2 border-b border-white/5">
        <p className="text-[11px] font-medium text-white/40">{DAY_NAMES[day.getDay()]}</p>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-white">
            {MONTH_NAMES[day.getMonth()]} {day.getDate()}
          </p>
          {isToday && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(184,122,85,0.3)', color: '#B87A55', letterSpacing: '0.05em' }}
            >
              TODAY
            </span>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="flex-1 px-3 py-2.5 flex flex-col gap-1.5">
        {session ? (
          <button
            className="text-left w-full space-y-1.5"
            onClick={() => onViewSession(session, day)}
          >
            {/* Intensity dot + duration */}
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: intensityColor! }}
              />
              <span className="text-xs font-semibold text-white">
                {formatDuration(session.duration)}
              </span>
            </div>
            {/* Type · Style */}
            <p className="text-[11px] text-white/45 leading-tight">
              {SESSION_TYPE_LABELS[session.session_type] ?? session.session_type}
              {' · '}
              {session.gi_nogi === 'gi' ? 'Gi' : 'No-Gi'}
            </p>
            {/* Top tags (up to 2) */}
            {session.tags && session.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {session.tags.slice(0, 2).map(tag => {
                  const found = SKILL_TAGS.find(s => s.value === tag);
                  return (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
                    >
                      {found?.label ?? tag}
                    </span>
                  );
                })}
              </div>
            )}
          </button>
        ) : isFuture ? (
          <p className="text-[11px] text-white/20 italic">—</p>
        ) : isPast ? (
          <p className="text-[11px] text-white/25 italic">Rest</p>
        ) : (
          // Today, no session
          <button
            onClick={onLogSession}
            className="text-[11px] font-medium transition-colors text-left"
            style={{ color: 'rgba(184,122,85,0.7)' }}
          >
            + Log session
          </button>
        )}
      </div>

      {/* Intention strip at bottom */}
      {intention && (
        <div
          className="px-3 py-1.5 text-[10px] truncate"
          style={{
            borderTop: `1px solid rgba(240,223,160,0.12)`,
            color: 'rgba(240,223,160,0.5)',
          }}
        >
          ◈ {intention.intent_label}
        </div>
      )}
    </div>
  );
}

// ── PathAheadPage ──────────────────────────────────────────────────────────

export default function PathAheadPage() {
  const [sessions,   setSessions]   = useState<SessionSummary[]>([]);
  const [intentions, setIntentions] = useState<Intention[]>([]);
  const [loading,    setLoading]    = useState(true);

  // weekOffset: 0 = today's 7-day window, -1 = previous 7 days, etc.
  const [weekOffset, setWeekOffset] = useState(0);

  // Modals
  const [logOpen,             setLogOpen]             = useState(false);
  const [setIntentOpen,       setSetIntentOpen]       = useState(false);
  const [detailSession,       setDetailSession]       = useState<SessionSummary | null>(null);
  const [detailDate,          setDetailDate]          = useState<Date | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const [sessRes, intRes] = await Promise.all([
        api.get<SessionsResponse>('/api/sessions'),
        api.get<IntentionsResponse>('/api/intentions'),
      ]);
      setSessions(sessRes.sessions ?? []);
      setIntentions(intRes.intentions ?? []);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        console.error('Failed to load data', err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Window computation ─────────────────────────────────────────────────

  const today = useMemo(() => new Date(), []);

  const windowDays = useMemo(() => {
    const start = new Date(today);
    start.setDate(today.getDate() + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [today, weekOffset]);

  const windowStart = windowDays[0];

  // Intent for this display window (calendar week containing windowStart)
  const windowWeekStart = getWeekStart(windowStart);
  const activeIntention = intentions.find(i => i.week_start.slice(0, 10) === windowWeekStart) ?? null;

  // Sessions indexed by date string
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionSummary>();
    sessions.forEach(s => {
      const key = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
      if (!map.has(key)) map.set(key, s); // first match wins (already sorted desc by date)
    });
    return map;
  }, [sessions]);

  // ── Window stats ───────────────────────────────────────────────────────

  const windowStats = useMemo(() => {
    const windowDateStrings = new Set(windowDays.map(toDateString));
    const windowSessions = sessions.filter(s => {
      const key = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
      return windowDateStrings.has(key);
    });
    const totalMinutes = windowSessions.reduce((acc, s) => acc + s.duration, 0);
    // Top skill tag
    const tagCounts: Record<string, number> = {};
    windowSessions.forEach(s => s.tags?.forEach(t => { tagCounts[t] = (tagCounts[t] ?? 0) + 1; }));
    const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topTagLabel = topTag ? (SKILL_TAGS.find(s => s.value === topTag)?.label ?? topTag) : null;
    return { count: windowSessions.length, totalMinutes, topTagLabel };
  }, [sessions, windowDays]);

  // ── Window label ───────────────────────────────────────────────────────

  const windowLabel = (() => {
    const start = windowDays[0];
    const end   = windowDays[6];
    if (weekOffset === 0) return 'This week';
    if (weekOffset === -1) return 'Last week';
    const s = `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}`;
    const e = `${MONTH_NAMES[end.getMonth()]} ${end.getDate()}`;
    return `${s} – ${e}`;
  })();

  // ── Intent delete ──────────────────────────────────────────────────────

  const handleDeleteIntention = async () => {
    if (!activeIntention) return;
    try {
      await api.delete<DeleteResponse>(`/api/intentions/${activeIntention.id}`);
      setIntentions(prev => prev.filter(i => i.id !== activeIntention.id));
    } catch {
      // silent — user can retry
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-white/30">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <style>{`
        @keyframes j2IntentParticleRise {
          0%   { transform: translateY(0) translateX(0);               opacity: 0;   }
          8%   { opacity: 1; }
          85%  { opacity: 0.7; }
          100% { transform: translateY(-52px) translateX(var(--drift)); opacity: 0;  }
        }
        @keyframes j2IntentYellowPulse {
          0%   { opacity: 0.45; transform: scaleX(1);    }
          50%  { opacity: 0.75; transform: scaleX(1.04); }
          100% { opacity: 0.45; transform: scaleX(1);    }
        }
        @keyframes j2IntentPurplePulse {
          0%   { opacity: 0.5;  transform: scale(1);    }
          50%  { opacity: 0.85; transform: scale(1.06); }
          100% { opacity: 0.5;  transform: scale(1);    }
        }
      `}</style>

      {/* ── Page title ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
          The Path Ahead
        </h2>
        <button
          onClick={() => setLogOpen(true)}
          className="bg-brand-orange hover:bg-brand-orange/90 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + Log session
        </button>
      </div>

      {/* ── Intent banner ─────────────────────────────────────────── */}
      <div
        className="rounded-xl px-4 py-3"
        style={{
          position: 'relative',
          overflow: 'hidden',
          minHeight: 48,
          backgroundColor: activeIntention ? 'rgba(240,223,160,0.06)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${activeIntention ? 'rgba(240,223,160,0.18)' : 'rgba(255,255,255,0.06)'}`,
          boxShadow: activeIntention ? '0 0 12px rgba(240,223,160,0.08)' : 'none',
        }}
      >
        {/* Layer 1 — Purple emergent glow */}
        <div style={{
          position: 'absolute',
          bottom: -12,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '60%',
          height: 48,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center bottom, rgba(167,139,250,0.22) 0%, rgba(167,139,250,0.08) 50%, transparent 80%)',
          animation: 'j2IntentPurplePulse 4.2s ease-in-out infinite',
          opacity: activeIntention ? 1 : 0.2,
          zIndex: 0,
          pointerEvents: 'none',
        }} />

        {/* Layer 2 — Yellow ambient lowlight */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 28,
          background: 'linear-gradient(to top, rgba(240,223,160,0.09) 0%, transparent 100%)',
          animation: 'j2IntentYellowPulse 3.1s ease-in-out infinite',
          transformOrigin: 'center bottom',
          opacity: activeIntention ? 1 : 0.2,
          zIndex: 0,
          pointerEvents: 'none',
        }} />

        {/* Layer 3 — Rising particles */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', opacity: activeIntention ? 1 : 0.18 }}>
          {INTENT_PARTICLES.map((p, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: p.left,
                bottom: p.bottom,
                width: p.size,
                height: p.size,
                borderRadius: '50%',
                backgroundColor: 'rgba(240,223,160,0.9)',
                boxShadow: activeIntention ? '0 0 4px 1px rgba(240,223,160,0.6)' : '0 0 2px 1px rgba(240,223,160,0.2)',
                ['--drift' as string]: p.drift,
                animation: `j2IntentParticleRise ${p.duration}s ease-in-out infinite ${p.delay}s`,
                userSelect: 'none',
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* Layer 4 — Content */}
        <div className="flex items-center justify-between gap-3" style={{ position: 'relative', zIndex: 2 }}>
          {activeIntention ? (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm" style={{ color: 'rgba(240,223,160,0.5)' }}>◈</span>
                <span className="text-sm font-semibold truncate" style={{ color: PALE_YELLOW }}>
                  {activeIntention.intent_label}
                </span>
                {activeIntention.intent_category && (
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full flex-shrink-0 font-medium capitalize"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[activeIntention.intent_category] ?? '#fff'}22`,
                      color: CATEGORY_COLORS[activeIntention.intent_category] ?? 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {activeIntention.intent_category}
                  </span>
                )}
              </div>
              <button
                onClick={handleDeleteIntention}
                className="text-[11px] text-white/25 hover:text-red-400 transition-colors flex-shrink-0"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-white/30 italic">No intention set for this week.</p>
              {weekOffset === 0 && (
                <button
                  onClick={() => setSetIntentOpen(true)}
                  className="text-sm font-medium flex-shrink-0 transition-colors"
                  style={{ color: PALE_YELLOW }}
                >
                  + Set intent
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Week navigation ───────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          className="p-1.5 rounded-lg transition-colors text-white/40 hover:text-white hover:bg-white/5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="text-sm font-medium text-white/60 min-w-[80px] text-center">
          {windowLabel}
        </span>
        <button
          onClick={() => setWeekOffset(o => o + 1)}
          disabled={weekOffset >= 0}
          className="p-1.5 rounded-lg transition-colors text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* ── Day cards row ─────────────────────────────────────────── */}
      <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {windowDays.map(day => (
          <DayCard
            key={toDateString(day)}
            day={day}
            today={today}
            session={sessionsByDate.get(toDateString(day)) ?? null}
            intention={activeIntention}
            onLogSession={() => setLogOpen(true)}
            onViewSession={(s, d) => { setDetailSession(s); setDetailDate(d); }}
          />
        ))}
      </div>

      {/* ── Weekly stats strip ────────────────────────────────────── */}
      {windowStats.count > 0 && (
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-4 text-sm flex-wrap"
          style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: `1px solid ${COPPER_BORDER}` }}
        >
          <span className="text-white/50">
            <span className="font-semibold text-white">{windowStats.count}</span> session{windowStats.count !== 1 ? 's' : ''}
          </span>
          <span className="text-white/20">·</span>
          <span className="text-white/50">
            <span className="font-semibold text-white">{formatDuration(windowStats.totalMinutes)}</span> total
          </span>
          {windowStats.topTagLabel && (
            <>
              <span className="text-white/20">·</span>
              <span className="text-white/50">
                Top: <span className="font-semibold text-white">{windowStats.topTagLabel}</span>
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────── */}

      {logOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4"
          style={{ backgroundColor: 'rgba(38, 70, 83, 0.85)' }}
          onClick={() => setLogOpen(false)}
        >
          <div onClick={e => e.stopPropagation()} className="w-full max-w-lg">
            <LogSessionForm onSuccess={() => { fetchAll(); setLogOpen(false); }} />
          </div>
        </div>
      )}

      {detailSession && detailDate && (
        <SessionDetailModal
          session={detailSession}
          date={detailDate}
          onClose={() => { setDetailSession(null); setDetailDate(null); }}
          onSaved={() => { fetchAll(); setDetailSession(null); setDetailDate(null); }}
        />
      )}

      {setIntentOpen && (
        <SetIntentionModal
          weekStart={windowStart}
          onSaved={fetchAll}
          onClose={() => setSetIntentOpen(false)}
        />
      )}
    </div>
  );
}
