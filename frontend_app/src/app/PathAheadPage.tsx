import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api.ts';
import { useOnlineRefetch } from '../hooks/useOnlineRefetch.ts';
import { usePendingSessions } from '../hooks/usePendingSessions.ts';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.ts';
import { SKILL_TAGS, MONTH_NAMES, EIGHT_GATES } from '../lib/constants.ts';
import type { SessionSummary, Intention, IntentionsResponse, SessionsResponse } from '../types/api.ts';
import LogSessionForm from '../components/LogSessionForm.tsx';
import SessionDetailModal from '../components/SessionDetailModal.tsx';
import SetIntentionModal from '../components/SetIntentionModal.tsx';
import { PALE_YELLOW, GLOW_SOFT, CARD_BG, COPPER, COPPER_BORDER, SURFACE_2, SURFACE_2_BORDER, WHISPER_BORDER, CARD_GLOW, CARD_GLOW_BORDER, FONT_EDITORIAL, INT_COLORS, PRESTIGE_TEAL, PRESTIGE_TEAL_GLOW } from '../lib/theme.ts';
import AnnualRadial from '../components/charts/AnnualRadial.tsx';
import { SKILL_COLORS } from '../components/charts/RadarChart.tsx';
import { CalendarDays, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '../hooks/use-toast.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import { useActiveIntention } from '../context/ActiveIntentionContext.tsx';
import PageContent from '../components/PageContent.tsx';
import HeatmapPreviewWidget from '../components/HeatmapPreviewWidget.tsx';
import HomeHeader from '../components/HomeHeader.tsx';
import StatStrip from '../components/StatStrip.tsx';
import IntentionHeroCard from '../components/IntentionHeroCard.tsx';
import WeekIndicators from '../components/WeekIndicators.tsx';
import FirstVisitCard from '../components/FirstVisitCard.tsx';
import DesktopPathAheadSkeleton from '../components/DesktopPathAheadSkeleton.tsx';
import { computeACWR, computeDecay, rustiest, computeACWRByPillar, spikiestPillar } from '../lib/analyticsModels.ts';
import { sessionPillarHours } from '../lib/analyticsUtils.ts';
import RepRouletteFab from '../components/RepRouletteFab.tsx';
import { toDateString, addDays, formatDuration, DAY_NAMES, INTENSITY_COLOR, SESSION_TYPE_LABELS } from '../lib/sessionUtils.ts';
import { STATS_PARTICLES } from '../lib/particles.ts';
import { computeStats } from '../components/TrainingHeatmap.tsx';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';

// ── Types ──────────────────────────────────────────────────────────────────

interface DeleteResponse      { message: string }

// ── PathAheadPage ──────────────────────────────────────────────────────────

export default function PathAheadPage() {
  const navigate = useNavigate();
  const { name, intentionsEnabled } = useProfile();
  const { refresh: refreshRailIntention } = useActiveIntention();
  const isDesktop = useIsDesktop();
  const [sessions,   setSessions]   = useState<SessionSummary[]>([]);
  const [intentions, setIntentions] = useState<Intention[]>([]);
  const [loading,    setLoading]    = useState(true);

  // Week scroll ref
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const MINI_CARD_W = 110;
  const MINI_CARD_GAP = 10;

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

  // Week navigation offset (0 = current week, -1 = last week, +1 = next)
  const [weekOffset, setWeekOffset] = useState(0);

  // Modals — log-session state is desktop-only. On mobile the modal lives
  // in MobileAppShell so the bottom-nav `+` FAB can launch it directly
  // from any page without redirecting through `/home`. PathAheadPage CTAs
  // call `openLog(...)` below which branches on viewport: desktop uses
  // local state, mobile dispatches `journada:open-log-form`.
  const [logOpen,             setLogOpen]             = useState(false);
  const [logDate,             setLogDate]             = useState<string | null>(null);
  // logPreset accepts both drill (existing) and constraint (CLA roulette)
  // shapes so the same modal can pre-fill from either pool.
  const [logPreset,           setLogPreset]           = useState<{
    heading?: string;
    sessionType?: 'drilling' | 'cla';
    subSkillTag?: string;
    constraintName?: string;
  } | null>(null);
  const [setIntentOpen,       setSetIntentOpen]       = useState(false);
  const [editIntention,       setEditIntention]       = useState<Intention | null>(null);
  const [detailSessions,      setDetailSessions]      = useState<SessionSummary[]>([]);
  const [detailSessionIndex,  setDetailSessionIndex]  = useState(0);
  const [detailDate,          setDetailDate]          = useState<Date | null>(null);
  const [detailIntention,     setDetailIntention]     = useState<Intention | null>(null);
  const detailSession = detailSessions[detailSessionIndex] ?? null;

  // ── Data fetching ──────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      // Desktop surfaces an AnnualRadial + full-year heatmap + all-time
      // consistent-weeks / longest-streak stats — all of which need the full
      // current year plus prior-year continuity. Fetch from the start of the
      // previous calendar year through 5 days ahead (future-dated sessions).
      // This covers mobile's 24-week heatmap too with plenty of headroom.
      const fromDate = new Date(new Date().getFullYear() - 1, 0, 1);
      const from = fromDate.toISOString().slice(0, 10);
      const to   = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
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

  // When the global (mobile) log-session modal saves, refetch this page's
  // data so its stats / heatmap stay current. Desktop's local modal calls
  // `fetchAll` inline via its onSuccess, so this listener is mainly for the
  // mobile path where the modal lives in MobileAppShell.
  useEffect(() => {
    const handler = () => fetchAll();
    window.addEventListener('journada:log-session-saved', handler);
    return () => window.removeEventListener('journada:log-session-saved', handler);
  }, [fetchAll]);

  // Branching log-modal opener — desktop opens the local modal directly,
  // mobile dispatches the event so MobileAppShell's modal opens.
  const openLog = useCallback((opts?: {
    date?: string;
    preset?: {
      heading?: string;
      sessionType?: 'drilling' | 'cla';
      subSkillTag?: string;
      constraintName?: string;
    } | null;
  }) => {
    const date = opts?.date ?? toDateString(new Date());
    const preset = opts?.preset ?? null;
    if (isDesktop) {
      setLogDate(date);
      setLogPreset(preset);
      setLogOpen(true);
    } else {
      window.dispatchEvent(new CustomEvent('journada:open-log-form', {
        detail: { date, preset },
      }));
    }
  }, [isDesktop]);

  const anyModalOpen = logOpen || !!detailSession || setIntentOpen;
  useBodyScrollLock(anyModalOpen);

  const pendingSessions = usePendingSessions();
  const allSessions = useMemo(() => [...sessions, ...pendingSessions], [sessions, pendingSessions]);
  const { streak, longestStreak, consistentWeeks } = useMemo(() => computeStats(allSessions, new Date().getFullYear()), [allSessions]);

  useEffect(() => {
    for (const gate of [...EIGHT_GATES].reverse()) {
      if (consistentWeeks >= gate.weeks) {
        const key = `j2-gate-${gate.weeks}`;
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1');
          toast({ title: gate.toast });
        }
        break;
      }
    }
  }, [consistentWeeks]);

  // ── Window computation ─────────────────────────────────────────────────

  const today = useMemo(() => new Date(), []);

  const windowDays = useMemo(() => {
    return Array.from({ length: 11 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + (i - 5));
      return d;
    });
  }, [today]);

  // Mon–Sun of the current ISO week — used for weekStats (StatStrip always shows current week)
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

  // Offset-shifted week — used by the visible carousel and list (weekOffset: -2..+1)
  const displayWeekDays = useMemo(() => {
    const monday = new Date(today);
    const dow = monday.getDay();
    monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [today, weekOffset]);

  // Section header label — "This Week" at offset 0, date range otherwise
  const weekLabel = useMemo(() => {
    if (weekOffset === 0) return 'This Week';
    const start = displayWeekDays[0]!;
    const end   = displayWeekDays[6]!;
    const sm = MONTH_NAMES[start.getMonth()];
    const em = MONTH_NAMES[end.getMonth()];
    return sm === em
      ? `${sm} ${start.getDate()} – ${end.getDate()}`
      : `${sm} ${start.getDate()} – ${em} ${end.getDate()}`;
  }, [weekOffset, displayWeekDays]);

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

  // Flat list of sessions for the list view — scoped to the displayed week
  const weekSessionsList = useMemo(() => {
    const list: { session: SessionSummary; day: Date; dayStr: string }[] = [];
    for (const day of displayWeekDays) {
      const dayStr = toDateString(day);
      for (const session of (sessionsByDate.get(dayStr) ?? [])) {
        list.push({ session, day, dayStr });
      }
    }
    return list;
  }, [displayWeekDays, sessionsByDate]);

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
    windowSessions.forEach(s => {
      const ph = sessionPillarHours(s);
      for (const [k, v] of Object.entries(ph)) tagCounts[k] = (tagCounts[k] ?? 0) + v;
    });
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

  // ── Advanced models ────────────────────────────────────────────────────
  const acwr = useMemo(() => computeACWR(allSessions), [allSessions]);
  const decay = useMemo(() => computeDecay(allSessions), [allSessions]);
  const rustiestPillar = useMemo(() => rustiest(decay), [decay]);
  const acwrByPillar = useMemo(() => computeACWRByPillar(allSessions), [allSessions]);
  const spikiest = useMemo(() => spikiestPillar(acwrByPillar), [acwrByPillar]);

  // ── Intent delete ──────────────────────────────────────────────────────

  const handleDeleteIntention = async () => {
    if (!activeIntention) return;
    try {
      await api.delete<DeleteResponse>(`/api/intentions/${activeIntention.id}`);
      setIntentions(prev => prev.filter(i => i.id !== activeIntention.id));
      refreshRailIntention();
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
      {/* Week label + prev/next navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setWeekOffset(o => Math.max(-2, o - 1))}
          disabled={weekOffset <= -2}
          className="flex items-center justify-center rounded-md touch-manipulation"
          style={{
            width: 26, height: 26,
            color: weekOffset <= -2 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.45)',
            transition: 'color 150ms ease',
          }}
          aria-label="Previous week"
        >
          <ChevronLeft size={15} strokeWidth={2} />
        </button>
        <button
          onClick={() => setWeekOffset(0)}
          className="text-sm font-semibold uppercase tracking-wide touch-manipulation"
          style={{
            color: weekOffset === 0 ? 'rgba(255,255,255,0.4)' : COPPER,
            letterSpacing: '0.06em',
            minWidth: 72,
            textAlign: 'center',
          }}
          aria-label="Return to current week"
        >
          {weekLabel}
        </button>
        <button
          onClick={() => setWeekOffset(o => Math.min(1, o + 1))}
          disabled={weekOffset >= 1}
          className="flex items-center justify-center rounded-md touch-manipulation"
          style={{
            width: 26, height: 26,
            color: weekOffset >= 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.45)',
            transition: 'color 150ms ease',
          }}
          aria-label="Next week"
        >
          <ChevronRight size={15} strokeWidth={2} />
        </button>
      </div>
      {/* View mode toggle */}
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
      weekDays={displayWeekDays}
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
      onLogTap={(day) => openLog({ date: toDateString(day) })}
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
            onClick={() => openLog()}
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
          {weekOffset === 0 && (sessionsByDate.get(toDateString(today)) ?? []).length === 0 && (
            <button
              onClick={() => openLog()}
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
      onClick={() => openLog()}
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
      {/* Desktop-only log modal. On mobile the modal lives in MobileAppShell
          so the bottom-nav `+` FAB launches directly without a route flip;
          openLog() dispatches `journada:open-log-form` on mobile. */}
      {isDesktop && logOpen && (
        <div
          data-no-page-swipe=""
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-5"
          style={{
            backgroundColor: 'rgba(13, 26, 20, 1)',
            backdropFilter: 'blur(16px)',
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          }}
          onClick={() => setLogOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-lg lg:max-w-5xl animate-j2-modal-in"
          >
            <LogSessionForm
              onSuccess={(count) => {
                fetchAll();
                setLogOpen(false);
                setLogDate(null);
                setLogPreset(null);
                if (count === 500 && !localStorage.getItem('j2-milestone-500')) {
                  localStorage.setItem('j2-milestone-500', '1');
                  toast({ title: '500 sessions. The mat remembers every one.' });
                }
              }}
              onCancel={() => { setLogOpen(false); setLogDate(null); setLogPreset(null); }}
              defaultDate={logDate ?? undefined}
              defaultHeading={logPreset?.heading}
              defaultSessionType={logPreset?.sessionType}
              defaultSubSkillTag={logPreset?.subSkillTag}
              defaultConstraintName={logPreset?.constraintName}
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

      {(setIntentOpen || editIntention) && (
        <SetIntentionModal
          editIntention={editIntention ?? undefined}
          onSaved={() => { fetchAll(); refreshRailIntention(); setEditIntention(null); }}
          onClose={() => { setSetIntentOpen(false); setEditIntention(null); }}
        />
      )}
    </>
  );

  // ── Render ─────────────────────────────────────────────────────────────

  if (isDesktop) {
    /* ═══════════════════════════════════════════════════════════════════
       DESKTOP LAYOUT — editorial dashboard (Phase 3 of desktop redesign)
       Rail shell wraps this page; we own everything right of the rail.

       Structure, top → bottom:
         • Editorial header (serif hero + date label + streak subtitle + CTAs)
         • 4-stat strip (always visible, inline)
         • 2-col main: AnnualRadial + week section (left) · sidebar cards (right)
         • Recent intentions row (full-width)
       ═══════════════════════════════════════════════════════════════════ */

    const year = today.getFullYear();
    const todayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(today).toUpperCase();

    // Streak subtitle — tiered copy based on consistent weeks
    const streakSubtitle =
      consistentWeeks >= 26 ? `${consistentWeeks} weeks logged. Consistency is showing.` :
      consistentWeeks >= 12 ? `${consistentWeeks} weeks in a row. Nice rhythm.` :
      consistentWeeks >= 1  ? `${consistentWeeks} week${consistentWeeks === 1 ? '' : 's'} in. Building the habit.` :
      `Welcome back${name ? `, ${name}` : ''}.`;

    // Alignment — sessions this week whose primary tag matches the active intention heading
    const weekDateStrings = new Set(weekDays.map(toDateString));
    const weekSessions = allSessions.filter(s => {
      const key = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
      return weekDateStrings.has(key);
    });
    const alignedCount = activeIntention
      ? weekSessions.filter(s => s.tags?.[0] === activeIntention.heading).length
      : 0;
    const alignmentPct = weekStats.count > 0 && activeIntention
      ? Math.round((alignedCount / weekStats.count) * 100)
      : 0;

    // Most recent session — for the sidebar widget
    const mostRecent = allSessions.length > 0
      ? [...allSessions].sort((a, b) => {
          const da = typeof a.date === 'string' ? a.date.slice(0, 10) : toDateString(new Date(a.date));
          const db = typeof b.date === 'string' ? b.date.slice(0, 10) : toDateString(new Date(b.date));
          return db.localeCompare(da);
        })[0]
      : null;

    // Last 30 days intensity distribution — 5 buckets
    const thirtyMs = 30 * 86_400_000;
    const last30 = allSessions.filter(s => {
      const key = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
      return today.getTime() - new Date(key + 'T00:00:00').getTime() < thirtyMs;
    });
    const intensityDist = [1, 2, 3, 4, 5].map(i => last30.filter(s => (s.intensity ?? 3) === i).length);
    const intensityMax = Math.max(1, ...intensityDist);

    // Recent intentions — latest 6 (already sorted newest-first from API)
    const recentIntentions = intentions.slice(0, 6);

    const heroCardStyle: React.CSSProperties = {
      backgroundColor: CARD_BG,
      border: `1px solid ${CARD_GLOW_BORDER}`,
      boxShadow: CARD_GLOW,
      borderRadius: 16,
    };
    const softCardStyle: React.CSSProperties = {
      backgroundColor: CARD_BG,
      border: '1px solid var(--j2-border-2)',
      borderRadius: 16,
    };

    // Desktop loading state — render the brand-correct skeleton instead of
    // the empty page chrome. PageContent itself short-circuits on desktop
    // (see PageContent.tsx:82), so the proper hand-off here is to swap in
    // the skeleton during `loading` rather than rely on the belt-tying
    // loader (which is mobile-only by design).
    if (loading) {
      return (
        <PageContent ready={true}>
          <DesktopPathAheadSkeleton />
        </PageContent>
      );
    }

    return (
      <PageContent ready={!loading} loadingMessages={['Shrimping down the mat...', 'Doing mat swims...', 'Pulling up gi pants...']}>
      <div className="j2-page-container" style={{ paddingTop: 64, paddingBottom: 104 }}>
        {styleBlock}

        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 52 }}>
          <div>
            <div className="j2-label-micro" style={{ marginBottom: 16 }}>{todayLabel}</div>
            <h1
              className="j2-serif-display j2-heading-glow"
              style={{ fontSize: 88, margin: 0, lineHeight: 1 }}
            >
              This week
            </h1>
            <div
              className="j2-serif-italic"
              style={{ marginTop: 14, fontSize: 22 }}
            >
              {streakSubtitle}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            {/* Adjust-focus chip is only shown once an intention exists. The
                no-intention state is handled by the dashed IntentionHeroCard
                below, which is far more inviting — keeping both visible was
                offering the same action twice with different wording. */}
            {intentionsEnabled && activeIntention && (
              <button
                onClick={() => setSetIntentOpen(true)}
                style={{
                  height: 50, padding: '0 22px',
                  background: 'var(--j2-surface-3)',
                  color: 'rgba(255,255,255,0.90)',
                  border: '1px solid var(--j2-border-2)',
                  borderRadius: 12,
                  fontWeight: 500, fontSize: 15,
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer',
                  transition: 'background 180ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--j2-surface-3)'; }}
              >
                ◇ Adjust focus
              </button>
            )}
            <button
              onClick={() => openLog()}
              style={{
                height: 54, padding: '0 28px',
                background: '#DA7422', color: '#fff',
                fontWeight: 600, borderRadius: 12,
                boxShadow: '0 0 0 1px rgba(218,116,34,0.3), 0 10px 24px -12px rgba(218,116,34,0.6)',
                transition: 'background 180ms ease, transform 180ms ease',
                display: 'inline-flex', alignItems: 'center', gap: 10,
                fontSize: 16,
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#E8823A'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#DA7422'; }}
            >
              + Log session
            </button>
          </div>
        </div>

        {!loading && allSessions.length === 0 ? (
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <FirstVisitCard onLogFirst={() => openLog()} />
          </div>
        ) : (
        <>

        {/* ── 4-stat strip ────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22, marginBottom: 44 }}>
          {([
            {
              label: 'Practice streak',
              value: streak > 0 ? `${streak}d` : '—',
              unit: longestStreak > 0 ? `best: ${longestStreak}d` : 'build the habit',
            },
            {
              label: 'This week',
              value: weekStats.totalMinutes > 0 ? formatDuration(weekStats.totalMinutes) : '0h',
              unit: `${weekStats.count} session${weekStats.count === 1 ? '' : 's'}`,
            },
            {
              label: 'Alignment',
              value: activeIntention ? `${alignmentPct}%` : '—',
              unit: activeIntention
                ? `${alignedCount} of ${weekStats.count} on focus`
                : 'set a focus to track',
            },
            {
              label: 'Consistent weeks',
              value: consistentWeeks > 0 ? String(consistentWeeks) : '—',
              unit: consistentWeeks >= 1 ? 'weeks without a break' : 'log a session to start',
              prestige: consistentWeeks >= 26,
            },
          ]).map((s, i) => (
            <div
              key={i}
              style={{
                padding: '28px 30px',
                background: 'var(--j2-surface-2)',
                border: s.prestige ? `1px solid ${PRESTIGE_TEAL_GLOW}` : '1px solid var(--j2-border-1)',
                borderRadius: 16,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: s.prestige ? `0 0 24px ${PRESTIGE_TEAL_GLOW}, inset 0 0 32px rgba(0,212,170,0.08)` : undefined,
                transition: 'box-shadow 400ms ease, border-color 400ms ease',
              }}
            >
              {s.prestige && (
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    background: `radial-gradient(ellipse 80% 90% at 50% 55%, ${PRESTIGE_TEAL_GLOW} 0%, rgba(0,212,170,0.14) 40%, transparent 78%)`,
                    animation: 'j2PrestigeBreathe 4.6s ease-in-out infinite',
                    mixBlendMode: 'screen',
                  }}
                />
              )}
              <div className="j2-label-micro" style={{ marginBottom: 14, position: 'relative' }}>{s.label}</div>
              <div
                style={{
                  fontSize: 52, fontFamily: FONT_EDITORIAL, fontWeight: 600,
                  color: s.prestige ? PRESTIGE_TEAL : PALE_YELLOW, lineHeight: 1.05,
                  textShadow: s.prestige ? `0 0 18px ${PRESTIGE_TEAL_GLOW}` : undefined,
                  position: 'relative',
                  transition: 'color 400ms ease, text-shadow 400ms ease',
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontSize: 13, color: 'rgba(255,255,255,0.40)',
                  marginTop: 8, letterSpacing: '0.1em', textTransform: 'uppercase',
                  position: 'relative',
                }}
              >
                {s.unit}
              </div>
            </div>
          ))}
        </div>

        {/* ── 2-col main ──────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 440px', gap: 40, alignItems: 'flex-start', marginBottom: 44 }}>

          {/* LEFT column ─────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0 }}>
            {/* Annual radial — hero */}
            <div style={{ ...heroCardStyle, padding: 40, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
                <div>
                  <div className="j2-label-copper">◈ The Path · {year}</div>
                  <div className="j2-serif-display" style={{ fontSize: 30, marginTop: 8 }}>
                    A year of training at a glance
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 28px' }}>
                <AnnualRadial
                  sessions={allSessions}
                  intentions={intentions}
                  year={year}
                  size={620}
                />
              </div>
              {/* Pillar legend */}
              <div
                style={{
                  display: 'flex', justifyContent: 'space-between', gap: 14,
                  paddingTop: 22, borderTop: '1px solid var(--j2-border-2)',
                }}
              >
                {SKILL_TAGS.map(tag => {
                  const count = allSessions.filter(s =>
                    new Date((typeof s.date === 'string' ? s.date : toDateString(new Date(s.date))) + 'T00:00:00').getFullYear() === year
                    && s.tags?.[0] === tag.value
                  ).length;
                  const color = SKILL_COLORS[tag.value]?.stroke ?? COPPER;
                  return (
                    <div key={tag.value} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          width: 14, height: 14, borderRadius: '50%',
                          background: color,
                          boxShadow: `0 0 12px ${color}80`,
                        }}
                      />
                      <div className="j2-label-micro" style={{ fontSize: 12 }}>{tag.label}</div>
                      <div style={{ fontSize: 19, color: PALE_YELLOW, fontFamily: FONT_EDITORIAL }}>{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Heatmap — moved here from the right sidebar so the full year
                of training reads at a glance alongside the annual radial. */}
            {heatmapSection}

            {telemetryContent}
          </div>

          {/* RIGHT sidebar ─────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>

            {/* Intention hero card */}
            {intentionsEnabled && (
              <IntentionHeroCard
                intention={activeIntention}
                weekSessionCount={weekStats.count}
                onSetIntent={() => setSetIntentOpen(true)}
                onEditIntent={activeIntention ? () => setEditIntention(activeIntention) : undefined}
                onViewJournal={activeIntention ? () => navigate(`/intentions/${activeIntention.id}/journal`) : undefined}
                onDeleteIntent={handleDeleteIntention}
              />
            )}

            {/* Most recent session */}
            {mostRecent && (
              <MostRecentSessionCard mostRecent={mostRecent} softCardStyle={softCardStyle} />
            )}

            {/* Last 30 days intensity */}
            <div style={{ ...softCardStyle, padding: 32 }}>
              <div className="j2-label-copper" style={{ marginBottom: 22 }}>◈ Last 30 days · intensity</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140 }}>
                {intensityDist.map((n, i) => {
                  const h = intensityMax ? (n / intensityMax) * 116 + 14 : 8;
                  const c = INT_COLORS[(i + 1) as 1 | 2 | 3 | 4 | 5];
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: '100%', height: h, background: c, borderRadius: 5,
                          boxShadow: `0 0 12px ${c}60`,
                        }}
                      />
                      <div
                        style={{
                          fontSize: 13, color: 'rgba(255,255,255,0.40)',
                          letterSpacing: '0.1em',
                        }}
                      >
                        {n}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 12, color: 'rgba(255,255,255,0.40)',
                  letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 8,
                }}
              >
                <span>Light</span><span>Moderate</span><span>High</span>
              </div>
            </div>

            {/* Week section — moved here from the left column.
                The carousel + list view both fit comfortably at 440px. */}
            <div style={{ ...softCardStyle, padding: 32 }}>
              {weekSectionHeader}
              <div style={{ marginTop: 16 }}>{weekViewContent}</div>
            </div>
          </div>
        </div>

        {/* ── Recent intentions row ───────────────────────────────── */}
        {recentIntentions.length > 0 && (
          <div style={{ ...softCardStyle, padding: 32, marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 22 }}>
              <div className="j2-label-copper">◈ Recent intentions</div>
              {intentionsEnabled && (
                <button
                  onClick={() => navigate('/intentions')}
                  style={{
                    fontSize: 14, fontWeight: 600,
                    color: COPPER, borderBottom: `1px solid ${COPPER}40`,
                    background: 'transparent', padding: 0, cursor: 'pointer',
                  }}
                >
                  See all →
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(6, recentIntentions.length)}, 1fr)`, gap: 16 }}>
              {recentIntentions.map(i => {
                const color = i.heading ? (SKILL_COLORS[i.heading]?.stroke ?? COPPER) : COPPER;
                const weekStart = new Date(i.week_start.slice(0, 10) + 'T00:00:00');
                const label = i.heading
                  ? (SKILL_TAGS.find(s => s.value === i.heading)?.label ?? i.heading)
                  : (i.intent_label ?? 'Focus');
                return (
                  <div
                    key={i.id}
                    style={{
                      padding: '20px 22px',
                      background: 'var(--j2-surface-2)',
                      border: '1px solid var(--j2-border-1)',
                      borderRadius: 14,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute', top: 0, right: 0, width: 84, height: 84,
                        background: `radial-gradient(circle at 100% 0%, ${color}30, transparent 70%)`,
                        pointerEvents: 'none',
                      }}
                    />
                    <div
                      style={{
                        fontSize: 12, color: 'rgba(255,255,255,0.40)',
                        letterSpacing: '0.14em', textTransform: 'uppercase',
                      }}
                    >
                      Wk of {MONTH_NAMES[weekStart.getMonth()]} {weekStart.getDate()}
                    </div>
                    <div
                      style={{
                        fontSize: 21, fontFamily: FONT_EDITORIAL, fontWeight: 600,
                        color: PALE_YELLOW, marginTop: 10,
                      }}
                    >
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        </>
        )}

        {modals}
        <RepRouletteFab onLogDrill={(preset) => {
          // Both preset shapes (drill | constraint) fold into the same
          // logPreset structure. Constraint presets carry constraintName +
          // sessionType='cla'; drill presets carry subSkillTag +
          // sessionType='drilling'. openLog routes desktop locally and
          // mobile through the global event listener in MobileAppShell.
          const presetData = preset.pool === 'drill'
            ? { heading: preset.heading, sessionType: preset.sessionType, subSkillTag: preset.subSkillTag }
            : { heading: preset.heading, sessionType: preset.sessionType, constraintName: preset.constraintName };
          openLog({ date: toDateString(today), preset: presetData });
        }} />
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
        longestStreak={longestStreak}
        weekSessionCount={weekStats.count}
        weekTotalMinutes={weekStats.totalMinutes}
        consistentWeeks={consistentWeeks}
        acwr={acwr}
        rustiest={rustiestPillar}
        spikiest={spikiest}
        onTap={() => setTelemetryOpen(prev => !prev)}
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
          weekSessionCount={weekStats.count}
          onSetIntent={() => setSetIntentOpen(true)}
          onEditIntent={activeIntention ? () => setEditIntention(activeIntention) : undefined}
          onViewJournal={activeIntention ? () => navigate(`/intentions/${activeIntention.id}/journal`) : undefined}
          onDeleteIntent={handleDeleteIntention}
        />
      )}

      {/* ── D-H. Main content (conditional on sessions) ────────── */}
      {!loading && allSessions.length === 0 ? (
        <FirstVisitCard onLogFirst={() => openLog()} />
      ) : (
      <>
        {weekSectionHeader}
        {weekViewContent}
        {primaryCta}
        {heatmapSection}
      </>
      )}

      {modals}
      <RepRouletteFab onLogDrill={(preset) => {
        const presetData = preset.pool === 'drill'
          ? { heading: preset.heading, sessionType: preset.sessionType, subSkillTag: preset.subSkillTag }
          : { heading: preset.heading, sessionType: preset.sessionType, constraintName: preset.constraintName };
        openLog({ date: toDateString(today), preset: presetData });
      }} />
    </div>
    </PageContent>
  );
}

// ── Most Recent Session card (desktop) ────────────────────────────────────
//
// Lives in its own component so the reveal timer fires on *card* mount, not
// page mount. (Page mount fires before data arrives, so the reveal silently
// elapsed before the card existed. Scoping fixes that.)
//
// Three-phase reveal:
//   Phase 'dot':    copper dot, glowing (brightness breathe, no scale change).
//   Phase 'line':   dot stretches rightward into a thin horizontal line.
//   Phase 'reveal': the line dissolves and the eyebrow text rises up from
//                   where the line was. Eyebrow reads "Focus:" or "Deep Work:"
//                   depending on whether the heading pillar carried the
//                   long-press deep_work flag.
//
// Both shape and text live inside a fixed-width slot so the surrounding
// layout doesn't lurch as the morph plays.
function MostRecentSessionCard({ mostRecent, softCardStyle }: {
  mostRecent: SessionSummary;
  softCardStyle: React.CSSProperties;
}) {
  type Phase = 'dot' | 'line' | 'reveal';
  const [phase, setPhase] = useState<Phase>('dot');

  useEffect(() => {
    if (typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setPhase('reveal');
      return;
    }
    const t1 = setTimeout(() => setPhase('line'),   1000);
    const t2 = setTimeout(() => setPhase('reveal'), 1450);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const dateStr = typeof mostRecent.date === 'string'
    ? mostRecent.date.slice(0, 10)
    : toDateString(new Date(mostRecent.date));
  const dateObj = new Date(dateStr + 'T00:00:00');
  const giLabel = mostRecent.gi_nogi === 'gi' ? 'Gi' : 'No-Gi';
  const typeLabel = SESSION_TYPE_LABELS[mostRecent.session_type] ?? mostRecent.session_type;
  // Prefer `heading` (mig 007 dynamic-pillar primary) over the older `tags[0]`.
  const headingPillar = (mostRecent.heading ?? mostRecent.tags?.[0]) as string | undefined;
  const focusLabel = headingPillar
    ? (SKILL_TAGS.find(s => s.value === headingPillar)?.label ?? headingPillar)
    : 'Free rolling';

  const isDeepWorkFocus = !!headingPillar
    && Array.isArray(mostRecent.deep_work_pillars)
    && (mostRecent.deep_work_pillars as string[]).includes(headingPillar);
  const eyebrowText = isDeepWorkFocus ? 'Deep Work:' : 'Focus:';

  // Slot dimensions — wide enough for "Deep Work:" plus a buffer.
  const SLOT_WIDTH = 118;
  const SHAPE_W = phase === 'dot' ? 14 : Math.max(SLOT_WIDTH - 12, 100);
  const SHAPE_H = phase === 'dot' ? 14 : 2;

  return (
    <div style={{ ...softCardStyle, padding: 32 }}>
      <div className="j2-label-copper" style={{ marginBottom: 16 }}>◈ Most recent session</div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10,
        minHeight: 42,
      }}>
        {/* Animated slot — dot → line → text emerges out of line via clip-path */}
        <div
          style={{
            position: 'relative',
            width: SLOT_WIDTH,
            height: 24,
            flexShrink: 0,
          }}
        >
          {/* The dot/line shape — fades out as the text unveils from its midline */}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              marginTop: -(SHAPE_H / 2),
              width: SHAPE_W,
              height: SHAPE_H,
              borderRadius: phase === 'dot' ? '50%' : 1,
              background: COPPER,
              boxShadow: phase === 'dot'
                ? `0 0 14px ${COPPER}DD, 0 0 30px ${COPPER}66`
                : `0 0 10px ${COPPER}88`,
              animation: phase === 'dot' ? 'j2DotGlow 2000ms ease-in-out infinite' : 'none',
              opacity: phase === 'reveal' ? 0 : 1,
              transition:
                'width 460ms cubic-bezier(0.65,0,0.35,1), ' +
                'height 320ms cubic-bezier(0.65,0,0.35,1), ' +
                'margin-top 320ms cubic-bezier(0.65,0,0.35,1), ' +
                'border-radius 320ms ease-out, ' +
                'box-shadow 460ms ease-out, ' +
                'opacity 380ms ease-out 100ms',
            }}
          />
          {/* Eyebrow — clipped to a 0-height horizontal slice at the line's vertical center
              until reveal, then the inset shrinks symmetrically to reveal the full letters.
              Effectively the line's strip *unfolds* into the text. */}
          <span
            className="j2-label-copper"
            style={{
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              clipPath: phase === 'reveal'
                ? 'inset(-2px 0 -2px 0)'
                : 'inset(50% 0 50% 0)',
              WebkitClipPath: phase === 'reveal'
                ? 'inset(-2px 0 -2px 0)'
                : 'inset(50% 0 50% 0)',
              transition:
                'clip-path 560ms cubic-bezier(0.16,1,0.3,1) 80ms, ' +
                '-webkit-clip-path 560ms cubic-bezier(0.16,1,0.3,1) 80ms',
              whiteSpace: 'nowrap',
            }}
          >
            {eyebrowText}
          </span>
        </div>
        <div className="j2-serif-display" style={{ fontSize: 30 }}>
          {focusLabel}
        </div>
      </div>
      <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.60)' }}>
        {formatDuration(mostRecent.duration ?? 0)} · {typeLabel} · {giLabel}
      </div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.40)', marginTop: 8 }}>
        {DAY_NAMES[dateObj.getDay()]}, {MONTH_NAMES[dateObj.getMonth()]} {dateObj.getDate()}
      </div>
    </div>
  );
}
