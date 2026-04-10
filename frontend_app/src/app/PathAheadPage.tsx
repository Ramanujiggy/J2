import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api, ApiError } from '../lib/api.ts';
import { useOnlineRefetch } from '../hooks/useOnlineRefetch.ts';
import { usePendingSessions } from '../hooks/usePendingSessions.ts';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.ts';
import { SKILL_TAGS, ROULETTE_DRILLS, CATEGORY_COLORS, MONTH_NAMES } from '../lib/constants.ts';
import type { SessionSummary, Intention, IntentionsResponse, SessionsResponse } from '../types/api.ts';
import LogSessionForm from '../components/LogSessionForm.tsx';
import SessionDetailModal from '../components/SessionDetailModal.tsx';
import SetIntentionModal from '../components/SetIntentionModal.tsx';
import { PALE_YELLOW, GLOW_SOFT, CARD_BG, COPPER, COPPER_BORDER, SURFACE_2, SURFACE_2_BORDER, WHISPER_BORDER } from '../lib/theme.ts';
import { CalendarDays, List } from 'lucide-react';
import { toast } from '../hooks/use-toast.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import PageContent from '../components/PageContent.tsx';
import HeatmapPreviewWidget from '../components/HeatmapPreviewWidget.tsx';
import { toDateString, getWeekStart, addDays, formatDuration, DAY_NAMES, INTENSITY_COLOR, SESSION_TYPE_LABELS } from '../lib/sessionUtils.ts';
import { INTENT_PARTICLES, STATS_PARTICLES } from '../lib/particles.ts';
import { computeStats } from '../components/TrainingHeatmap.tsx';

// ── Types ──────────────────────────────────────────────────────────────────

interface DeleteResponse      { message: string }

// ── PathAheadPage ──────────────────────────────────────────────────────────

export default function PathAheadPage() {
  const { intentionsEnabled } = useProfile();
  const [sessions,   setSessions]   = useState<SessionSummary[]>([]);
  const [intentions, setIntentions] = useState<Intention[]>([]);
  const [loading,    setLoading]    = useState(true);

  // Week scroll ref
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const MINI_CARD_W = 110;
  const MINI_CARD_GAP = 10;

  // Rep Roulette — expand/collapse + drill history
  const [rouletteOpen, setRouletteOpen] = useState(false);
  const [drillHistory, setDrillHistory] = useState<number[]>(
    () => [Math.floor(Math.random() * ROULETTE_DRILLS.length)]
  );
  const [drillHistoryIndex, setDrillHistoryIndex] = useState(0);

  // Roulette swipe state
  const rouletteTouchStartX    = useRef(0);
  const rouletteTouchStartY    = useRef(0);
  const rouletteTouchStartTime = useRef(0);
  const rouletteIsHorizontal   = useRef<boolean | null>(null);
  const rouletteRafRef         = useRef<number | undefined>(undefined);
  const [rouletteDragX,      setRouletteDragX]      = useState(0);
  const [rouletteIsDragging, setRouletteIsDragging] = useState(false);

  // Training Telemetry — expand/collapse + stat toggle
  const [telemetryOpen, setTelemetryOpen] = useState(false);
  const [telemetryStat, setTelemetryStat] = useState<'sessions' | 'hours'>('sessions');

  // Week view toggle — carousel (minimalist) vs list (detailed)
  type WeekViewMode = 'carousel' | 'list';
  const [weekView, setWeekView] = useState<WeekViewMode>(
    () => (localStorage.getItem('j2_week_view') as WeekViewMode) || 'carousel'
  );
  const handleWeekViewChange = useCallback((mode: WeekViewMode) => {
    setWeekView(mode);
    localStorage.setItem('j2_week_view', mode);
  }, []);

  const handleRouletteTouchStart = (e: React.TouchEvent) => {
    rouletteTouchStartX.current    = e.touches[0].clientX;
    rouletteTouchStartY.current    = e.touches[0].clientY;
    rouletteTouchStartTime.current = Date.now();
    rouletteIsHorizontal.current   = null;
    setRouletteIsDragging(true);
  };
  const handleRouletteTouchMove = (e: React.TouchEvent) => {
    const rawDx = e.touches[0].clientX - rouletteTouchStartX.current;
    const dy    = e.touches[0].clientY - rouletteTouchStartY.current;

    // Direction lock — decide on first significant movement
    if (rouletteIsHorizontal.current === null) {
      if (Math.abs(rawDx) > 8 || Math.abs(dy) > 8) {
        rouletteIsHorizontal.current = Math.abs(rawDx) > Math.abs(dy);
      }
      return;
    }
    if (!rouletteIsHorizontal.current) return;

    // Rubber-band at left edge (no history to go back to)
    let dx = rawDx;
    if (drillHistoryIndex === 0 && rawDx > 0) {
      dx = rawDx * 0.3;
    }

    if (rouletteRafRef.current !== undefined) return;
    rouletteRafRef.current = requestAnimationFrame(() => {
      setRouletteDragX(dx);
      rouletteRafRef.current = undefined;
    });
  };
  const handleRouletteTouchEnd = (e: React.TouchEvent) => {
    if (rouletteRafRef.current !== undefined) { cancelAnimationFrame(rouletteRafRef.current); rouletteRafRef.current = undefined; }
    const dx  = e.changedTouches[0].clientX - rouletteTouchStartX.current;
    const dt  = Date.now() - rouletteTouchStartTime.current;
    const vel = Math.abs(dx) / Math.max(dt, 1);
    if (Math.abs(dx) > 45 || vel > 0.35) {
      if (dx < 0) {
        // Swipe left → new random drill
        const currentDrill = drillHistory[drillHistoryIndex];
        const next = (currentDrill + 1 + Math.floor(Math.random() * (ROULETTE_DRILLS.length - 1))) % ROULETTE_DRILLS.length;
        setDrillHistory(prev => [...prev.slice(0, drillHistoryIndex + 1), next]);
        setDrillHistoryIndex(i => i + 1);
      } else {
        // Swipe right → previous drill from history
        setDrillHistoryIndex(i => Math.max(0, i - 1));
      }
    }
    setRouletteDragX(0);
    setRouletteIsDragging(false);
  };

  // Modals
  const [logOpen,             setLogOpen]             = useState(false);
  const [logDate,             setLogDate]             = useState<string | null>(null);
  const [setIntentOpen,       setSetIntentOpen]       = useState(false);
  const [detailSessions,      setDetailSessions]      = useState<SessionSummary[]>([]);
  const [detailSessionIndex,  setDetailSessionIndex]  = useState(0);
  const [detailDate,          setDetailDate]          = useState<Date | null>(null);
  const [detailIntention,     setDetailIntention]     = useState<Intention | null>(null);
  const detailSession = detailSessions[detailSessionIndex] ?? null;

  // ── Data fetching ──────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      // Fetch 168 days back (covers the 24-week heatmap widget) through 5 days ahead
      // (covers the day-card carousel). The week carousel filters via sessionsByDate
      // so extra historical sessions don't affect it.
      const from = new Date(Date.now() - 168 * 86_400_000).toISOString().slice(0, 10);
      const to   = new Date(Date.now() +  5 * 86_400_000).toISOString().slice(0, 10);
      const [sessRes, intRes] = await Promise.all([
        api.get<SessionsResponse>(`/api/sessions?from=${from}&to=${to}`),
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
  useOnlineRefetch(fetchAll);

  const anyModalOpen = logOpen || !!detailSession || setIntentOpen;
  useBodyScrollLock(anyModalOpen);

  const pendingSessions = usePendingSessions();
  const allSessions = useMemo(() => [...sessions, ...pendingSessions], [sessions, pendingSessions]);
  const { streakDays } = useMemo(() => computeStats(allSessions, new Date().getFullYear()), [allSessions]);

  // ── Window computation ─────────────────────────────────────────────────

  const today = useMemo(() => new Date(), []);

  const windowDays = useMemo(() => {
    return Array.from({ length: 11 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + (i - 5));
      return d;
    });
  }, [today]);

  // Mon–Sun of the current ISO week (for the 7-dot indicator)
  const weekDays = useMemo(() => {
    const monday = new Date(today);
    const dow = monday.getDay(); // 0 = Sun
    monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [today]);
  // Days-from-Monday offset for today (used to map weekDays index → windowDays index)
  const todayDowOffset = today.getDay() === 0 ? 6 : today.getDay() - 1;

  // Active intention: any intention whose window contains today
  const todayStr = toDateString(today);
  const activeIntention = intentions.find(i => {
    const start = i.week_start.slice(0, 10);
    const end   = addDays(start, (i.duration_days ?? 7) - 1);
    return todayStr >= start && todayStr <= end;
  }) ?? null;

  const intentionStartStr = activeIntention ? activeIntention.week_start.slice(0, 10) : null;
  const intentionEndStr = intentionStartStr && activeIntention
    ? addDays(intentionStartStr, (activeIntention.duration_days ?? 7) - 1)
    : null;

  // Shared intention-brightness helper — used by both mobile and desktop carousels
  const getIntentionInfo = useCallback((dayStr: string) => {
    const dayHasIntention = activeIntention !== null
      && intentionStartStr !== null && intentionEndStr !== null
      && dayStr >= intentionStartStr && dayStr <= intentionEndStr;
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
    return { dayHasIntention, intentionBrightness };
  }, [activeIntention, intentionStartStr, intentionEndStr, today]);

  // Sessions indexed by date string — all sessions per day
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionSummary[]>();
    allSessions.forEach(s => {
      const key = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
      const existing = map.get(key) ?? [];
      map.set(key, [...existing, s]);
    });
    return map;
  }, [allSessions]);

  // Flat list of this-week sessions for the list view (sorted chronologically)
  const weekSessionsList = useMemo(() => {
    const list: { session: SessionSummary; day: Date; dayStr: string }[] = [];
    for (const day of weekDays) {
      const dayStr = toDateString(day);
      for (const session of (sessionsByDate.get(dayStr) ?? [])) {
        list.push({ session, day, dayStr });
      }
    }
    return list;
  }, [weekDays, sessionsByDate]);

  // ── Window stats ───────────────────────────────────────────────────────

  const windowStats = useMemo(() => {
    const windowDateStrings = new Set(windowDays.map(toDateString));
    const windowSessions = allSessions.filter(s => {
      const key = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
      return windowDateStrings.has(key);
    });
    const totalMinutes = windowSessions.reduce((acc, s) => acc + s.duration, 0);
    // Top skill tag
    const tagCounts: Record<string, number> = {};
    windowSessions.forEach(s => s.tags?.forEach(t => { tagCounts[t] = (tagCounts[t] ?? 0) + 1; }));
    const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    const topTagEntry = sorted[0] ?? null;
    const topTag      = topTagEntry?.[0] ?? null;
    const topTagCount = topTagEntry?.[1] ?? 0;
    const topTagLabel = topTag ? (SKILL_TAGS.find(s => s.value === topTag)?.label ?? topTag) : null;
    const tag2Entry   = sorted[1] ?? null;
    const tag2Label   = tag2Entry ? (SKILL_TAGS.find(s => s.value === tag2Entry[0])?.label ?? tag2Entry[0]) : null;
    return { count: windowSessions.length, totalMinutes, topTagLabel, topTagCount, tag2Label };
  }, [allSessions, windowDays]);

  // ── Intent delete ──────────────────────────────────────────────────────

  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleDeleteIntention = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    setDeleteConfirm(false);
    if (!activeIntention) return;
    try {
      await api.delete<DeleteResponse>(`/api/intentions/${activeIntention.id}`);
      setIntentions(prev => prev.filter(i => i.id !== activeIntention.id));
    } catch {
      // silent — user can retry
    }
  };

  // Week scroll — center today on mount (only in carousel mode)
  useEffect(() => {
    if (weekView !== 'carousel') return;
    const el = weekScrollRef.current;
    if (!el) return;
    el.scrollTo({ left: todayDowOffset * (MINI_CARD_W + MINI_CARD_GAP), behavior: 'instant' as ScrollBehavior });
  }, [todayDowOffset, weekView]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <PageContent ready={!loading}>
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 space-y-4">
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
        @keyframes j2RouletteEdgeBounce {
          0%        { transform: translateX(0); }
          15%       { transform: translateX(-12px); }
          30%       { transform: translateX(3px); }
          40%, 100% { transform: translateX(0); }
        }
        .j2-day-scroll { scrollbar-width: none; -webkit-overflow-scrolling: touch; }
        .j2-day-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── Page title ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
          The Path Ahead
        </h2>
      </div>

      {/* ── Intent banner ─────────────────────────────────────────── */}
      {intentionsEnabled ? (
        <div
          className="rounded-xl px-4 py-2"
          style={{
            position: 'relative',
            overflow: 'hidden',
            minHeight: 40,
            backgroundColor: activeIntention ? 'rgba(242,228,168,0.06)' : SURFACE_2,
            border: `1px solid ${activeIntention ? 'rgba(242,228,168,0.18)' : SURFACE_2_BORDER}`,
            boxShadow: activeIntention ? '0 0 12px rgba(242,228,168,0.08)' : 'none',
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
            background: 'linear-gradient(to top, rgba(242,228,168,0.09) 0%, transparent 100%)',
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
                  backgroundColor: 'rgba(242,228,168,0.9)',
                  boxShadow: activeIntention ? '0 0 6px 2px rgba(242,228,168,0.75)' : '0 0 2px 1px rgba(242,228,168,0.2)',
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
                  <span className="text-sm" style={{ color: 'rgba(242,228,168,0.5)' }}>◈</span>
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
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {deleteConfirm && (
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="py-2 px-3 text-xs text-white/25 hover:text-white/50 transition-colors"
                    >
                      ×
                    </button>
                  )}
                  <button
                    onClick={handleDeleteIntention}
                    className="py-2 px-3 text-xs transition-colors flex-shrink-0"
                    style={{ color: deleteConfirm ? 'rgba(248,113,113,0.85)' : 'rgba(255,255,255,0.25)' }}
                  >
                    {deleteConfirm ? 'Confirm?' : 'Delete'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-white/30 italic">No intention set for this week.</p>
                <button
                  onClick={() => setSetIntentOpen(true)}
                  className="text-sm font-medium flex-shrink-0 transition-colors"
                  style={{ color: PALE_YELLOW }}
                >
                  + Set intent
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Intentions disabled — thin glowing accent line */
        <div style={{
          height: 2,
          borderRadius: 2,
          background: `linear-gradient(to right, transparent 0%, rgba(242,228,168,0.55) 20%, rgba(242,228,168,0.55) 80%, transparent 100%)`,
          boxShadow: '0 0 10px 2px rgba(242,228,168,0.18)',
          animation: 'j2IntentYellowPulse 3.1s ease-in-out infinite',
        }} />
      )}

      {/* ── Telemetry expanded panel (above tiles) ──────────────── */}
      <div style={{
        maxHeight: telemetryOpen ? 200 : 0,
        opacity: telemetryOpen ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
      }}>
        <div
          className="rounded-xl px-4 py-2.5 mb-2"
          style={{
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: SURFACE_2,
            border: `1px solid ${COPPER_BORDER}`,
          }}
        >
          {/* Particle / glow layer */}
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
              background: 'radial-gradient(ellipse at center bottom, rgba(196,145,95,0.15) 0%, transparent 80%)',
              animation: 'j2IntentCopperPulse 5.5s ease-in-out infinite',
            }} />
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0, height: 18,
              background: 'linear-gradient(to top, rgba(196,145,95,0.12) 0%, transparent 100%)',
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
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>Training Telemetry</span>
              <span style={{
                display: 'inline-block', width: 20, height: 1.5,
                borderRadius: 1,
                backgroundColor: 'rgba(196,145,95,0.55)',
                boxShadow: '0 0 6px 2px rgba(196,145,95,0.3)',
                verticalAlign: 'middle',
              }} />
            </div>
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span className="text-white/50">
                <span className="font-semibold text-white">{windowStats.count}</span> session{windowStats.count !== 1 ? 's' : ''}
              </span>
              <span className="text-white/20">·</span>
              <span className="text-white/50">
                <span className="font-semibold text-white">{formatDuration(windowStats.totalMinutes)}</span> total
              </span>
            </div>
            {windowStats.topTagLabel && (() => {
              const { topTagLabel, topTagCount, count, tag2Label } = windowStats;
              const pct = count > 0 ? topTagCount / count : 0;
              let before: string;
              let highlight: string;
              let after: string | null = null;
              let highlight2: string | null = null;
              if (tag2Label && pct < 0.7) {
                before = 'Splitting time between ';
                highlight = topTagLabel!;
                after = ' and ';
                highlight2 = tag2Label;
              } else if (pct === 1 && count > 1) {
                before = `All ${count} sessions went into `;
                highlight = topTagLabel!;
              } else {
                before = 'Recent sessions have been leaning into ';
                highlight = topTagLabel!;
              }
              return (
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.45 }}>
                  {before}
                  <strong style={{ color: 'rgba(218,116,34,0.85)', fontWeight: 600 }}>{highlight}</strong>
                  {after && highlight2 ? (
                    <>{after}<strong style={{ color: 'rgba(218,116,34,0.85)', fontWeight: 600 }}>{highlight2}</strong></>
                  ) : null}
                  {'.'}
                </p>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── Tiles row ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10 }}>
        {/* Rep Roulette tile */}
        <button
          onClick={() => { if (rouletteOpen) { setRouletteOpen(false); } else { setRouletteOpen(true); setTelemetryOpen(false); } }}
          className="flex-1 rounded-xl flex flex-col items-center justify-center gap-1.5 touch-manipulation"
          style={{
            minHeight: 90,
            backgroundColor: rouletteOpen ? 'rgba(242,228,168,0.06)' : CARD_BG,
            border: `1px solid ${rouletteOpen ? 'rgba(242,228,168,0.25)' : COPPER_BORDER}`,
            transition: 'background-color 0.3s ease, border-color 0.3s ease',
          }}
          data-testid="roulette-header"
        >
          <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
            Rep Roulette
          </span>
          <span style={{
            color: 'rgba(196,145,95,0.7)',
            transform: rouletteOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease',
            fontSize: 12,
          }}>▾</span>
        </button>

        {/* Training Telemetry tile */}
        <button
          onClick={() => { if (telemetryOpen) { setTelemetryOpen(false); } else { setTelemetryOpen(true); setRouletteOpen(false); } }}
          className="flex-1 rounded-xl flex flex-col items-center justify-center gap-0.5 touch-manipulation"
          style={{
            minHeight: 90,
            backgroundColor: telemetryOpen ? 'rgba(196,145,95,0.06)' : CARD_BG,
            border: `1px solid ${telemetryOpen ? 'rgba(196,145,95,0.35)' : COPPER_BORDER}`,
            transition: 'background-color 0.3s ease, border-color 0.3s ease',
          }}
          data-testid="telemetry-header"
        >
          <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Telemetry
          </span>
          <span
            className="text-lg font-bold"
            style={{ color: 'rgba(255,255,255,0.85)' }}
            onClick={(e) => { e.stopPropagation(); setTelemetryStat(s => s === 'sessions' ? 'hours' : 'sessions'); }}
          >
            {telemetryStat === 'sessions'
              ? windowStats.count
              : formatDuration(windowStats.totalMinutes)}
          </span>
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {telemetryStat === 'sessions'
              ? `session${windowStats.count !== 1 ? 's' : ''}`
              : 'total'}
          </span>
          <span style={{
            color: 'rgba(196,145,95,0.7)',
            transform: telemetryOpen ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 0.3s ease',
            fontSize: 12,
          }}>▴</span>
        </button>
      </div>

      {/* ── Roulette expanded panel (below tiles) ──────────────── */}
      <div style={{
        maxHeight: rouletteOpen ? 250 : 0,
        opacity: rouletteOpen ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
      }}>
        <div
          className="rounded-xl px-4 py-3"
          style={{
            touchAction: 'pan-y',
            backgroundColor: 'rgba(242,228,168,0.04)',
            border: '1px solid rgba(242,228,168,0.15)',
          }}
          data-testid="roulette-drill-area"
          data-no-page-swipe=""
          onTouchStart={handleRouletteTouchStart}
          onTouchMove={handleRouletteTouchMove}
          onTouchEnd={handleRouletteTouchEnd}
        >
          {/* Bounce affordance wrapper */}
          <div style={{
            animation: rouletteOpen ? 'j2RouletteEdgeBounce 0.8s ease 0.4s both' : 'none',
          }}>
            {/* Drag-follow content */}
            <div style={{
              transform: `translateX(${rouletteIsDragging ? rouletteDragX : 0}px)`,
              transition: rouletteIsDragging ? 'none' : 'transform 0.38s cubic-bezier(0.25, 1.3, 0.4, 1)',
            }}>
              <p className="text-xl font-semibold mb-0.5" style={{ color: 'rgba(242,228,168,0.85)' }}>
                {ROULETTE_DRILLS[drillHistory[drillHistoryIndex]].name}
              </p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {ROULETTE_DRILLS[drillHistory[drillHistoryIndex]].focus}
                <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 6px' }}>·</span>
                {ROULETTE_DRILLS[drillHistory[drillHistoryIndex]].suggestion}
              </p>
              <p className="text-sm mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {ROULETTE_DRILLS[drillHistory[drillHistoryIndex]].description}
              </p>
              <p style={{
                fontSize: 11,
                color: 'rgba(196,145,95,0.35)',
                marginTop: 10,
                textAlign: 'center',
                letterSpacing: '0.04em',
                userSelect: 'none',
              }}>
                ← swipe to browse →
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Week section header + view toggle ──────── */}
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}
        >
          This Week
        </span>
        <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ backgroundColor: SURFACE_2 }}>
          {([
            { id: 'carousel' as const, Icon: CalendarDays },
            { id: 'list' as const, Icon: List },
          ]).map(({ id, Icon }) => {
            const isActive = weekView === id;
            return (
              <button
                key={id}
                onClick={() => handleWeekViewChange(id)}
                className="flex items-center justify-center rounded-md transition-colors touch-manipulation"
                style={{
                  width: 34,
                  height: 30,
                  backgroundColor: isActive ? COPPER : 'transparent',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.35)',
                  transition: 'background-color 200ms ease, color 200ms ease',
                }}
                aria-label={id === 'carousel' ? 'Calendar view' : 'List view'}
              >
                <Icon size={14} strokeWidth={isActive ? 2 : 1.5} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Week view: carousel (minimalist) ──────── */}
      {weekView === 'carousel' ? (
        <div
          ref={weekScrollRef}
          data-testid="week-scroll"
          data-no-page-swipe=""
          className="j2-day-scroll"
          style={{
            display: 'flex',
            gap: MINI_CARD_GAP,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            scrollBehavior: 'smooth',
            paddingBottom: 6,
            animation: 'j2IntentFadeIn 250ms ease both',
          }}
        >
          {weekDays.map((day) => {
            const dayStr = toDateString(day);
            const daySessions = sessionsByDate.get(dayStr) ?? [];
            const isToday = dayStr === toDateString(today);
            const isPast  = dayStr < toDateString(today);
            const sessionCount = daySessions.length;
            const totalMinutes = daySessions.reduce((sum, s) => sum + Number(s.duration), 0);
            const primarySession = sessionCount > 0
              ? [...daySessions].sort((a, b) => Number(b.intensity) - Number(a.intensity))[0]
              : null;
            const intensityColor = primarySession ? (INTENSITY_COLOR[primarySession.intensity] ?? '#CDDFA0') : null;
            const { dayHasIntention } = getIntentionInfo(dayStr);

            const isInStreak = sessionCount > 0 && streakDays.has(dayStr);

            return (
              <button
                key={dayStr}
                onClick={() => {
                  if (sessionCount > 0) {
                    setDetailSessions(daySessions);
                    setDetailSessionIndex(0);
                    setDetailDate(day);
                    setDetailIntention(dayHasIntention ? activeIntention : null);
                  } else {
                    setLogDate(toDateString(day));
                    setLogOpen(true);
                  }
                }}
                className="flex flex-col items-center justify-center gap-1 rounded-xl touch-manipulation"
                style={{
                  flexShrink: 0,
                  width: MINI_CARD_W,
                  minHeight: 100,
                  scrollSnapAlign: 'start',
                  backgroundColor: CARD_BG,
                  border: isToday ? '1px solid rgba(196,145,95,0.7)' : '1px solid rgba(255,255,255,0.07)',
                  boxShadow: isToday
                    ? '0 0 12px rgba(196,145,95,0.2), 0 2px 8px rgba(0,0,0,0.3)'
                    : '0 2px 4px rgba(0,0,0,0.15)',
                  animation: isToday ? 'j2-today-pulse 4s ease-in-out infinite' : undefined,
                  padding: '10px 6px',
                  borderBottom: dayHasIntention
                    ? '2px solid rgba(242,228,168,0.35)'
                    : undefined,
                  transition: 'box-shadow 0.3s ease',
                }}
              >
                {/* Day name */}
                <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: isToday ? '#C4915F' : 'rgba(255,255,255,0.35)' }}>
                  {DAY_NAMES[day.getDay()]}
                </span>
                {/* Date */}
                <span className="text-sm font-bold" style={{ color: isToday ? '#C4915F' : 'rgba(255,255,255,0.85)' }}>
                  {MONTH_NAMES[day.getMonth()]} {day.getDate()}
                </span>
                {/* Session indicator */}
                {sessionCount > 0 ? (
                  <>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: intensityColor! }} />
                    <span className="text-[11px] font-semibold text-white">{formatDuration(totalMinutes)}</span>
                  </>
                ) : isToday ? (
                  <span className="text-[11px] font-semibold" style={{ color: 'rgba(196,145,95,0.85)' }}>+ Mat Time</span>
                ) : isPast ? (
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.15)' }}>Rest</span>
                ) : (
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.12)' }}>—</span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        /* ── Week view: detail list ──────── */
        <div
          data-testid="week-list"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            animation: 'j2IntentFadeIn 250ms ease both',
          }}
        >
          {weekSessionsList.length === 0 ? (
            /* Empty state — no sessions this week */
            <div style={{ textAlign: 'center', padding: '24px 16px' }}>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginBottom: 12 }}>
                No sessions logged this week yet.
              </p>
              <button
                onClick={() => { setLogDate(toDateString(today)); setLogOpen(true); }}
                className="text-sm font-semibold touch-manipulation"
                style={{
                  color: COPPER,
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: '1px dashed rgba(196,145,95,0.5)',
                  backgroundColor: SURFACE_2,
                  transition: 'background-color 200ms ease',
                }}
              >
                + Log Mat Time
              </button>
            </div>
          ) : (
            <>
              {/* Today prompt — if today has no sessions */}
              {(sessionsByDate.get(toDateString(today)) ?? []).length === 0 && (
                <button
                  onClick={() => { setLogDate(toDateString(today)); setLogOpen(true); }}
                  className="w-full text-left touch-manipulation"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    borderRadius: 14,
                    backgroundColor: SURFACE_2,
                    border: '1px dashed rgba(196,145,95,0.5)',
                    transition: 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(4px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                    Today — {MONTH_NAMES[today.getMonth()]} {today.getDate()}
                  </span>
                  <span style={{ color: COPPER, fontSize: 14, fontWeight: 600 }}>
                    + Mat Time
                  </span>
                </button>
              )}

              {/* Session cards */}
              {weekSessionsList.map(({ session, day, dayStr }) => {
                const daySessions = sessionsByDate.get(dayStr) ?? [];
                const isToday = dayStr === toDateString(today);
                const intensityColor = INTENSITY_COLOR[session.intensity] ?? '#CDDFA0';
                const giLabel = session.gi_nogi === 'gi' ? 'Gi' : 'No-Gi';
                const typeLabel = SESSION_TYPE_LABELS[session.session_type] ?? session.session_type;
                const primaryTag = session.tags?.[0]
                  ? (SKILL_TAGS.find(s => s.value === session.tags[0])?.label ?? session.tags[0])
                  : null;
                const title = primaryTag ? `${giLabel} ${typeLabel} — ${primaryTag}` : `${giLabel} ${typeLabel}`;
                const { dayHasIntention } = getIntentionInfo(dayStr);

                return (
                  <button
                    key={session.id}
                    onClick={() => {
                      const idx = daySessions.findIndex(s => s.id === session.id);
                      setDetailSessions(daySessions);
                      setDetailSessionIndex(idx >= 0 ? idx : 0);
                      setDetailDate(day);
                      setDetailIntention(dayHasIntention ? activeIntention : null);
                    }}
                    className="w-full text-left touch-manipulation"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '16px 20px',
                      borderRadius: 14,
                      backgroundColor: CARD_BG,
                      border: isToday
                        ? '1px solid rgba(196,145,95,0.5)'
                        : '1px solid rgba(255,255,255,0.06)',
                      boxShadow: WHISPER_BORDER,
                      transition: 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(4px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; }}
                  >
                    {/* Type dot */}
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: intensityColor,
                        flexShrink: 0,
                      }}
                    />
                    {/* Title + meta */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'rgba(255,255,255,0.88)',
                          margin: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {title}
                      </p>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', margin: '2px 0 0' }}>
                        {DAY_NAMES[day.getDay()]}, {MONTH_NAMES[day.getMonth()]} {day.getDate()}
                        {session.tags?.length > 1 && (
                          <>
                            <span style={{ margin: '0 5px', color: 'rgba(255,255,255,0.15)' }}>·</span>
                            {SKILL_TAGS.find(s => s.value === session.tags[1])?.label ?? session.tags[1]}
                          </>
                        )}
                      </p>
                    </div>
                    {/* Duration */}
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: COPPER,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDuration(session.duration)}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ── Training history widget ───────────────────────────────── */}
      <HeatmapPreviewWidget sessions={sessions} />

      {/* ── Modals ────────────────────────────────────────────────── */}

      {logOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto backdrop-blur-sm px-5"
          style={{
            backgroundColor: 'rgba(13, 26, 20, 0.85)',
            backdropFilter: 'blur(12px) saturate(1.2)',
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          }}
          onClick={() => setLogOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-lg animate-j2-modal-in"
            style={{
              maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
              overflowY: 'auto',
            }}
          >
            <LogSessionForm
              onSuccess={(count) => {
                fetchAll();
                setLogOpen(false);
                setLogDate(null);
                if (count === 500 && !localStorage.getItem('j2-milestone-500')) {
                  localStorage.setItem('j2-milestone-500', '1');
                  toast({ title: '500 sessions. The mat remembers every one.' });
                }
              }}
              onCancel={() => { setLogOpen(false); setLogDate(null); }}
              defaultDate={logDate ?? undefined}
            />
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
          onDeleted={() => { fetchAll(); setDetailSessions([]); setDetailSessionIndex(0); setDetailDate(null); setDetailIntention(null); }}
        />
      )}

      {setIntentOpen && (
        <SetIntentionModal
          onSaved={fetchAll}
          onClose={() => setSetIntentOpen(false)}
        />
      )}
    </div>
    </PageContent>
  );
}
