import { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { api, ApiError } from '../lib/api.ts';
import { useOnlineRefetch } from '../hooks/useOnlineRefetch.ts';
import { usePendingSessions } from '../hooks/usePendingSessions.ts';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.ts';
import { SKILL_TAGS, ROULETTE_DRILLS, MONTH_NAMES } from '../lib/constants.ts';
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
import HomeHeader from '../components/HomeHeader.tsx';
import StatStrip from '../components/StatStrip.tsx';
import IntentionHeroCard from '../components/IntentionHeroCard.tsx';
import WeekIndicators from '../components/WeekIndicators.tsx';
import FirstVisitCard from '../components/FirstVisitCard.tsx';
import { toDateString, addDays, formatDuration, DAY_NAMES, INTENSITY_COLOR, SESSION_TYPE_LABELS } from '../lib/sessionUtils.ts';
import { STATS_PARTICLES } from '../lib/particles.ts';
import { computeStats } from '../components/TrainingHeatmap.tsx';

// ── Desktop breakpoint hook ───────────────────────────────────────────────

const DESKTOP_MQ = '(min-width: 1024px)';
const mqSubscribe = (cb: () => void) => {
  const mql = window.matchMedia(DESKTOP_MQ);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
};
const mqSnapshot = () => window.matchMedia(DESKTOP_MQ).matches;
const mqServerSnapshot = () => false;
function useIsDesktop() {
  return useSyncExternalStore(mqSubscribe, mqSnapshot, mqServerSnapshot);
}

// ── Types ──────────────────────────────────────────────────────────────────

interface DeleteResponse      { message: string }

// ── PathAheadPage ──────────────────────────────────────────────────────────

export default function PathAheadPage() {
  const { name, intentionsEnabled } = useProfile();
  const isDesktop = useIsDesktop();
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
  const { streak, longestStreak } = useMemo(() => computeStats(allSessions, new Date().getFullYear()), [allSessions]);

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

  // ── Week stats (Mon-Sun of current week) ──────────────────────────────
  const weekStats = useMemo(() => {
    const weekDateStrings = new Set(weekDays.map(toDateString));
    const weekSessions = allSessions.filter(s => {
      const key = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
      return weekDateStrings.has(key);
    });
    const totalMinutes = weekSessions.reduce((acc, s) => acc + s.duration, 0);
    return { count: weekSessions.length, totalMinutes };
  }, [allSessions, weekDays]);

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

  // Week scroll — center today on mount (only in carousel mode)
  useEffect(() => {
    if (weekView !== 'carousel') return;
    const el = weekScrollRef.current;
    if (!el) return;
    el.scrollTo({ left: todayDowOffset * (MINI_CARD_W + MINI_CARD_GAP), behavior: 'instant' as ScrollBehavior });
  }, [todayDowOffset, weekView]);

  // ── Shared JSX fragments ────────────────────────────────────────────────

  const styleBlock = (
    <style>{`
      .j2-day-scroll { scrollbar-width: none; -webkit-overflow-scrolling: touch; }
      .j2-day-scroll::-webkit-scrollbar { display: none; }
    `}</style>
  );

  const telemetryContent = (
    <div
      className="rounded-xl px-4 py-2.5"
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
  );

  const weekSectionHeader = (
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
  );

  const weekViewContent = weekView === 'carousel' ? (
    <WeekIndicators
      weekDays={weekDays}
      today={today}
      sessionsByDate={sessionsByDate}
      onDayTap={(day, sessions) => {
        setDetailSessions(sessions);
        setDetailSessionIndex(0);
        setDetailDate(day);
        const dayStr = toDateString(day);
        const { dayHasIntention } = getIntentionInfo(dayStr);
        setDetailIntention(dayHasIntention ? activeIntention : null);
      }}
      onLogTap={(day) => {
        setLogDate(toDateString(day));
        setLogOpen(true);
      }}
    />
  ) : (
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
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: intensityColor,
                    flexShrink: 0,
                  }}
                />
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
  );

  const primaryCta = (sessionsByDate.get(toDateString(today)) ?? []).length === 0 ? (
    <button
      onClick={() => { setLogDate(toDateString(today)); setLogOpen(true); }}
      className="w-full rounded-xl py-3 text-base font-semibold text-white touch-manipulation"
      style={{
        backgroundColor: '#DA7422',
        boxShadow: '0 2px 12px rgba(218,116,34,0.3)',
        transition: 'transform 150ms ease, box-shadow 150ms ease',
      }}
    >
      + Mat Time
    </button>
  ) : null;

  const rouletteSection = (
    <>
      <button
        onClick={() => { if (rouletteOpen) { setRouletteOpen(false); } else { setRouletteOpen(true); setTelemetryOpen(false); } }}
        className="w-full rounded-xl px-4 py-3 flex items-center justify-between touch-manipulation"
        style={{
          backgroundColor: rouletteOpen ? 'rgba(242,228,168,0.06)' : CARD_BG,
          border: `1px solid ${rouletteOpen ? 'rgba(242,228,168,0.25)' : COPPER_BORDER}`,
          transition: 'background-color 0.3s ease, border-color 0.3s ease',
        }}
        data-testid="roulette-header"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
            Rep Roulette
          </span>
          {!rouletteOpen && (
            <span className="text-xs truncate max-w-[140px]" style={{ color: 'rgba(255,255,255,0.30)' }}>
              {ROULETTE_DRILLS[drillHistory[drillHistoryIndex]].name}
            </span>
          )}
        </div>
        <span style={{
          color: 'rgba(196,145,95,0.7)',
          transform: rouletteOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.3s ease',
          fontSize: 12,
        }}>▾</span>
      </button>
      <div style={{
        maxHeight: rouletteOpen ? 250 : 0,
        opacity: rouletteOpen ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
      }}>
        <div
          className="rounded-xl px-4 py-3 mt-2"
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
          <div style={{ animation: rouletteOpen ? 'j2RouletteEdgeBounce 0.8s ease 0.4s both' : 'none' }}>
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
                fontSize: 11, color: 'rgba(196,145,95,0.35)', marginTop: 10,
                textAlign: 'center', letterSpacing: '0.04em', userSelect: 'none',
              }}>
                ← swipe to browse →
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const heatmapSection = allSessions.length >= 5 ? (
    <HeatmapPreviewWidget sessions={sessions} />
  ) : (
    <div className="rounded-xl px-4 py-5 text-center"
         style={{ backgroundColor: SURFACE_2, border: `1px solid ${SURFACE_2_BORDER}` }}>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
        Log a few more sessions and your training rhythm will appear here.
      </p>
    </div>
  );

  const modals = (
    <>
      {logOpen && (
        <div
          data-no-page-swipe=""
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-5"
          style={{
            backgroundColor: 'rgba(13, 26, 20, 0.97)',
            backdropFilter: 'blur(16px)',
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          }}
          onClick={() => setLogOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-lg animate-j2-modal-in"
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
    </>
  );

  // ── Render ─────────────────────────────────────────────────────────────

  if (isDesktop) {
    /* ═══════════════════════════════════════════════════════════════════
       DESKTOP LAYOUT — two-column dashboard
       ═══════════════════════════════════════════════════════════════════ */
    return (
      <PageContent ready={!loading} loadingMessages={['Shrimping down the mat...', 'Doing mat swims...', 'Pulling up gi pants...']}>
      <div className="max-w-6xl mx-auto px-8 py-5">
        {styleBlock}

        {/* ── Header row ──────────────────────────────────────────── */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2
              className="text-2xl font-bold tracking-tight"
              style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}
            >
              The Path Ahead
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
              {name && <span style={{ color: 'rgba(255,255,255,0.25)' }}> — {name}</span>}
            </p>
          </div>
          {primaryCta && (
            <button
              onClick={() => { setLogDate(toDateString(today)); setLogOpen(true); }}
              className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white"
              style={{
                backgroundColor: '#DA7422',
                boxShadow: '0 2px 12px rgba(218,116,34,0.3)',
                transition: 'transform 150ms ease, box-shadow 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(218,116,34,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(218,116,34,0.3)'; }}
            >
              + Log Session
            </button>
          )}
        </div>

        {/* Subtle divider */}
        <div style={{
          height: 1,
          background: 'linear-gradient(to right, transparent 0%, rgba(196,145,95,0.25) 20%, rgba(196,145,95,0.25) 80%, transparent 100%)',
          marginBottom: 24,
        }} />

        {allSessions.length === 0 ? (
          /* ── Empty state ── */
          <div className="max-w-md mx-auto">
            <FirstVisitCard onLogFirst={() => { setLogDate(toDateString(today)); setLogOpen(true); }} />
          </div>
        ) : (
          /* ── Two-column grid ────────────────────────────────────── */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 28, alignItems: 'start' }}>

            {/* ── LEFT: Main content ──────────────────────────────── */}
            <div className="space-y-5">
              {/* Week section */}
              {weekSectionHeader}
              {weekViewContent}

              {/* Training Telemetry — always visible on desktop */}
              {telemetryContent}
            </div>

            {/* ── RIGHT: Sidebar ──────────────────────────────────── */}
            <div className="space-y-4">
              {/* Stats */}
              <StatStrip
                streak={streak}
                longestStreak={longestStreak}
                weekSessionCount={weekStats.count}
                weekTotalMinutes={weekStats.totalMinutes}
              />

              {/* Intention */}
              {intentionsEnabled && (
                <IntentionHeroCard
                  intention={activeIntention}
                  onSetIntent={() => setSetIntentOpen(true)}
                  onDeleteIntent={handleDeleteIntention}
                />
              )}

              {/* Rep Roulette */}
              {rouletteSection}

              {/* Heatmap */}
              {heatmapSection}
            </div>
          </div>
        )}

        {modals}
      </div>
      </PageContent>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
     MOBILE LAYOUT — single-column stacked (the modernized phone UI)
     ═══════════════════════════════════════════════════════════════════════ */
  return (
    <PageContent ready={!loading} loadingMessages={['Shrimping down the mat...', 'Doing mat swims...', 'Pulling up gi pants...']}>
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 space-y-4">
      {styleBlock}

      {/* ── A. Contextual Header ──────────────────────────────────── */}
      <HomeHeader name={name} />

      {/* ── B. Stat Strip ────────────────────────────────────────── */}
      <StatStrip
        streak={streak}
        weekSessionCount={weekStats.count}
        weekTotalMinutes={weekStats.totalMinutes}
        onTap={() => { setTelemetryOpen(prev => !prev); if (!telemetryOpen) setRouletteOpen(false); }}
      />

      {/* ── Telemetry expanded panel (above tiles) ──────────────── */}
      <div style={{
        maxHeight: telemetryOpen ? 200 : 0,
        opacity: telemetryOpen ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
      }}>
        <div style={{ marginBottom: 8 }}>{telemetryContent}</div>
      </div>

      {/* ── C. Intention Hero Card ─────────────────────────────── */}
      {intentionsEnabled && (
        <IntentionHeroCard
          intention={activeIntention}
          onSetIntent={() => setSetIntentOpen(true)}
          onDeleteIntent={handleDeleteIntention}
        />
      )}

      {/* ── D-H. Main content (conditional on sessions) ────────── */}
      {allSessions.length === 0 ? (
        <FirstVisitCard onLogFirst={() => { setLogDate(toDateString(today)); setLogOpen(true); }} />
      ) : (
      <>
        {weekSectionHeader}
        {weekViewContent}
        {primaryCta}
        {rouletteSection}
        {heatmapSection}
      </>
      )}

      {modals}
    </div>
    </PageContent>
  );
}
