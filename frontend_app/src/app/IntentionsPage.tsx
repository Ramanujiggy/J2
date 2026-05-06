import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { api } from '../lib/api.ts';
import {
  PALE_YELLOW, GLOW_SOFT, COPPER, CARD_BG, CARD_GLOW, CARD_GLOW_BORDER,
  SURFACE_2, SURFACE_3, FONT_EDITORIAL,
} from '../lib/theme.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { SKILL_TAGS, CATEGORY_COLORS, MONTH_NAMES } from '../lib/constants.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import { useActiveIntention } from '../context/ActiveIntentionContext.tsx';
import { toDateString, addDays, getWeekStart } from '../lib/sessionUtils.ts';
import type { Intention, Pillar, SessionSummary, IntentionsResponse, SessionsResponse } from '../types/api.ts';
import PageContent from '../components/PageContent.tsx';
import SetIntentionModal from '../components/SetIntentionModal.tsx';
import SessionDetailModal from '../components/SessionDetailModal.tsx';
import SegmentedToggle from '../components/SegmentedToggle.tsx';
import Coachmark from '../components/Coachmark.tsx';
import { useCoachmark } from '../hooks/useCoachmark.ts';
import { formatWeekShort, topTagInRange, computeAlignment, tagHoursInRange } from '../lib/analyticsUtils.ts';

// Focus dot/bar colors. These are the 5 colors from the desktop redesign
// handoff (`Journada (3).zip`, intentions_redesign), remapped to our actual
// pillar names. The handoff's "Escapes" vertex doesn't match our taxonomy —
// we have "Stand-up" instead, and assign it copper since copper was the
// 5th unused color in the handoff palette.
const FOCUS_COLORS: Record<Pillar, string> = {
  standup:     '#C4915F', // copper
  passing:     '#DA7422', // brand orange
  pins:        '#A8CB72', // light green (handoff "TopControl")
  submissions: '#52B56C', // green
  guard:       '#D4A040', // warm yellow
};

const PILLAR_LABEL: Record<Pillar, string> = {
  standup:     'Stand-up',
  passing:     'Passing',
  pins:        'Pins',
  submissions: 'Submissions',
  guard:       'Guard',
};

const ALL_PILLARS: Pillar[] = ['standup', 'passing', 'pins', 'submissions', 'guard'];

type IntentionsLayout = 'timeline' | 'eras';
type FocusFilter = 'All' | Pillar;

const LAYOUT_STORAGE_KEY = 'j2_intentions_layout';
const YEAR_STORAGE_KEY = 'j2_intentions_year';

// One slot in the single-year timeline. When filter='All' we render every ISO
// Monday in the selected year (capped at this-week for the current year), so
// gaps without an intention show up as muted "no focus set" rows. When a focus
// filter is active we drop the skeleton and only emit intention rows.
type TimelineRow =
  | { type: 'intention'; weekStart: string; intention: Intention }
  | { type: 'empty';     weekStart: string };

// Per-intention derived display data — computed once at the page level so
// timeline rows + era card stats + bar chart all read from the same source.
interface IntentionStats {
  sessionCount: number;       // # of sessions logged in the intention's date window
  alignment: number;          // 0–100, % of training hours matching intention.heading
  // Hours fields back the era-level hours-weighted alignment. Without them
  // EraStats would simple-average per-week scores, which overstates alignment
  // on uneven eras (1h@100% + 10h@50% would read 75% instead of the correct 55%).
  matchHours: number;         // hours trained on intention.heading in the window
  totalHours: number;         // total hours trained in the window (all pillars)
}

export default function IntentionsPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { intentionsEnabled } = useProfile();
  const intentionsCoachmark = useCoachmark('intentions');
  const { refresh: refreshRailIntention } = useActiveIntention();
  const [intentions,  setIntentions]  = useState<Intention[]>([]);
  const [sessions,    setSessions]    = useState<SessionSummary[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [editTarget,  setEditTarget]  = useState<Intention | null>(null);
  const [createOpen,  setCreateOpen]  = useState(false);

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

  const fetchAll = useCallback(async () => {
    try {
      const [intRes, sesRes] = await Promise.all([
        api.get<IntentionsResponse>('/api/intentions'),
        api.get<SessionsResponse>('/api/sessions'),
      ]);
      setIntentions(intRes.intentions ?? []);
      setSessions(sesRes.sessions ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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

  // ── Desktop layout ────────────────────────────────────────────────────

  if (isDesktop) {
    return (
      <>
        <DesktopIntentionsView
          intentions={intentions}
          sessions={sessions}
          loading={loading}
          intentionsEnabled={intentionsEnabled}
          editTarget={editTarget}
          createOpen={createOpen}
          layout={layout}
          onLayoutChange={setLayout}
          statsMap={statsMap}
          onOpenCreate={() => setCreateOpen(true)}
          onOpenEdit={setEditTarget}
          onCloseModal={() => { setCreateOpen(false); setEditTarget(null); }}
          onSaved={() => { fetchAll(); refreshRailIntention(); }}
          onNavigate={navigate}
        />
        <Coachmark
          open={intentionsCoachmark.isOpen}
          onDismiss={intentionsCoachmark.dismiss}
          eyebrow="◇ Intentions"
          title="Set what you're working on this week."
          body="We'll surface it on every session you log — and look back on whether you trained it."
        />
      </>
    );
  }

  // ── Mobile layout ─────────────────────────────────────────────────────

  // Eras for the mobile branch — newest-first runs of consecutive same-focus
  // weeks. No filtering on mobile (FilterBar is desktop-only).
  const mobileEras = computeEras(intentions);

  return (
    <PageContent ready={!loading} loadingMessages={['Loading your intentions...']}>
    <div className="mx-auto space-y-5 max-w-5xl px-4 sm:px-6 py-6">

      {/* Surface toggle — Entries (the journal page) ↔ Intentions (this
          page). Synced with the matching toggle on JournalIndexPage so
          users can swap views without round-tripping through the bottom
          nav. Mobile-only; desktop already shows both surfaces with full
          chrome. */}
      <SegmentedToggle<'entries' | 'intentions'>
        options={[
          { value: 'entries',    label: 'Entries' },
          { value: 'intentions', label: 'Intentions' },
        ]}
        value="intentions"
        onChange={(v) => { if (v === 'entries') navigate('/journal', { replace: true }); }}
      />

      {/* Header */}
      <div>
        <h2
          className="text-2xl font-display font-bold tracking-tight"
          style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}
        >
          Intentions
        </h2>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
          Your training focus over time
        </p>
      </div>

      {!intentionsEnabled && (
        <div
          className="rounded-xl px-4 py-2.5 text-sm"
          style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}
        >
          Intentions are currently disabled — viewing history only.
        </div>
      )}

      {/* Layout toggle — same Timeline ↔ Eras choice the desktop view offers.
          Hidden on the empty state since there's nothing to switch between. */}
      {intentions.length > 0 && (
        <SegmentedToggle<IntentionsLayout>
          options={[
            { value: 'timeline', label: 'Timeline' },
            { value: 'eras',     label: 'Eras' },
          ]}
          value={layout}
          onChange={v => v && setLayout(v)}
        />
      )}

      {intentions.length === 0 ? (
        /* ── Empty state ────────────────────────────────────── */
        <div
          className="rounded-xl px-6 py-10 text-center"
          style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>No intentions set yet.</p>
          <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.22)' }}>
            Declare what you're working on to track alignment.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="w-full max-w-xs mx-auto text-white font-semibold rounded-xl transition-all touch-manipulation"
            style={{
              height: 52,
              backgroundColor: '#DA7422',
              boxShadow: '0 2px 12px rgba(218,116,34,0.25)',
              fontSize: 16,
            }}
          >
            Set Your First Intention
          </button>
        </div>
      ) : layout === 'eras' ? (
        /* ── Eras layout (mobile) ───────────────────────────── */
        <div className="space-y-3">
          <p
            className="j2-serif-italic"
            style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)', fontStyle: 'italic', marginBottom: 4 }}
          >
            Consecutive weeks on the same focus form an{' '}
            <span style={{ color: COPPER }}>era</span>.
          </p>
          {mobileEras.map((era, idx) => (
            <EraCard
              key={`${era.firstWk}-${era.focus}-${idx}`}
              era={era}
              statsMap={statsMap}
              compact
              onOpen={() => navigate(`/intentions/${era.weeks[0]!.id}/journal`)}
            />
          ))}
        </div>
      ) : (
        /* ── Timeline cards (mobile) ────────────────────────── */
        <div className="space-y-3">
          {intentions.map(intention => {
            const headingLabel = intention.heading
              ? (SKILL_TAGS.find(s => s.value === intention.heading)?.label ?? intention.heading)
              : null;
            const topTag        = topTagInRange(sessions, intention.week_start, intention.duration_days);
            const ambient       = topTag?.label ?? null;
            const hours         = tagHoursInRange(sessions, intention.week_start, intention.duration_days);
            const alignment     = computeAlignment(intention, topTag, hours);
            const categoryColor = intention.intent_category
              ? (CATEGORY_COLORS[intention.intent_category] ?? 'rgba(255,255,255,0.4)')
              : null;
            const hasJournal    = !!intention.journal_entry;
            const journalSnippet = hasJournal
              ? intention.journal_entry!.slice(0, 40) + (intention.journal_entry!.length > 40 ? '...' : '')
              : null;

            return (
              <div
                key={intention.id}
                className="rounded-xl px-4 py-4 space-y-3"
                style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}
              >
                {/* Top row — week date + duration + edit */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.40)' }}>
                      {formatWeekShort(intention.week_start)}
                    </span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-lg font-medium"
                      style={{ backgroundColor: SURFACE_3, color: COPPER }}
                    >
                      {intention.duration_days}d
                    </span>
                    {categoryColor && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-lg font-medium capitalize"
                        style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}
                      >
                        {intention.intent_category}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setEditTarget(intention)}
                    className="p-1.5 rounded-lg transition-colors touch-manipulation"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                    title="Edit intention"
                  >
                    <Pencil size={13} />
                  </button>
                </div>

                {/* Heading + label */}
                <div>
                  <p className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.90)' }}>
                    {headingLabel ?? intention.intent_label}
                  </p>
                  {headingLabel && intention.intent_label && intention.intent_label.toLowerCase() !== (headingLabel ?? '').toLowerCase() && (
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>
                      {intention.intent_label}
                    </p>
                  )}
                </div>

                {/* Alignment row */}
                <div className="flex items-center gap-2">
                  {/* Alignment indicator bar */}
                  <div
                    className="rounded-full"
                    style={{
                      width: 32,
                      height: 4,
                      backgroundColor: alignment.status === 'aligned'  ? 'rgba(82,181,108,0.70)'
                                     : alignment.status === 'diverged' ? 'rgba(218,116,34,0.50)'
                                     : 'rgba(255,255,255,0.06)',
                    }}
                  />
                  {ambient ? (
                    <span className="text-xs font-medium" style={{ color: COPPER }}>
                      Trained: {ambient}
                    </span>
                  ) : (
                    <span className="text-xs italic" style={{ color: 'rgba(255,255,255,0.20)' }}>
                      No sessions logged
                    </span>
                  )}
                  {alignment.status !== 'no-data' && (
                    <span
                      className="text-[10px]"
                      style={{
                        color: alignment.status === 'aligned'
                          ? 'rgba(82,181,108,0.65)'
                          : 'rgba(218,116,34,0.50)',
                      }}
                    >
                      {alignment.score !== null ? `${alignment.score}%` : (alignment.status === 'aligned' ? 'Aligned' : 'Diverged')}
                    </span>
                  )}
                </div>

                {/* Journal row */}
                <button
                  onClick={() => navigate(`/intentions/${intention.id}/journal`)}
                  className="w-full flex items-center gap-2 pt-2 transition-colors touch-manipulation"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                >
                  {hasJournal ? (
                    <span className="text-xs truncate" style={{ color: 'rgba(242,228,168,0.45)' }}>
                      {journalSnippet}
                    </span>
                  ) : (
                    <span className="text-xs font-medium" style={{ color: COPPER }}>
                      + Write
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / create modal */}
      {(editTarget || createOpen) && (
        <SetIntentionModal
          editIntention={editTarget ?? undefined}
          onSaved={() => { fetchAll(); refreshRailIntention(); }}
          onClose={() => { setEditTarget(null); setCreateOpen(false); }}
        />
      )}

      <Coachmark
        open={intentionsCoachmark.isOpen}
        onDismiss={intentionsCoachmark.dismiss}
        eyebrow="◇ Intentions"
        title="Set what you're working on this week."
        body="We'll surface it on every session you log — and look back on whether you trained it."
      />
    </div>
    </PageContent>
  );
}

// ── Desktop editorial layout ──────────────────────────────────────────────

interface DesktopViewProps {
  intentions: Intention[];
  sessions: SessionSummary[];
  loading: boolean;
  intentionsEnabled: boolean;
  editTarget: Intention | null;
  createOpen: boolean;
  layout: IntentionsLayout;
  onLayoutChange: (next: IntentionsLayout) => void;
  statsMap: Map<string, IntentionStats>;
  onOpenCreate: () => void;
  onOpenEdit: (intention: Intention) => void;
  onCloseModal: () => void;
  onSaved: () => void;
  onNavigate: (path: string) => void;
}

function DesktopIntentionsView({
  intentions, sessions, loading, intentionsEnabled,
  editTarget, createOpen,
  layout, onLayoutChange, statsMap,
  onOpenCreate, onCloseModal, onSaved, onNavigate,
  // onOpenEdit is part of the prop contract for parity with the mobile view
  // but the redesigned desktop layout doesn't surface inline edit affordances —
  // the "Adjust focus" CTA edits the active intention; past weeks are read-only
  // from the timeline. Reintroduce a row-level edit button if/when product asks.
}: DesktopViewProps) {
  const todayStr = toDateString(new Date());

  // Filter state lives here (desktop-only feature). Layout + statsMap are
  // owned by IntentionsPage so the mobile branch can share them.
  const [filter, setFilter] = useState<FocusFilter>('All');

  // Year selection — single-year-at-a-time view. Persisted across reloads so
  // navigating into a session and back restores the year you were browsing.
  const [selectedYear, setSelectedYear] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(YEAR_STORAGE_KEY) ?? '';
  });
  useEffect(() => {
    if (typeof window !== 'undefined' && selectedYear) {
      window.localStorage.setItem(YEAR_STORAGE_KEY, selectedYear);
    }
  }, [selectedYear]);

  // SessionDetailModal state — clicking a row/era opens a session.
  const [openSession, setOpenSession] = useState<SessionSummary | null>(null);

  const activeIntention = useMemo(() => {
    return intentions.find(i => {
      const start = i.week_start.slice(0, 10);
      const end = addDays(start, (i.duration_days ?? 7) - 1);
      return todayStr >= start && todayStr <= end;
    }) ?? null;
  }, [intentions, todayStr]);

  // Years that contain at least one intention. Counts are pre-filter so the
  // tabs don't shrink/grow as you flip focus chips — they reflect raw history.
  const availableYears = useMemo(() => {
    const m = new Map<string, number>();
    intentions.forEach(i => {
      const y = i.week_start.slice(0, 4);
      m.set(y, (m.get(y) ?? 0) + 1);
    });
    return Array.from(m.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year.localeCompare(a.year));
  }, [intentions]);

  // Default to the most recent year with data if no selection (or if the
  // persisted year no longer has any intentions — e.g., after a reset).
  const effectiveYear = useMemo(() => {
    if (selectedYear && availableYears.some(y => y.year === selectedYear)) return selectedYear;
    return availableYears[0]?.year ?? '';
  }, [selectedYear, availableYears]);

  // Filter by focus heading. 'All' passes everything; anything else passes
  // intentions whose heading matches. Null-heading intentions only show under 'All'.
  const filtered = useMemo(() => {
    if (filter === 'All') return intentions;
    return intentions.filter(i => i.heading === filter);
  }, [intentions, filter]);

  // Year + focus scoped intentions, newest first.
  const yearScoped = useMemo(() => {
    if (!effectiveYear) return [];
    return filtered
      .filter(i => i.week_start.slice(0, 4) === effectiveYear)
      .sort((a, b) => b.week_start.localeCompare(a.week_start));
  }, [filtered, effectiveYear]);

  // Session counts keyed by ISO Monday — used to surface "you trained this week
  // but didn't set a focus" on empty rows.
  const sessionsByWeek = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) {
      const dStr = (typeof s.date === 'string' ? s.date : toDateString(new Date(s.date))).slice(0, 10);
      const wk = getWeekStart(new Date(dStr + 'T00:00:00'));
      m.set(wk, (m.get(wk) ?? 0) + 1);
    }
    return m;
  }, [sessions]);

  // Build the timeline rows for the selected year. With filter='All' we emit
  // every ISO Monday so missing weeks render as "no focus set". With a focus
  // filter active we just emit the matching intentions — padding wouldn't
  // mean anything since most weeks weren't that focus to begin with.
  const timelineRows = useMemo<TimelineRow[]>(() => {
    if (!effectiveYear) return [];
    if (filter !== 'All') {
      return yearScoped.map(i => ({
        type: 'intention',
        weekStart: i.week_start.slice(0, 10),
        intention: i,
      }));
    }
    // Generate ISO Mondays whose date falls in `effectiveYear`.
    const year = parseInt(effectiveYear, 10);
    const jan1 = new Date(year, 0, 1);
    const dow = jan1.getDay(); // 0=Sun … 6=Sat
    const firstMonOffset = dow === 1 ? 0 : (dow === 0 ? 1 : 8 - dow);
    const mondays: string[] = [];
    const cursor = new Date(year, 0, 1 + firstMonOffset);
    while (cursor.getFullYear() === year) {
      mondays.push(toDateString(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }
    // Cap the current year at this week's Monday so we don't render empty
    // future rows. Past years render the full 52/53 weeks.
    const today = new Date();
    if (effectiveYear === String(today.getFullYear())) {
      const currentMon = getWeekStart(today);
      const cutoffIdx = mondays.findIndex(m => m > currentMon);
      if (cutoffIdx !== -1) mondays.length = cutoffIdx;
    }
    // Match each Monday to an intention whose week_start lands inside that
    // 7-day window. Off-Monday intentions still get bucketed correctly.
    const rows: TimelineRow[] = mondays.map(monday => {
      const weekEnd = addDays(monday, 7); // Monday + 6 days = Sunday
      const matched = yearScoped.find(i => {
        const s = i.week_start.slice(0, 10);
        return s >= monday && s <= weekEnd;
      });
      return matched
        ? { type: 'intention' as const, weekStart: matched.week_start.slice(0, 10), intention: matched }
        : { type: 'empty' as const, weekStart: monday };
    });
    return rows.reverse(); // newest first
  }, [filter, yearScoped, effectiveYear]);

  // Era grouping: newest-first walk over the year-scoped set; consecutive
  // same-heading weeks collapse into a run. Two intentions are "consecutive"
  // if their week_start dates differ by exactly the older one's duration.
  const eras = useMemo(() => computeEras(yearScoped), [yearScoped]);

  // Click-through handler shared by Timeline rows + Era cards.
  // Timeline → first session of week (chronologically earliest).
  // Eras → last session across the era's weeks (most recent).
  const sessionsForIntention = useCallback((intention: Intention): SessionSummary[] => {
    const start = intention.week_start.slice(0, 10);
    const end = addDays(start, (intention.duration_days ?? 7) - 1);
    return sessions
      .filter(s => {
        const d = (typeof s.date === 'string' ? s.date : toDateString(new Date(s.date))).slice(0, 10);
        return d >= start && d <= end;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sessions]);

  const onOpenWeekSessions = useCallback((intention: Intention, mode: 'first' | 'last') => {
    const inWeek = sessionsForIntention(intention);
    if (inWeek.length === 0) {
      // No sessions to open — fall back to opening the journal entry.
      onNavigate(`/intentions/${intention.id}/journal`);
      return;
    }
    setOpenSession(mode === 'first' ? inWeek[0]! : inWeek[inWeek.length - 1]!);
  }, [sessionsForIntention, onNavigate]);

  const onOpenEraSessions = useCallback((era: Era) => {
    const all: SessionSummary[] = [];
    for (const i of era.weeks) all.push(...sessionsForIntention(i));
    if (all.length === 0) {
      // Fall back to journal of the era's most-recent week (first in era.weeks)
      onNavigate(`/intentions/${era.weeks[0]!.id}/journal`);
      return;
    }
    all.sort((a, b) => a.date.localeCompare(b.date));
    setOpenSession(all[all.length - 1]!);
  }, [sessionsForIntention, onNavigate]);

  // Subtitle reflects the selected year. With 'All' filter we surface the
  // "set vs. elapsed" ratio so missing weeks register as missing. With a focus
  // filter we drop the ratio (denominator stops being meaningful).
  const subtitle = useMemo(() => {
    if (intentions.length === 0) return 'No intentions yet.';
    if (!effectiveYear) return '';
    if (filter === 'All') {
      const intentioned = timelineRows.filter(r => r.type === 'intention').length;
      const total = timelineRows.length;
      return `${intentioned} of ${total} ${total === 1 ? 'week' : 'weeks'} set in ${effectiveYear}.`;
    }
    const n = timelineRows.length;
    return `${n} ${n === 1 ? 'week' : 'weeks'} of ${PILLAR_LABEL[filter as Pillar]} in ${effectiveYear}.`;
  }, [intentions.length, effectiveYear, filter, timelineRows]);

  return (
    <PageContent ready={!loading} loadingMessages={['Loading your intentions...']}>
    {/* Shared desktop container — see .j2-page-container in index.css.
        Replaces the prior breakpoint cascade (1152/1280/1520) with a single
        fluid cap at 1760 so the page rhythm matches every other desktop view. */}
    <div className="j2-page-container" style={{ paddingTop: 40, paddingBottom: 104 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, gap: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div className="j2-label-micro" style={{ marginBottom: 10 }}>Intentions</div>
          <h1
            className="j2-serif-display j2-heading-glow"
            style={{ fontSize: 48, margin: 0, lineHeight: 1.05, letterSpacing: '-0.015em' }}
          >
            Every week,{' '}
            <span className="j2-serif-italic" style={{ color: COPPER }}>
              what you chose to work on.
            </span>
          </h1>
          <div
            className="j2-serif-italic"
            style={{ marginTop: 10, fontSize: 16, color: 'rgba(255,255,255,0.60)' }}
          >
            {subtitle}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <SegmentedToggle<IntentionsLayout>
            options={[
              { value: 'timeline', label: 'Timeline' },
              { value: 'eras',     label: 'Eras' },
            ]}
            value={layout}
            onChange={v => v && onLayoutChange(v)}
          />
          {intentionsEnabled && (
            <button
              onClick={onOpenCreate}
              style={{
                height: 42, padding: '0 20px',
                background: '#DA7422', color: '#fff',
                fontWeight: 600, borderRadius: 10,
                boxShadow: '0 0 0 1px rgba(218,116,34,0.30), 0 10px 24px -12px rgba(218,116,34,0.60)',
                transition: 'background 180ms ease',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontSize: 14, cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#E8823A'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#DA7422'; }}
            >
              ◇ {activeIntention ? 'Adjust focus' : "Set this week's focus"}
            </button>
          )}
        </div>
      </div>

      {!intentionsEnabled && (
        <div
          style={{
            background: 'var(--j2-surface-2)',
            border: '1px solid var(--j2-border-1)',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 14,
            color: 'rgba(255,255,255,0.40)',
            marginBottom: 24,
          }}
        >
          Intentions are currently disabled — viewing history only.
        </div>
      )}

      {intentions.length === 0 ? (
        <DesktopEmpty onStart={() => onNavigate('/home')} />
      ) : (
        <>
          {/* Year + focus controls — stacked. Year scopes the entire view to a
              single year (52 weeks max) so the page stays a predictable size
              and you always know which year you're looking at. */}
          <YearTabs
            years={availableYears}
            value={effectiveYear}
            onChange={setSelectedYear}
          />
          <FilterBar value={filter} onChange={setFilter} />

          {/* Body — layout variant */}
          {layout === 'timeline' ? (
            timelineRows.length === 0 ? (
              filter !== 'All'
                ? <EmptyFilteredState filter={filter as Pillar} />
                : <EmptyYearState year={effectiveYear} />
            ) : (
              <IntentionsTimeline
                rows={timelineRows}
                statsMap={statsMap}
                sessionsByWeek={sessionsByWeek}
                onOpen={i => onOpenWeekSessions(i, 'first')}
              />
            )
          ) : (
            eras.length === 0 ? (
              filter !== 'All'
                ? <EmptyFilteredState filter={filter as Pillar} />
                : <EmptyYearState year={effectiveYear} />
            ) : (
              <IntentionsEras
                eras={eras}
                statsMap={statsMap}
                onOpen={onOpenEraSessions}
              />
            )
          )}
        </>
      )}

      {/* Modals */}
      {(createOpen || editTarget) && (
        <SetIntentionModal
          editIntention={editTarget ?? undefined}
          onSaved={() => { onSaved(); onCloseModal(); }}
          onClose={onCloseModal}
        />
      )}
      {openSession && (
        <SessionDetailModal
          session={openSession}
          date={new Date(openSession.date.slice(0, 10) + 'T00:00:00')}
          onClose={() => setOpenSession(null)}
          onSaved={() => { onSaved(); setOpenSession(null); }}
          onDeleted={() => { onSaved(); setOpenSession(null); }}
        />
      )}
    </div>
    </PageContent>
  );
}

// ── Filter chip bar ──────────────────────────────────────────────────────

function FilterBar({ value, onChange }: { value: FocusFilter; onChange: (v: FocusFilter) => void }) {
  const chip = (label: string, isActive: boolean, onClick: () => void, dotColor?: string) => (
    <button
      key={label}
      onClick={onClick}
      role="tab"
      aria-selected={isActive}
      style={{
        height: 30,
        padding: '0 14px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 16,
        backgroundColor: isActive ? 'rgba(196,145,95,0.16)' : SURFACE_2,
        border: `1px solid ${isActive ? COPPER : 'rgba(255,255,255,0.10)'}`,
        color: isActive ? PALE_YELLOW : 'rgba(255,255,255,0.60)',
        cursor: 'pointer',
        transition: 'all 160ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {dotColor && (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: dotColor,
            boxShadow: `0 0 6px ${dotColor}80`,
          }}
        />
      )}
      {label}
    </button>
  );

  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 0 22px',
        marginBottom: 24,
        borderBottom: '1px solid rgba(255,255,255,0.10)',
        flexWrap: 'wrap',
      }}
    >
      <div className="j2-label-micro" style={{ marginRight: 6 }}>Filter</div>
      {chip('All', value === 'All', () => onChange('All'))}
      {ALL_PILLARS.map(p =>
        chip(PILLAR_LABEL[p], value === p, () => onChange(p), FOCUS_COLORS[p]),
      )}
    </div>
  );
}

// ── Empty state when filter yields zero results ───────────────────────────

function EmptyFilteredState({ filter }: { filter: Pillar }) {
  return (
    <div
      style={{
        padding: '60px 20px',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.40)',
        border: '1px dashed rgba(255,255,255,0.10)',
        borderRadius: 16,
      }}
    >
      <div
        className="j2-serif-italic"
        style={{ fontSize: 18, color: 'rgba(255,255,255,0.60)', marginBottom: 8 }}
      >
        No weeks of {PILLAR_LABEL[filter]} yet.
      </div>
      <div style={{ fontSize: 13 }}>Try another category.</div>
    </div>
  );
}

// ── Layout 1: Editorial Timeline ─────────────────────────────────────────

interface IntentionsTimelineProps {
  rows: TimelineRow[];
  statsMap: Map<string, IntentionStats>;
  sessionsByWeek: Map<string, number>;
  onOpen: (i: Intention) => void;
}

function IntentionsTimeline({ rows, statsMap, sessionsByWeek, onOpen }: IntentionsTimelineProps) {
  // Dominant focus across the rendered (year-scoped) rows — the small "Mostly"
  // marker that used to hang off the year header. Lives at the top of the
  // timeline now since the year header itself is gone (year is in the tabs).
  const dominant = (() => {
    const counts: Partial<Record<Pillar, number>> = {};
    for (const r of rows) {
      if (r.type !== 'intention') continue;
      const h = r.intention.heading;
      if (h && (ALL_PILLARS as string[]).includes(h)) {
        const k = h as Pillar;
        counts[k] = (counts[k] ?? 0) + 1;
      }
    }
    const top = (Object.entries(counts) as [Pillar, number][])
      .sort((a, b) => b[1] - a[1])[0];
    return top?.[0] ?? null;
  })();

  return (
    <div>
      {dominant && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 8,
            paddingBottom: 12,
            fontSize: 12,
            color: 'rgba(255,255,255,0.40)',
            fontStyle: 'italic',
            fontFamily: FONT_EDITORIAL,
          }}
        >
          <span>Mostly</span>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: FOCUS_COLORS[dominant],
            }}
          />
          <span style={{ color: PALE_YELLOW }}>{PILLAR_LABEL[dominant]}</span>
        </div>
      )}
      <div>
        {rows.map(row =>
          row.type === 'intention' ? (
            <IntentionRow
              key={row.intention.id}
              intention={row.intention}
              stats={statsMap.get(row.intention.id) ?? { sessionCount: 0, alignment: 0, matchHours: 0, totalHours: 0 }}
              onOpen={() => onOpen(row.intention)}
            />
          ) : (
            <EmptyWeekRow
              key={`empty-${row.weekStart}`}
              weekStart={row.weekStart}
              sessionCount={sessionsByWeek.get(row.weekStart) ?? 0}
            />
          ),
        )}
      </div>
    </div>
  );
}

// Empty-week placeholder row in the 52-week timeline. Keeps the same grid as
// IntentionRow so columns line up; everything is muted to read as absence
// without competing visually with set weeks.
function EmptyWeekRow({ weekStart, sessionCount }: { weekStart: string; sessionCount: number }) {
  const d = new Date(weekStart + 'T00:00:00');
  const monthDay = `WK ${MONTH_NAMES[d.getMonth()]!.toUpperCase()} ${d.getDate()}`;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '88px 14px 1fr 90px 240px 80px',
        gap: 18,
        alignItems: 'center',
        padding: '14px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.30)',
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {monthDay}
      </div>
      {/* Hollow dash where the focus dot would be */}
      <div style={{ width: 10, height: 1, background: 'rgba(255,255,255,0.15)' }} />
      <div
        className="j2-serif-italic"
        style={{
          fontSize: 20,
          fontStyle: 'italic',
          color: 'rgba(255,255,255,0.30)',
          lineHeight: 1.1,
        }}
      >
        No focus set
      </div>
      <div
        style={{
          fontSize: 12,
          color: sessionCount > 0 ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.20)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {sessionCount === 0 ? '—' : `${sessionCount} ${sessionCount === 1 ? 'session' : 'sessions'}`}
      </div>
      <div />
      <div />
    </div>
  );
}

// Year picker — chip row mirroring FilterBar styling so the two stack cleanly.
function YearTabs({
  years,
  value,
  onChange,
}: {
  years: { year: string; count: number }[];
  value: string;
  onChange: (year: string) => void;
}) {
  if (years.length === 0) return null;
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        paddingTop: 6,
        paddingBottom: 14,
        flexWrap: 'wrap',
      }}
    >
      <div className="j2-label-micro" style={{ marginRight: 6 }}>Year</div>
      {years.map(({ year, count }) => {
        const active = year === value;
        return (
          <button
            key={year}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(year)}
            style={{
              height: 32,
              padding: '0 14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 16,
              backgroundColor: active ? 'rgba(196,145,95,0.16)' : SURFACE_2,
              border: `1px solid ${active ? COPPER : 'rgba(255,255,255,0.10)'}`,
              color: active ? PALE_YELLOW : 'rgba(255,255,255,0.70)',
              cursor: 'pointer',
              transition: 'all 160ms ease',
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {year}
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: active ? COPPER : 'rgba(255,255,255,0.40)',
              }}
            >
              {count}w
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Empty state when the selected year has zero intentions (e.g., no data was
// recorded that year). Distinct from the global empty state, which only fires
// when there are no intentions at all.
function EmptyYearState({ year }: { year: string }) {
  return (
    <div
      style={{
        padding: '60px 20px',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.40)',
        border: '1px dashed rgba(255,255,255,0.10)',
        borderRadius: 16,
      }}
    >
      <div
        className="j2-serif-italic"
        style={{ fontSize: 18, color: 'rgba(255,255,255,0.60)', marginBottom: 8 }}
      >
        No intentions in {year || 'this year'}.
      </div>
      <div style={{ fontSize: 13 }}>Pick another year above.</div>
    </div>
  );
}

function IntentionRow({
  intention,
  stats,
  onOpen,
}: {
  intention: Intention;
  stats: IntentionStats;
  onOpen: () => void;
}) {
  const heading = intention.heading as Pillar | null;
  const color = heading ? FOCUS_COLORS[heading] : 'rgba(255,255,255,0.30)';
  const focusName = heading ? PILLAR_LABEL[heading] : (intention.intent_label || 'No focus');

  // Date "WK NOV 17" — format from week_start
  const start = intention.week_start.slice(0, 10);
  const d = new Date(start + 'T00:00:00');
  const monthDay = `WK ${MONTH_NAMES[d.getMonth()]!.toUpperCase()} ${d.getDate()}`;
  const fullDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });

  // Hover state (CSS-only via inline JS hover for the simple bg + arrow color)
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '88px 14px 1fr 90px 240px 80px',
        gap: 18,
        alignItems: 'center',
        padding: '16px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        backgroundColor: hovered ? 'rgba(255,255,255,0.02)' : 'transparent',
        transition: 'background-color 160ms ease',
      }}
    >
      {/* Date */}
      <div
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {monthDay}
      </div>

      {/* Vertex dot */}
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: color,
          boxShadow: heading ? `0 0 8px ${color}80` : 'none',
        }}
      />

      {/* Focus name */}
      <div
        className="j2-serif-display"
        style={{ fontSize: 26, fontWeight: 500, color: PALE_YELLOW, lineHeight: 1.1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {focusName}
      </div>

      {/* Session count */}
      <div
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.65)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {stats.sessionCount} {stats.sessionCount === 1 ? 'session' : 'sessions'}
      </div>

      {/* Alignment bar — real % from statsMap */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            flex: 1,
            height: 3,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${stats.alignment}%`,
              height: '100%',
              background: color,
              borderRadius: 2,
              boxShadow: stats.alignment > 0 ? `0 0 6px ${color}80` : 'none',
              transition: 'width 240ms ease',
            }}
          />
        </div>
        <span
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.50)',
            fontVariantNumeric: 'tabular-nums',
            minWidth: 36,
            textAlign: 'right',
          }}
        >
          {stats.alignment}%
        </span>
      </div>

      {/* Action */}
      <button
        onClick={onOpen}
        title={fullDate}
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: hovered ? COPPER : 'rgba(255,255,255,0.45)',
          textAlign: 'right',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          transition: 'color 160ms ease',
        }}
      >
        Open →
      </button>
    </div>
  );
}

// ── Layout 2: Eras ───────────────────────────────────────────────────────

interface Era {
  focus: Pillar;
  weeks: Intention[];     // newest-first within the era
  firstWk: string;        // newest week_start (chronologically latest)
  lastWk: string;         // oldest week_start (chronologically earliest)
}

// Walk newest-first; group consecutive same-heading weeks where the older
// week_start is exactly one duration before the run's current oldest week.
function computeEras(intentions: Intention[]): Era[] {
  if (intentions.length === 0) return [];
  // Sort newest-first
  const ordered = [...intentions].sort((a, b) => b.week_start.localeCompare(a.week_start));
  const out: Era[] = [];
  let run: Era | null = null;

  for (const i of ordered) {
    const heading = i.heading as Pillar | null;
    if (!heading || !(ALL_PILLARS as string[]).includes(heading)) {
      // Skip headless intentions — they don't belong in an era.
      if (run) { out.push(run); run = null; }
      continue;
    }
    if (run && run.focus === heading) {
      // Two intentions are "consecutive" if the older one's week_start +
      // its duration === the run's current oldest week_start.
      const oldestStart = run.lastWk;
      const candidateExpectedNext = addDays(i.week_start.slice(0, 10), i.duration_days ?? 7);
      if (candidateExpectedNext === oldestStart) {
        run.weeks.push(i);
        run.lastWk = i.week_start.slice(0, 10);
        continue;
      }
    }
    // Start a new run
    if (run) out.push(run);
    run = {
      focus: heading,
      weeks: [i],
      firstWk: i.week_start.slice(0, 10),
      lastWk: i.week_start.slice(0, 10),
    };
  }
  if (run) out.push(run);
  return out;
}

function IntentionsEras({ eras, statsMap, onOpen }: { eras: Era[]; statsMap: Map<string, IntentionStats>; onOpen: (e: Era) => void }) {
  return (
    <div>
      <div
        className="j2-serif-italic"
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.60)',
          marginBottom: 24,
          fontStyle: 'italic',
        }}
      >
        Consecutive weeks on the same focus form an{' '}
        <span style={{ color: COPPER }}>era</span>. Each era is a chapter of your training.
      </div>
      {eras.map((era, idx) => (
        <EraCard
          key={`${era.firstWk}-${era.focus}-${idx}`}
          era={era}
          statsMap={statsMap}
          onOpen={() => onOpen(era)}
        />
      ))}
    </div>
  );
}

function EraCard({
  era, statsMap, onOpen, compact = false,
}: {
  era: Era;
  statsMap: Map<string, IntentionStats>;
  onOpen: () => void;
  /** Mobile-stacked layout. Defaults to false (desktop 3-column grid). */
  compact?: boolean;
}) {
  const color = FOCUS_COLORS[era.focus];
  const weeksCount = era.weeks.length;

  // Date range — first wk is newest, last wk is oldest (per `computeEras`).
  // For display, show oldest → newest left-to-right.
  const startDate = new Date(era.lastWk + 'T00:00:00');
  const endDate = new Date(era.firstWk + 'T00:00:00');
  const fmt = (d: Date) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  const eyebrow = weeksCount === 1
    ? `One week · ${fmt(startDate)}`
    : `${weeksCount} weeks · ${fmt(startDate)} → ${fmt(endDate)}`;

  // Bar chart: chronological (oldest left) — reverse era.weeks (newest-first)
  const chronological = [...era.weeks].reverse();

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: CARD_BG,
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: compact ? 12 : 16,
        padding: compact ? '16px 18px' : '24px 28px',
        marginBottom: compact ? 0 : 14,
        overflow: 'hidden',
      }}
    >
      {/* Color sliver */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: color,
          boxShadow: `0 0 12px ${color}80`,
          pointerEvents: 'none',
        }}
      />
      {/* Soft corner glow */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: compact ? 140 : 200,
          height: compact ? 140 : 200,
          background: `radial-gradient(circle at 100% 0%, ${color}18, transparent 65%)`,
          pointerEvents: 'none',
        }}
      />

      <div
        style={compact
          ? { display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }
          : { display: 'grid', gridTemplateColumns: '1.4fr 1fr auto', gap: 28, alignItems: 'center', position: 'relative' }
        }
      >
        {/* Title */}
        <div style={{ minWidth: 0 }}>
          <div className="j2-label-micro" style={{ marginBottom: compact ? 6 : 8 }}>{eyebrow}</div>
          <div
            className="j2-serif-display"
            style={{
              fontSize: compact ? 22 : 32,
              fontWeight: 600,
              color: PALE_YELLOW,
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 12,
            }}
          >
            {PILLAR_LABEL[era.focus]}
            {weeksCount >= 4 && (
              <span
                className="j2-serif-italic"
                style={{ fontSize: compact ? 13 : 16, fontWeight: 500, color: COPPER }}
              >
                · a chapter
              </span>
            )}
          </div>
        </div>

        {/* Stats + bar chart */}
        <EraStats era={era} chronological={chronological} statsMap={statsMap} color={color} />

        {/* Action */}
        <button
          onClick={onOpen}
          style={{
            height: 36,
            padding: '0 14px',
            background: SURFACE_3,
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            color: 'rgba(255,255,255,0.85)',
            fontWeight: 500,
            fontSize: 12,
            cursor: 'pointer',
            transition: 'background 180ms ease',
            whiteSpace: 'nowrap',
            width: compact ? '100%' : 'auto',
            touchAction: 'manipulation',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = SURFACE_3; }}
        >
          Open era →
        </button>
      </div>
    </div>
  );
}

function EraStats({
  era, chronological, statsMap, color,
}: {
  era: Era;
  chronological: Intention[];
  statsMap: Map<string, IntentionStats>;
  color: string;
}) {
  const weeksCount = era.weeks.length;

  // Total sessions across the era. Each session has a single date so it falls
  // in exactly one week — no double-counting.
  const totalSessions = era.weeks.reduce(
    (sum, i) => sum + (statsMap.get(i.id)?.sessionCount ?? 0),
    0,
  );

  // Hours-weighted alignment across the era. The naive simple-mean of weekly
  // scores overstates alignment on uneven eras (e.g., 1h@100% + 10h@50% reads
  // 75% but the true on-focus share is 55%). Quiet weeks with zero hours
  // contribute zero on top *and* bottom, so they correctly drop out.
  let matchSum = 0;
  let totalSum = 0;
  for (const i of era.weeks) {
    const s = statsMap.get(i.id);
    if (!s) continue;
    matchSum += s.matchHours;
    totalSum += s.totalHours;
  }
  const avgAlignment = totalSum > 0 ? Math.round((matchSum / totalSum) * 100) : 0;

  const topLabel = totalSessions > 0
    ? `${weeksCount} ${weeksCount === 1 ? 'week' : 'weeks'} · ${totalSessions} session${totalSessions === 1 ? '' : 's'} · ${avgAlignment}% on focus`
    : `${weeksCount} ${weeksCount === 1 ? 'week' : 'weeks'} of ${PILLAR_LABEL[era.focus]}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div className="j2-label-micro">{topLabel}</div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 24 }}>
        {chronological.map((wk, idx) => {
          const wkStats = statsMap.get(wk.id);
          const a = wkStats?.alignment ?? 0;
          // Spec: height = 30 + (alignment/100)*70 (% of 24px container)
          //        opacity = 0.4 + (alignment/100)*0.6
          const heightPct = 30 + (a / 100) * 70;
          const opacity = 0.4 + (a / 100) * 0.6;
          const sessionsCount = wkStats?.sessionCount ?? 0;
          return (
            <div
              key={`${wk.id}-${idx}`}
              title={`${wk.week_start.slice(0, 10)} · ${sessionsCount} session${sessionsCount === 1 ? '' : 's'} · ${a}%`}
              style={{
                flex: 1,
                minWidth: 4,
                maxWidth: 16,
                height: `${heightPct}%`,
                background: color,
                opacity,
                borderRadius: 1,
                transition: 'height 240ms ease, opacity 240ms ease',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}


// ── Empty state ───────────────────────────────────────────────────────────

function DesktopEmpty({ onStart }: { onStart: () => void }) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_GLOW_BORDER}`,
        boxShadow: CARD_GLOW,
        borderRadius: 16,
        padding: '60px 32px',
        textAlign: 'center',
        maxWidth: 560,
        margin: '40px auto',
      }}
    >
      <h2 className="j2-serif-display" style={{ fontSize: 32, margin: 0 }}>No intentions yet.</h2>
      <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.60)', lineHeight: 1.6, marginTop: 10 }}>
        Declare what you&rsquo;re working on — each week, each pivot. It&rsquo;ll live here
        as a log of what your training has been <em>about</em>, not just what it was.
      </p>
      <button
        onClick={onStart}
        style={{
          marginTop: 20,
          height: 44, padding: '0 22px',
          background: '#DA7422', color: '#fff',
          fontWeight: 600, borderRadius: 10,
          boxShadow: '0 10px 24px -12px rgba(218,116,34,0.6)',
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Set your first intention
      </button>
    </div>
  );
}
