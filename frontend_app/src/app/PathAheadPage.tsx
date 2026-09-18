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
import { EIGHT_GATES } from '../lib/constants.ts';
import type { SessionSummary, Intention, SessionsResponse } from '../types/api.ts';
import { toast } from '../hooks/use-toast.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import { useActiveIntention } from '../context/ActiveIntentionContext.tsx';
import { isIntentionComplete, sessionTouchesHeading } from '../lib/analyticsUtils.ts';
import PathAheadModals from '../components/PathAheadModals.tsx';
import PathAheadMobile from '../components/PathAheadMobile.tsx';
import PathAheadDesktop from '../components/PathAheadDesktop.tsx';
import { toDateString, addDays } from '../lib/sessionUtils.ts';
import {
  findUnfinishedEntry,
  findMemoryEntry,
  buildRecentEntries,
  buildTechniqueCards,
  findRecentIntentions,
  intentionTechniques,
  portraitDistributions,
  sessionDateKey,
} from '../lib/homeViewModel.ts';
import { useUserTags } from '../hooks/useUserTags.ts';
import { computeStats } from '../components/TrainingHeatmap.tsx';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { useStamps } from '../hooks/useStamps.ts';
import SealRevealSheet from '../components/seal/SealRevealSheet.tsx';
import { STAMP_DIES } from '../lib/stampDies.ts';

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

  // NOTE: the week carousel/list toggle, its offset state, and the whole
  // operational spine (stat strip, telemetry, pulse sparkline, day rail,
  // partner + constraint rails) were removed on 2026-07-31 when desktop
  // adopted the table-of-contents home. Those surfaces live on Atlas and
  // Profile. Git history holds the prior dashboard.

  // Both shells host the log composer and listen for
  // `journada:open-log-form`, so this page owns no log-modal state — every
  // CTA just dispatches the event (see `openLog` below).
  const [setIntentOpen,       setSetIntentOpen]       = useState(false);
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

  // One opener for both viewports — the shell owns the modal.
  const openLog = useCallback((opts?: { date?: string }) => {
    const date = opts?.date ?? toDateString(new Date());
    window.dispatchEvent(new CustomEvent('journada:open-log-form', { detail: { date } }));
  }, []);

  const anyModalOpen = !!detailSession || setIntentOpen;
  useBodyScrollLock(anyModalOpen);

  const pendingSessions = usePendingSessions();
  const allSessions = useMemo(() => [...sessions, ...pendingSessions], [sessions, pendingSessions]);
  // Only `consistentWeeks` survives here, and only to trigger the Eight
  // Gates stamp — streak and longestStreak went with the desktop stat strip.
  // Home shows no streak on either viewport: the collection only grows.
  const { consistentWeeks } = useMemo(() => computeStats(allSessions, new Date().getFullYear()), [allSessions]);

  const totalSessions = allSessions.length;

  // NOTE: `tenure` and `lastSession` used to be computed here for the old
  // mobile masthead / "Still fresh" card. Both moved off home in the
  // table-of-contents redesign — tenure belongs to Profile, and the last
  // session now reaches the hero through `unfinishedEntry` / `memoryEntry`.

  // ── Home view-model (mobile "table of contents" layout) ────────────────
  // Home leads with writing, not numbers: the unfinished entry owns the hero
  // when one exists, otherwise a memory resurfaces; below it sit the last
  // three entries and the portrait. Derivations live in lib/homeViewModel.ts.

  const unfinishedEntry = useMemo(
    () => findUnfinishedEntry(allSessions, new Date()),
    [allSessions],
  );

  const memoryEntry = useMemo(
    () => findMemoryEntry(allSessions, new Date()),
    [allSessions],
  );

  // Desktop's margin column carries a second memory beside the hero's. Run
  // the same chain with the hero's entry removed so the two never quote the
  // same session back at the reader.
  const marginMemory = useMemo(
    () => (memoryEntry
      ? findMemoryEntry(allSessions.filter(s => s.id !== memoryEntry.session.id), new Date())
      : null),
    [allSessions, memoryEntry],
  );

  const recentEntries = useMemo(() => buildRecentEntries(allSessions), [allSessions]);

  const portraitShapes = useMemo(() => portraitDistributions(allSessions), [allSessions]);

  // Techniques the user has classified as theirs to work on, and the
  // intentions they've already run — both ride the hero deck so the things
  // they committed to stay reachable from home.
  const { tags: userTags } = useUserTags();

  const techniqueCards = useMemo(
    () => buildTechniqueCards(userTags, allSessions),
    [userTags, allSessions],
  );

  const techniquesForIntention = useCallback(
    (intention: Intention) => intentionTechniques(intention, userTags),
    [userTags],
  );

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

  // ── Eight Gates capstone → persisted prestige stamp ──────────────────────
  // At 26 consistent weeks the capstone folds into the stamp collection. The
  // strike is idempotent server-side (partial unique index), so we can POST on
  // every qualifying mount; the ref guards against StrictMode's double-invoke,
  // and we open the reveal sheet only on the first non-duplicate strike.
  const { stamps: earnedStamps, refetch: refetchStamps } = useStamps();
  const [gateReveal, setGateReveal] = useState<{ struckAt: string; count: number } | null>(null);
  const gateStruckRef = useRef(false);

  useEffect(() => {
    if (consistentWeeks < 26 || gateStruckRef.current) return;
    if (earnedStamps.has('eight_gates_26')) { gateStruckRef.current = true; return; }
    gateStruckRef.current = true;
    void (async () => {
      try {
        const data = await api.post<{ stamp?: { count: number; last_struck_at: string }; _offline?: boolean }>(
          '/api/stamps',
          { die_key: 'eight_gates_26', auto_earned: true },
        );
        if (data.stamp) {
          setGateReveal({ struckAt: data.stamp.last_struck_at, count: data.stamp.count });
          refetchStamps();
        }
      } catch {
        gateStruckRef.current = false; // allow a retry on a later mount
      }
    })();
  }, [consistentWeeks, earnedStamps, refetchStamps]);

  // ── Window computation ─────────────────────────────────────────────────

  const today = useMemo(() => new Date(), []);

  // Active intention: any intention whose calendar window contains today
  // AND, for non-'days' completion modes, that hasn't hit its target yet.
  // For 'days' mode, the calendar window IS the completion criterion.
  const todayStr = toDateString(today);
  const activeIntention = intentions.find(i => {
    const start = i.week_start.slice(0, 10);
    const end   = addDays(start, (i.duration_days ?? 7) - 1);
    if (todayStr < start || todayStr > end) return false;
    if (i.completion_type !== 'days' && isIntentionComplete(i, allSessions)) return false;
    return true;
  }) ?? null;

  // Sessions that have touched the intention since it was set — the anchor
  // sentence on home's intention card. Counted over the FULL session list
  // (not the three rows the entry list shows) and matched with the canonical
  // heading matcher, which reads pillar_distribution before legacy fields.
  const pastIntentions = useMemo(
    () => findRecentIntentions(intentions, activeIntention?.id ?? null, today),
    [intentions, activeIntention, today],
  );

  const intentionTouchedCount = useMemo(() => {
    if (!activeIntention) return 0;
    const start = activeIntention.week_start.slice(0, 10);
    const heading = activeIntention.heading;
    return allSessions.filter(s => {
      if (sessionDateKey(s) < start) return false;
      return heading ? sessionTouchesHeading(s, heading) : true;
    }).length;
  }, [activeIntention, allSessions]);

  const intentionStartStr = activeIntention ? activeIntention.week_start.slice(0, 10) : null;
  const intentionEndStr = intentionStartStr && activeIntention
    ? addDays(intentionStartStr, (activeIntention.duration_days ?? 7) - 1)
    : null;

  /** Whether a day falls inside the active intention's window — the detail
   *  modal shows the intention alongside an entry it covers. */
  const dayHasIntention = useCallback((dayStr: string) => (
    activeIntention !== null
    && intentionStartStr !== null && intentionEndStr !== null
    && dayStr >= intentionStartStr && dayStr <= intentionEndStr
  ), [activeIntention, intentionStartStr, intentionEndStr]);

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

  // NOTE: the seven-ring day rail was removed from home in the
  // table-of-contents redesign. Calendar owns dates; the entry list already
  // is the week, in words. Backfilling a past session happens via the date
  // stepper on the form or via Calendar.

  // ── Shared JSX fragments ────────────────────────────────────────────────

  const styleBlock = (
    <style>{`
      .j2-day-scroll { scrollbar-width: none; -webkit-overflow-scrolling: touch; }
      .j2-day-scroll::-webkit-scrollbar { display: none; }
    `}</style>
  );

  // Home list / hero → open the entry. Resolves the day from the session so
  // the detail modal can page through everything logged that day, and shows
  // the intention alongside when the day falls inside its window.
  const handleEntryTap = useCallback((session: SessionSummary) => {
    const dayStr = typeof session.date === 'string'
      ? session.date.slice(0, 10)
      : toDateString(new Date(session.date));
    const daySessions = sessionsByDate.get(dayStr) ?? [session];
    const idx = daySessions.findIndex(s => s.id === session.id);
    setDetailSessions(daySessions);
    setDetailSessionIndex(idx >= 0 ? idx : 0);
    setDetailDate(new Date(dayStr + 'T00:00:00'));
    setDetailIntention(dayHasIntention(dayStr) ? activeIntention : null);
  }, [sessionsByDate, dayHasIntention, activeIntention]);

  const modals = (
    <PathAheadModals
      fetchAll={fetchAll}
      refreshRailIntention={refreshRailIntention}
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
      setSetIntentOpen={setSetIntentOpen}
    />
  );

  // ── Render ─────────────────────────────────────────────────────────────

  const gateSheet = (
    <SealRevealSheet
      open={gateReveal != null}
      die={STAMP_DIES.eight_gates_26 ?? null}
      struckAt={gateReveal?.struckAt ?? null}
      count={gateReveal?.count ?? 0}
      autoEarned={true}
      onClose={() => setGateReveal(null)}
    />
  );

  if (isDesktop) {
    return (
      <>
      <PathAheadDesktop
        name={name}
        loading={loading}
        totalSessions={totalSessions}
        unfinishedEntry={unfinishedEntry}
        memoryEntry={memoryEntry}
        marginMemory={marginMemory}
        recentEntries={recentEntries}
        portraitShapes={portraitShapes}
        intentionsEnabled={intentionsEnabled}
        activeIntention={activeIntention}
        intentionTouchedCount={intentionTouchedCount}
        pastIntentions={pastIntentions}
        techniqueCards={techniqueCards}
        techniquesForIntention={techniquesForIntention}
        modals={modals}
        openLog={openLog}
        onEntryTap={handleEntryTap}
      />
      {gateSheet}
      </>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
     MOBILE LAYOUT — single-column stacked (the modernized phone UI)
     ═══════════════════════════════════════════════════════════════════════ */
  return (
    <>
    <PathAheadMobile
      loading={loading}
      totalSessions={totalSessions}
      unfinishedEntry={unfinishedEntry}
      memoryEntry={memoryEntry}
      recentEntries={recentEntries}
      portraitShapes={portraitShapes}
      intentionsEnabled={intentionsEnabled}
      activeIntention={activeIntention}
      intentionTouchedCount={intentionTouchedCount}
      pastIntentions={pastIntentions}
      techniqueCards={techniqueCards}
      techniquesForIntention={techniquesForIntention}
      modals={modals}
      styleBlock={styleBlock}
      openLog={openLog}
      onEntryTap={handleEntryTap}
    />
    {gateSheet}
    </>
  );
}

