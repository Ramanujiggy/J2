import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, ApiError } from '../lib/api.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import type { SessionSummary } from '../components/TrainingHeatmap.tsx';
import LogSessionForm from '../components/LogSessionForm.tsx';
import SessionDetailModal from '../components/SessionDetailModal.tsx';
import SetIntentionModal from '../components/SetIntentionModal.tsx';
import { PALE_YELLOW, GLOW_SOFT, CARD_BG, COPPER_BORDER } from '../lib/theme.ts';
import { useProfile } from '../context/ProfileContext.tsx';

// ── Types ──────────────────────────────────────────────────────────────────

interface Intention {
  id: string;
  user_id: string;
  week_start: string;
  intent_label: string;
  intent_category: string | null;
  duration_days: number;
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

// Adds (days - 1) days to a YYYY-MM-DD string (start day counts as day 1)
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days - 1);
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

// ── Tooltip ────────────────────────────────────────────────────────────────

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span style={{
          position: 'absolute',
          top: 'calc(100% + 7px)',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#111e2b',
          border: '1px solid rgba(184,122,85,0.4)',
          borderRadius: 8,
          padding: '5px 10px',
          fontSize: 11,
          color: 'rgba(255,255,255,0.65)',
          whiteSpace: 'nowrap',
          zIndex: 1000,
          pointerEvents: 'none',
          boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

// ── Particle helpers ────────────────────────────────────────────────────────

// Intent banner — 10 particles across the full-width banner
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

// Seeded deterministic hash — stable across re-renders, unique per day string
function seededRandom(seed: string, index: number): number {
  let h = 2166136261;
  const str = seed + String(index);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 1000) / 1000;
}

// Stats strip (emerging training priority) — 6 particles across the full strip width
const STATS_PARTICLES = [
  { left: '6%',  bottom: 2, size: 2, drift: '-3px', duration: 3.9, delay: 0.0 },
  { left: '20%', bottom: 3, size: 2, drift: '4px',  duration: 4.6, delay: 1.2 },
  { left: '38%', bottom: 2, size: 2, drift: '-4px', duration: 3.5, delay: 0.5 },
  { left: '55%', bottom: 3, size: 2, drift: '3px',  duration: 4.2, delay: 1.8 },
  { left: '72%', bottom: 2, size: 2, drift: '-3px', duration: 3.7, delay: 0.9 },
  { left: '88%', bottom: 2, size: 2, drift: '5px',  duration: 4.4, delay: 0.3 },
] as const;

// Per-day particle set — unique positions & timings seeded on the day date string
function generateDayParticles(dayStr: string) {
  return Array.from({ length: 4 }, (_, i) => ({
    left:     `${8 + seededRandom(dayStr, i * 6)     * 78}%`,
    bottom:   1 + seededRandom(dayStr, i * 6 + 1) * 4,
    size:     2,
    drift:    `${(seededRandom(dayStr, i * 6 + 2) - 0.5) * 10}px`,
    duration: 3.0 + seededRandom(dayStr, i * 6 + 3) * 2.2,
    delay:    seededRandom(dayStr, i * 6 + 4) * 2.8,
  }));
}

// ── DayCard ────────────────────────────────────────────────────────────────

interface DayCardProps {
  day: Date;
  today: Date;
  sessions: SessionSummary[];
  intention: Intention | null;
  intentionBrightness: number;
  onLogSession: () => void;
  onViewSession: (sessions: SessionSummary[], date: Date) => void;
}

function DayCard({ day, today, sessions, intention, intentionBrightness, onLogSession, onViewSession }: DayCardProps) {
  const [hovered, setHovered] = useState(false);

  const todayStr   = toDateString(today);
  const dayStr     = toDateString(day);
  const isToday    = dayStr === todayStr;
  const isFuture   = dayStr > todayStr;
  const isPast     = dayStr < todayStr;

  const primarySession = sessions.length > 0
    ? [...sessions].sort((a, b) => Number(b.intensity) - Number(a.intensity))[0]
    : null;
  const totalMinutes = sessions.reduce((sum, s) => sum + Number(s.duration), 0);
  const sessionCount = sessions.length;

  const intensityColor = primarySession ? (INTENSITY_COLOR[primarySession.intensity] ?? '#CDDFA0') : null;

  // Border + shadow — today with intention gets a faint yellow ambient glow
  const borderColor = isToday ? 'rgba(184,122,85,0.7)' : 'rgba(255,255,255,0.07)';
  const boxShadow = isToday
    ? intention
      ? '0 0 18px rgba(240,223,160,0.13), 0 0 22px rgba(184,122,85,0.18), 0 2px 8px rgba(0,0,0,0.4)'
      : '0 0 16px rgba(184,122,85,0.25), 0 2px 8px rgba(0,0,0,0.4)'
    : '0 2px 8px rgba(0,0,0,0.3)';

  // Derived brightness values for the intention footer layers
  const opacityScale = intention ? intentionBrightness / 1.3 : 1;
  const glowHeight   = intentionBrightness >= 1.25 ? 52 : 32;

  const dayParticles = intention ? generateDayParticles(dayStr) : [];

  return (
    <div
      className="min-w-[128px] sm:flex-1 rounded-2xl flex flex-col flex-shrink-0 overflow-hidden"
      style={{
        backgroundColor: CARD_BG,
        border: `1px solid ${borderColor}`,
        boxShadow: hovered
          ? `${boxShadow}, 0 12px 32px rgba(0,0,0,0.55)`
          : boxShadow,
        opacity: isFuture ? 0.55 : 1,
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Card header */}
      <div className="px-3 pt-3 pb-2 border-b border-white/5">
        <p className="text-[11px] font-medium text-white/40">
          {DAY_NAMES[day.getDay()]}
        </p>
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
        {sessionCount > 0 ? (
          <button
            className="text-left w-full space-y-1.5"
            onClick={() => onViewSession(sessions, day)}
          >
            {/* Intensity dot + duration + count badge */}
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: intensityColor! }}
              />
              <span className="text-xs font-semibold text-white">
                {formatDuration(totalMinutes)}
              </span>
              {sessionCount > 1 && (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                  ×{sessionCount}
                </span>
              )}
            </div>
            {/* Type · Style */}
            <p className="text-[11px] text-white/45 leading-tight">
              {SESSION_TYPE_LABELS[primarySession!.session_type] ?? primarySession!.session_type}
              {' · '}
              {primarySession!.gi_nogi === 'gi' ? 'Gi' : 'No-Gi'}
            </p>
            {/* Top tags (up to 2) from primary session */}
            {primarySession!.tags && primarySession!.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {primarySession!.tags.slice(0, 2).map(tag => {
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
            + Mat Time
          </button>
        )}
      </div>

      {/* Intention strip at bottom — fades in when active */}
      {intention && (
        <div
          className="px-3 py-1.5 text-[10px] truncate"
          style={{
            position: 'relative',
            borderTop: `1px solid rgba(240,223,160,0.22)`,
            color: 'rgba(240,223,160,0.5)',
            animation: 'j2IntentFadeIn 1.6s ease forwards',
          }}
        >
          {/* Glow wrapper — opacityScale controls day brightness without conflicting with pulse keyframes */}
          <div style={{ position: 'absolute', inset: 0, opacity: opacityScale, pointerEvents: 'none', zIndex: 0 }}>
            {/* Purple glow — bleeds from below the footer floor */}
            <div style={{
              position: 'absolute',
              bottom: -8, left: '50%',
              transform: 'translateX(-50%)',
              width: '70%', height: glowHeight,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center bottom, rgba(167,139,250,0.6) 0%, rgba(167,139,250,0.15) 50%, transparent 80%)',
              animation: 'j2IntentPurplePulse 5s ease-in-out infinite',
            }} />
            {/* Yellow lowlight */}
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0, height: 22,
              background: 'linear-gradient(to top, rgba(240,223,160,0.22) 0%, transparent 100%)',
              animation: 'j2IntentYellowPulse 4s ease-in-out infinite',
              transformOrigin: 'center bottom',
            }} />
          </div>
          {/* Rising particles — fade upward via mask so they dissolve before hitting the card overflow clip */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.8) 40%, transparent 90%)',
            maskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.8) 40%, transparent 90%)',
          }}>
            {dayParticles.map((p, i) => (
              <span key={i} style={{
                position: 'absolute',
                left: p.left, bottom: p.bottom,
                width: p.size, height: p.size,
                borderRadius: '50%',
                backgroundColor: 'rgba(240,223,160,0.9)',
                boxShadow: '0 0 6px 2px rgba(240,223,160,0.75)',
                filter: `brightness(${intentionBrightness})`,
                ['--drift' as string]: p.drift,
                animation: `j2IntentParticleRise ${p.duration}s ease-in-out infinite ${p.delay}s`,
                userSelect: 'none',
              } as React.CSSProperties} />
            ))}
          </div>
          {/* Label sits above effect layers */}
          <Tooltip text={[
            intention.intent_label,
            intention.intent_category ? intention.intent_category.charAt(0).toUpperCase() + intention.intent_category.slice(1) : null,
            `${intention.duration_days ?? 7}d intention`,
          ].filter(Boolean).join(' · ')}>
            <span style={{ position: 'relative', zIndex: 2, cursor: 'default' }}>◈ {intention.intent_label}</span>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

// ── PathAheadPage ──────────────────────────────────────────────────────────

export default function PathAheadPage() {
  const { intentionsEnabled } = useProfile();
  const [sessions,   setSessions]   = useState<SessionSummary[]>([]);
  const [intentions, setIntentions] = useState<Intention[]>([]);
  const [loading,    setLoading]    = useState(true);

  // weekOffset: 0 = today's 7-day window, -1 = previous 7 days, etc.
  const [weekOffset, setWeekOffset] = useState(0);

  // Modals
  const [logOpen,             setLogOpen]             = useState(false);
  const [setIntentOpen,       setSetIntentOpen]       = useState(false);
  const [detailSessions,      setDetailSessions]      = useState<SessionSummary[]>([]);
  const [detailSessionIndex,  setDetailSessionIndex]  = useState(0);
  const [detailDate,          setDetailDate]          = useState<Date | null>(null);
  const [detailIntention,     setDetailIntention]     = useState<Intention | null>(null);
  const detailSession = detailSessions[detailSessionIndex] ?? null;

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

  // Day coverage: start from today (weekOffset 0) to avoid UTC vs local timezone mismatch
  // on created_at. For past weeks, fall back to created_at.
  const intentionStartStr = activeIntention
    ? (weekOffset === 0 ? toDateString(today) : activeIntention.created_at.slice(0, 10))
    : null;
  const intentionEndStr = intentionStartStr && activeIntention
    ? addDays(intentionStartStr, activeIntention.duration_days ?? 7)
    : null;

  // Sessions indexed by date string — all sessions per day
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionSummary[]>();
    sessions.forEach(s => {
      const key = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
      const existing = map.get(key) ?? [];
      map.set(key, [...existing, s]);
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
    const topTagEntry = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0] ?? null;
    const topTag      = topTagEntry?.[0] ?? null;
    const topTagCount = topTagEntry?.[1] ?? 0;
    const topTagLabel = topTag ? (SKILL_TAGS.find(s => s.value === topTag)?.label ?? topTag) : null;
    return { count: windowSessions.length, totalMinutes, topTagLabel, topTagCount };
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
          0%   { opacity: 0.4; transform: scaleX(1);    }
          50%  { opacity: 0.7; transform: scaleX(1.03); }
          100% { opacity: 0.4; transform: scaleX(1);    }
        }
        @keyframes j2IntentPurplePulse {
          0%   { opacity: 0.35; transform: scale(1);    }
          50%  { opacity: 0.65; transform: scale(1.08); }
          100% { opacity: 0.35; transform: scale(1);    }
        }
        @keyframes j2IntentCopperPulse {
          0%   { opacity: 0.35; transform: scale(1);    }
          50%  { opacity: 0.60; transform: scale(1.08); }
          100% { opacity: 0.35; transform: scale(1);    }
        }
        @keyframes j2IntentFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
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
          + Mat Time
        </button>
      </div>

      {/* ── Intent banner ─────────────────────────────────────────── */}
      {intentionsEnabled ? (
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
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', opacity: activeIntention ? 1 : 0.18,
            WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 50%, transparent 100%)',
            maskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 50%, transparent 100%)',
          }}>
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
                  boxShadow: activeIntention ? '0 0 6px 2px rgba(240,223,160,0.75)' : '0 0 2px 1px rgba(240,223,160,0.2)',
                  filter: 'brightness(1.15)',
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
      ) : (
        /* Intentions disabled — thin glowing accent line */
        <div style={{
          height: 2,
          borderRadius: 2,
          background: `linear-gradient(to right, transparent 0%, rgba(240,223,160,0.55) 20%, rgba(240,223,160,0.55) 80%, transparent 100%)`,
          boxShadow: '0 0 10px 2px rgba(240,223,160,0.18)',
          animation: 'j2IntentYellowPulse 3.1s ease-in-out infinite',
        }} />
      )}

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
        <span
          className="font-semibold min-w-[100px] text-center"
          style={{
            color: weekOffset === 0 ? PALE_YELLOW : 'rgba(255,255,255,0.55)',
            fontSize: weekOffset === 0 ? 15 : 13,
            textShadow: weekOffset === 0 ? GLOW_SOFT : 'none',
          }}
        >
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
      <div className="flex gap-2 sm:gap-3 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0" style={{ paddingTop: 8, paddingBottom: 4, marginTop: -8 }}>
        {windowDays.map(day => {
          const dayStr = toDateString(day);
          const dayHasIntention = activeIntention !== null && intentionStartStr !== null && intentionEndStr !== null
            && dayStr >= intentionStartStr
            && dayStr <= intentionEndStr;

          // Brightness: today = 1.3, last day = 0.78, linear decline
          let intentionBrightness = 1.15;
          if (dayHasIntention) {
            const todayStr = toDateString(today);
            const daysFromToday = Math.max(0, Math.round(
              (new Date(dayStr + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000
            ));
            const duration = activeIntention!.duration_days ?? 7;
            intentionBrightness = duration <= 1
              ? 1.3
              : Math.max(0.78, 1.3 - 0.52 * (daysFromToday / (duration - 1)));
          }

          return (
            <DayCard
              key={dayStr}
              day={day}
              today={today}
              sessions={sessionsByDate.get(dayStr) ?? []}
              intention={dayHasIntention ? activeIntention : null}
              intentionBrightness={intentionBrightness}
              onLogSession={() => setLogOpen(true)}
              onViewSession={(ss, d) => {
                setDetailSessions(ss);
                setDetailSessionIndex(0);
                setDetailDate(d);
                setDetailIntention(dayHasIntention ? activeIntention : null);
              }}
            />
          );
        })}
      </div>

      {/* ── Weekly summary card ───────────────────────────────────── */}
      {windowStats.count > 0 && (
        <div
          className="rounded-xl px-4 py-3"
          style={{
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: `1px solid ${COPPER_BORDER}`,
          }}
        >
          {/* Particle / glow layer — copper toned, gradient masked */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
            WebkitMaskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 45%, transparent 100%)',
            maskImage: 'linear-gradient(to top, black 0%, rgba(0,0,0,0.85) 45%, transparent 100%)',
          }}>
            <div style={{
              position: 'absolute',
              bottom: -10, left: '50%',
              transform: 'translateX(-50%)',
              width: '50%', height: 40,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center bottom, rgba(184,122,85,0.15) 0%, transparent 80%)',
              animation: 'j2IntentCopperPulse 5.5s ease-in-out infinite',
            }} />
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0, height: 18,
              background: 'linear-gradient(to top, rgba(184,122,85,0.12) 0%, transparent 100%)',
              animation: 'j2IntentCopperPulse 4.5s ease-in-out infinite',
              transformOrigin: 'center bottom',
            }} />
            {STATS_PARTICLES.map((p, i) => (
              <span key={i} style={{
                position: 'absolute',
                left: p.left, bottom: p.bottom,
                width: p.size, height: p.size,
                borderRadius: '50%',
                backgroundColor: 'rgba(218,116,34,0.75)',
                boxShadow: '0 0 5px 2px rgba(218,116,34,0.45)',
                filter: 'brightness(1.2)',
                ['--drift' as string]: p.drift,
                animation: `j2IntentParticleRise ${p.duration}s ease-in-out infinite ${p.delay}s`,
                userSelect: 'none',
              } as React.CSSProperties} />
            ))}
          </div>

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Stats row */}
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <span className="text-white/50">
                <span className="font-semibold text-white">{windowStats.count}</span> session{windowStats.count !== 1 ? 's' : ''}
              </span>
              <span className="text-white/20">·</span>
              <span className="text-white/50">
                <span className="font-semibold text-white">{formatDuration(windowStats.totalMinutes)}</span> total
              </span>
            </div>

            {/* Ambient Focus row — only when tag data exists */}
            {windowStats.topTagLabel && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-white/30 uppercase tracking-wide">Ambient Focus</span>
                <Tooltip text="The skill you've trained most this week, based on your logged sessions.">
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.22)', cursor: 'default', lineHeight: 1 }}>?</span>
                </Tooltip>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(218,116,34,0.85)', marginLeft: 4 }}>
                  ◎ {windowStats.topTagLabel}
                </span>
                {windowStats.topTagCount > 1 && (
                  <span style={{ fontSize: 12, color: 'rgba(218,116,34,0.45)' }}>
                    × {windowStats.topTagCount}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────── */}

      {logOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4"
          style={{ backgroundColor: 'rgba(17, 30, 43, 0.92)' }}
          onClick={() => setLogOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl"
            style={{ border: `1px solid ${COPPER_BORDER}` }}
          >
            <LogSessionForm onSuccess={() => { fetchAll(); setLogOpen(false); }} />
          </div>
        </div>
      )}

      {detailSession && detailDate && (
        <SessionDetailModal
          key={detailSession.id}
          session={detailSession}
          date={detailDate}
          intention={detailIntention}
          sessionCount={detailSessions.length}
          sessionIndex={detailSessionIndex}
          onNavigate={setDetailSessionIndex}
          onClose={() => { setDetailSessions([]); setDetailSessionIndex(0); setDetailDate(null); setDetailIntention(null); }}
          onSaved={() => { fetchAll(); setDetailSessions([]); setDetailSessionIndex(0); setDetailDate(null); setDetailIntention(null); }}
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
