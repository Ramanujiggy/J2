// PathAheadPage — orchestrator only. State, data fetching, computations,
// and shared callbacks live here. Layout-specific JSX lives in
// PathAheadDesktop and PathAheadMobile; cross-cutting subtrees live in
// PathAheadWeekSection / PathAheadTelemetryCard / PathAheadModals.
//
// Refactored 2026-05-09 — see git history for the prior 1,300+ line
// monolithic version.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api, ApiError } from '../lib/api.ts';
import { useOnlineRefetch } from '../hooks/useOnlineRefetch.ts';
import { usePendingSessions } from '../hooks/usePendingSessions.ts';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.ts';
import { SKILL_TAGS, MONTH_NAMES, EIGHT_GATES } from '../lib/constants.ts';
import type { SessionSummary, Intention, SessionsResponse } from '../types/api.ts';
import { toast } from '../hooks/use-toast.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import { useActiveIntention } from '../context/ActiveIntentionContext.tsx';
import PulseSparklineWidget from '../components/PulseSparklineWidget.tsx';
import { computeACWR, computeDecay, rustiest, computeACWRByPillar, spikiestPillar } from '../lib/analyticsModels.ts';
import { sessionPillarHours } from '../lib/analyticsUtils.ts';
import PathAheadTelemetryCard from '../components/PathAheadTelemetryCard.tsx';
import PathAheadModals from '../components/PathAheadModals.tsx';
import PathAheadMobile from '../components/PathAheadMobile.tsx';
import PathAheadDesktop from '../components/PathAheadDesktop.tsx';
import { toDateString, addDays } from '../lib/sessionUtils.ts';
import { computeStats } from '../components/TrainingHeatmap.tsx';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';

// ── Types ──────────────────────────────────────────────────────────────────

interface DeleteResponse      { message: string }

// ── PathAheadPage ──────────────────────────────────────────────────────────

export default function PathAheadPage() {
  const { name, intentionsEnabled } = useProfile();
  // Intentions live in ActiveIntentionContext — single fetch shared with the
  // rail + every other page that consumes it. Per the 2026-05-09 perf audit
  // Tier 2: kills the duplicate /api/intentions GET that fired on every
  // navigation. Mutations call `refreshRailIntention()` to invalidate.
  const { intentions, refresh: refreshRailIntention } = useActiveIntention();
  const isDesktop = useIsDesktop();
  const [sessions,   setSessions]   = useState<SessionSummary[]>([]);
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
      const sessRes = await api.get<SessionsResponse>(`/api/sessions?from=${from}&to=${to}`);
      setSessions(sessRes.sessions ?? []);
      // Intentions come from ActiveIntentionContext (no local fetch needed).
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
          toast({ variant: 'success', title: gate.toast });
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

  // Mon–Sun of the current ISO week — used for weekStats (HomeHero always shows current week)
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
      // Context refresh re-fetches /api/intentions, which propagates to every
      // page that reads from useActiveIntention() (rail, IntentionsPage, etc).
      await refreshRailIntention();
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

  const telemetryContent = <PathAheadTelemetryCard windowStats={windowStats} />;

  // Tap handlers shared between desktop + mobile WeekSection. Centralises
  // the sessionsByDate / getIntentionInfo / activeIntention bookkeeping so
  // the section component itself stays presentation-only.
  const handleDayTap = useCallback((day: Date, sessions: SessionSummary[]) => {
    setDetailSessions(sessions);
    setDetailSessionIndex(0);
    setDetailDate(day);
    const dayStr = toDateString(day);
    const { dayHasIntention } = getIntentionInfo(dayStr);
    setDetailIntention(dayHasIntention ? activeIntention : null);
  }, [getIntentionInfo, activeIntention]);

  const handleSessionTap = useCallback(({ session, day, dayStr }: { session: SessionSummary; day: Date; dayStr: string }) => {
    const daySessions = sessionsByDate.get(dayStr) ?? [];
    const idx = daySessions.findIndex(s => s.id === session.id);
    const { dayHasIntention } = getIntentionInfo(dayStr);
    setDetailSessions(daySessions);
    setDetailSessionIndex(idx >= 0 ? idx : 0);
    setDetailDate(day);
    setDetailIntention(dayHasIntention ? activeIntention : null);
  }, [sessionsByDate, getIntentionInfo, activeIntention]);

  const handleLogTap = useCallback((date?: string) => {
    openLog(date ? { date } : undefined);
  }, [openLog]);

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

  // PulseSparklineWidget handles the sparse / empty case internally — it
  // renders the same invitational copy when fewer than 5 sessions exist in
  // the last 30 days, so no outer gate is needed here.
  const heatmapSection = <PulseSparklineWidget sessions={allSessions} />;

  const modals = (
    <PathAheadModals
      isDesktop={isDesktop}
      fetchAll={fetchAll}
      refreshRailIntention={refreshRailIntention}
      logOpen={logOpen}
      logDate={logDate}
      logPreset={logPreset}
      setLogOpen={setLogOpen}
      setLogDate={setLogDate}
      setLogPreset={setLogPreset}
      detailSession={detailSession}
      detailSessions={detailSessions}
      detailSessionIndex={detailSessionIndex}
      detailDate={detailDate}
      detailIntention={detailIntention}
      setDetailSessions={setDetailSessions}
      setDetailSessionIndex={setDetailSessionIndex}
      setDetailDate={setDetailDate}
      setDetailIntention={setDetailIntention}
      setIntentOpen={setIntentOpen}
      editIntention={editIntention}
      setSetIntentOpen={setSetIntentOpen}
      setEditIntention={setEditIntention}
    />
  );

  // ── Render ─────────────────────────────────────────────────────────────

  if (isDesktop) {
    return (
      <PathAheadDesktop
        name={name}
        intentionsEnabled={intentionsEnabled}
        loading={loading}
        streak={streak}
        longestStreak={longestStreak}
        weekStatsCount={weekStats.count}
        weekStatsTotalMinutes={weekStats.totalMinutes}
        consistentWeeks={consistentWeeks}
        activeIntention={activeIntention}
        allSessions={allSessions}
        weekOffset={weekOffset}
        weekLabel={weekLabel}
        weekView={weekView}
        onWeekOffsetChange={setWeekOffset}
        onWeekViewChange={handleWeekViewChange}
        displayWeekDays={displayWeekDays}
        today={today}
        sessionsByDate={sessionsByDate}
        weekSessionsList={weekSessionsList}
        onLogTap={handleLogTap}
        onDayTap={handleDayTap}
        onSessionTap={handleSessionTap}
        heatmapSection={heatmapSection}
        telemetryContent={telemetryContent}
        modals={modals}
        styleBlock={styleBlock}
        openLog={openLog}
        setSetIntentOpen={setSetIntentOpen}
        setEditIntention={setEditIntention}
        handleDeleteIntention={handleDeleteIntention}
      />
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
     MOBILE LAYOUT — single-column stacked (the modernized phone UI)
     ═══════════════════════════════════════════════════════════════════════ */
  return (
    <PathAheadMobile
      name={name}
      intentionsEnabled={intentionsEnabled}
      loading={loading}
      streak={streak}
      longestStreak={longestStreak}
      weekSessionCount={weekStats.count}
      weekTotalMinutes={weekStats.totalMinutes}
      consistentWeeks={consistentWeeks}
      acwr={acwr}
      rustiest={rustiestPillar}
      spikiest={spikiest}
      telemetryOpen={telemetryOpen}
      setTelemetryOpen={setTelemetryOpen}
      telemetryContent={telemetryContent}
      activeIntention={activeIntention}
      allSessions={allSessions}
      weekOffset={weekOffset}
      weekLabel={weekLabel}
      weekView={weekView}
      onWeekOffsetChange={setWeekOffset}
      onWeekViewChange={handleWeekViewChange}
      displayWeekDays={displayWeekDays}
      today={today}
      sessionsByDate={sessionsByDate}
      weekSessionsList={weekSessionsList}
      onLogTap={handleLogTap}
      onDayTap={handleDayTap}
      onSessionTap={handleSessionTap}
      primaryCta={primaryCta}
      heatmapSection={heatmapSection}
      modals={modals}
      styleBlock={styleBlock}
      openLog={openLog}
      setSetIntentOpen={setSetIntentOpen}
      setEditIntention={setEditIntention}
      handleDeleteIntention={handleDeleteIntention}
    />
  );
}

