// IntentionsDesktopView — the desktop editorial layout for the Intentions
// page. Single-year-at-a-time, with focus filter chips, year tabs, and a
// Timeline ↔ Eras layout toggle. Owns its own filter / selected-year /
// open-session state; the parent owns the layout-toggle preference and
// the create/edit modal state.
//
// Extracted from IntentionsPage.tsx during the 2026-05-09 refactor pass.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { COPPER, TEXT_SECONDARY, TEXT_TERTIARY } from '../../lib/theme.ts';
import { toDateString, addDays, getWeekStart } from '../../lib/sessionUtils.ts';
import type { Intention, Pillar, SessionSummary } from '../../types/api.ts';
import PageContent from '../PageContent.tsx';
import SetIntentionModal from '../SetIntentionModal.tsx';
import SessionDetailModal from '../SessionDetailModal.tsx';
import Coachmark from '../Coachmark.tsx';
import {
  PILLAR_LABEL,
  type Era, type FocusFilter, type IntentionsLayout, type IntentionStats, type TimelineRow,
} from './intentionsTypes.ts';
import { computeEras } from './computeEras.ts';
import { DesktopEmpty, EmptyFilteredState, EmptyYearState } from './IntentionsEmptyStates.tsx';
import { FilterBar, YearTabs, DesktopLayoutToggle } from './IntentionsControls.tsx';
import IntentionsTimeline from './IntentionsTimeline.tsx';
import IntentionsEras from './IntentionsEras.tsx';

const YEAR_STORAGE_KEY = 'j2_intentions_year';

interface CoachmarkHandle {
  isOpen: boolean;
  dismiss: () => void;
}

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
  intentionsCoachmark: CoachmarkHandle;
}

export default function IntentionsDesktopView({
  intentions, sessions, loading, intentionsEnabled,
  editTarget, createOpen,
  layout, onLayoutChange, statsMap,
  onOpenCreate, onCloseModal, onSaved, onNavigate,
  intentionsCoachmark,
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
          <div className="j2-label-micro" style={{ marginBottom: 12, fontSize: 13, letterSpacing: '0.18em' }}>Intentions</div>
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
            style={{ marginTop: 12, fontSize: 18, color: TEXT_SECONDARY }}
          >
            {subtitle}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <DesktopLayoutToggle value={layout} onChange={onLayoutChange} />
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
            color: TEXT_TERTIARY,
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
