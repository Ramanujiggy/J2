// IntentionsPage — orchestrator only. State, data fetching, and the
// shared statsMap memo live here; layout-specific JSX lives in
// IntentionsDesktopView and IntentionsMobileView.
//
// Refactored 2026-05-09 — see git history for the prior 1,816-line
// monolithic version.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import { useActiveIntention } from '../context/ActiveIntentionContext.tsx';
import { useSessions } from '../context/SessionsContext.tsx';
import { useCoachmark } from '../hooks/useCoachmark.ts';
import { toDateString, addDays } from '../lib/sessionUtils.ts';
import { topTagInRange, computeAlignment, tagHoursInRange, pickActiveIntention } from '../lib/analyticsUtils.ts';
import type { Intention, SessionSummary } from '../types/api.ts';
import { toast } from '../hooks/use-toast.ts';
import {
  type IntentionsLayout, type IntentionStats,
} from '../components/intentions/intentionsTypes.ts';
import IntentionsDesk from '../components/intentions/IntentionsDesk.tsx';
import IntentionsMobileView from '../components/intentions/IntentionsMobileView.tsx';
import SetIntentionModal from '../components/SetIntentionModal.tsx';

const LAYOUT_STORAGE_KEY = 'j2_intentions_layout';

export default function IntentionsPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { intentionsEnabled } = useProfile();
  const intentionsCoachmark = useCoachmark('intentions');
  // Intentions live in ActiveIntentionContext — single fetch shared with the
  // rail + every other page. Per the 2026-05-09 perf audit Tier 2.
  const { intentions, loading: intentionsLoading, refresh: refreshRailIntention } = useActiveIntention();
  // Sessions come from SessionsContext now (perf Tier 3 #8) — was an
  // independent /api/sessions fetch on this page.
  const { sessions, loading: sessionsLoading, refresh: fetchSessions } = useSessions();
  const [editTarget,  setEditTarget]  = useState<Intention | null>(null);
  const [createOpen,  setCreateOpen]  = useState(false);
  const loading = intentionsLoading || sessionsLoading;

  // Layout choice — shared between desktop and mobile so the user's preference
  // sticks if they resize across the breakpoint mid-session.
  const [layout, setLayout] = useState<IntentionsLayout>(() => {
    if (typeof window === 'undefined') return 'timeline';
    const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    return stored === 'eras' ? 'eras' : 'timeline';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
    }
  }, [layout]);

  // Per-intention stats — sessionCount, alignment %, and the hours fields that
  // back the era-level hours-weighted alignment. Computed once at the page
  // level so the timeline rows, era card stats + bar chart, and the mobile
  // branch all read from the same source.
  const statsMap = useMemo<Map<string, IntentionStats>>(() => {
    const m = new Map<string, IntentionStats>();
    for (const i of intentions) {
      const start = i.week_start.slice(0, 10);
      const endStr = addDays(start, (i.duration_days ?? 7) - 1);
      const inWindow = sessions.filter(s => {
        const d = (typeof s.date === 'string' ? s.date : toDateString(new Date(s.date))).slice(0, 10);
        return d >= start && d <= endStr;
      });
      const tagHours = tagHoursInRange(sessions, i.week_start, i.duration_days);
      const topTag = topTagInRange(sessions, i.week_start, i.duration_days);
      const alignment = computeAlignment(i, topTag, tagHours).score ?? 0;
      const totalHours = Object.values(tagHours).reduce((a, b) => a + b, 0);
      const matchHours = i.heading ? (tagHours[i.heading] ?? 0) : 0;
      m.set(i.id, { sessionCount: inWindow.length, alignment, matchHours, totalHours });
    }
    return m;
  }, [intentions, sessions]);

  const onOpenCreate    = useCallback(() => setCreateOpen(true), []);
  const onOpenEdit      = useCallback((i: Intention) => setEditTarget(i), []);
  const onCloseModal    = useCallback(() => { setCreateOpen(false); setEditTarget(null); }, []);
  // After a save: refresh intentions via context (which propagates to the
  // rail + this page), and refetch sessions to pick up any new ones.
  const onSaved         = useCallback(() => { void refreshRailIntention(); fetchSessions(); }, [fetchSessions, refreshRailIntention]);
  const onNavigate      = useCallback((path: string, opts?: { replace?: boolean }) => {
    navigate(path, opts);
  }, [navigate]);

  // Active = its calendar window contains today. Everything else that has
  // already started is an era that ran, newest first.
  const todayStr = toDateString(new Date());
  const activeIntention = useMemo(
    () => pickActiveIntention(intentions, todayStr, sessions),
    [intentions, todayStr, sessions],
  );

  const pastIntentions = useMemo(
    () => intentions
      .filter(i => i.id !== activeIntention?.id && i.week_start.slice(0, 10) <= todayStr)
      .sort((a, b) => b.week_start.localeCompare(a.week_start)),
    [intentions, activeIntention, todayStr],
  );

  if (isDesktop) {
    return (
      <>
        <IntentionsDesk
          intentions={intentions}
          sessions={sessions}
          activeIntention={activeIntention}
          pastIntentions={pastIntentions}
          onOpenSession={(s: SessionSummary) => navigate(`/journal/${s.id}`)}
          onOpenCreate={onOpenCreate}
          onOpenEdit={onOpenEdit}
          onSeePlus={() => toast({
            title: 'Plus isn’t open yet.',
            description: 'One active intention is free, and always will be. Writing, memories and seals are never gated.',
          })}
        />
        {(createOpen || editTarget) && (
          <SetIntentionModal
            editIntention={editTarget ?? undefined}
            onSaved={() => { onSaved(); onCloseModal(); }}
            onClose={onCloseModal}
          />
        )}
      </>
    );
  }

  return (
    <IntentionsMobileView
      intentions={intentions}
      sessions={sessions}
      loading={loading}
      intentionsEnabled={intentionsEnabled}
      editTarget={editTarget}
      createOpen={createOpen}
      layout={layout}
      onLayoutChange={setLayout}
      statsMap={statsMap}
      onOpenCreate={onOpenCreate}
      onOpenEdit={onOpenEdit}
      onCloseModal={onCloseModal}
      onSaved={onSaved}
      onNavigate={onNavigate}
      intentionsCoachmark={intentionsCoachmark}
    />
  );
}
