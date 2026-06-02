// PathAheadMobile — the mobile (single-column) layout for PathAheadPage.
//
// Structure top-to-bottom: HomeHero (greeting + stats, formerly two separate
// components) → telemetry panel (collapsible, gated by telemetryOpen) →
// IntentionHeroCard → main content
// (FirstVisitCard if empty / WeekSection + CTA + heatmap otherwise) →
// modals + RepRouletteFab.
//
// Pure layout shell. All state and computations live in the parent;
// callbacks come in as props. The shell mirrors what existed inline in
// PathAheadPage's mobile branch — no behavioural change vs that.
//
// Extracted from PathAheadPage.tsx during the 2026-05-09 refactor pass.

import { useNavigate } from 'react-router-dom';
import HomeHero from './HomeHero.tsx';
import TodayCard from './today/TodayCard.tsx';
import IntentionHeroCard from './IntentionHeroCard.tsx';
import FirstVisitCard from './FirstVisitCard.tsx';
import RepRouletteFab from './RepRouletteFab.tsx';
import PageContent from './PageContent.tsx';
import PathAheadWeekSection, { type WeekViewMode } from './PathAheadWeekSection.tsx';
import { toDateString } from '../lib/sessionUtils.ts';
import { useTodayClass } from './today/useTodayClass.ts';
import type { Intention, SessionSummary } from '../types/api.ts';
import type { ACWRResult, DecayResult, PillarACWRResult } from '../lib/analyticsModels.ts';

interface DaySessionEntry {
  session: SessionSummary;
  day: Date;
  dayStr: string;
}

interface Props {
  // Profile + ambient
  name: string | null;
  intentionsEnabled: boolean;
  loading: boolean;
  // Stats
  streak: number;
  longestStreak: number;
  weekSessionCount: number;
  consistentWeeks: number;
  acwr?: ACWRResult | null;
  rustiest?: DecayResult | null;
  spikiest?: PillarACWRResult | null;
  // Telemetry panel — always-visible content (the collapsible-panel
  // open/close state was removed; telemetry now renders inline above
  // TodayCard, so only the content node is passed in).
  telemetryContent: React.ReactNode;
  // Intention
  activeIntention: Intention | null;
  // Sessions
  allSessions: SessionSummary[];
  // Week section
  weekOffset: number;
  weekLabel: string;
  weekView: WeekViewMode;
  onWeekOffsetChange: (next: number | ((prev: number) => number)) => void;
  onWeekViewChange: (mode: WeekViewMode) => void;
  displayWeekDays: Date[];
  today: Date;
  sessionsByDate: Map<string, SessionSummary[]>;
  weekSessionsList: DaySessionEntry[];
  onLogTap: (date?: string) => void;
  onDayTap: (day: Date, sessions: SessionSummary[]) => void;
  onSessionTap: (entry: DaySessionEntry) => void;
  // Other shared elements
  heatmapSection: React.ReactNode;
  modals: React.ReactNode;
  styleBlock: React.ReactNode;
  // Callbacks
  openLog: (opts?: { date?: string; preset?: { heading?: string; sessionType?: 'drilling' | 'cla'; subSkillTag?: string; constraintName?: string } | null }) => void;
  setSetIntentOpen: (v: boolean) => void;
  setEditIntention: (v: Intention | null) => void;
  handleDeleteIntention: () => void;
}

export default function PathAheadMobile({
  name,
  intentionsEnabled,
  loading,
  streak,
  longestStreak,
  weekSessionCount,
  consistentWeeks,
  acwr,
  rustiest,
  spikiest,
  telemetryContent,
  activeIntention,
  allSessions,
  weekOffset,
  weekLabel,
  weekView,
  onWeekOffsetChange,
  onWeekViewChange,
  displayWeekDays,
  today,
  sessionsByDate,
  weekSessionsList,
  onLogTap,
  onDayTap,
  onSessionTap,
  heatmapSection,
  modals,
  styleBlock,
  openLog,
  setSetIntentOpen,
  setEditIntention,
  handleDeleteIntention,
}: Props) {
  const navigate = useNavigate();
  const todayClass = useTodayClass(allSessions);
  const hasClassToday = !todayClass.loading && todayClass.state !== 'no_class_today' && todayClass.schedule !== null;

  return (
    <PageContent ready={!loading} loadingMessages={['Shrimping down the mat...', 'Doing mat swims...', 'Pulling up gi pants...']}>
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-0 pb-3 space-y-2">
      {styleBlock}

      {/* ── A. Hero — greeting + streak + this-week numerals ───────
            No card chrome. Streak number is the visual anchor in
            Cormorant; tap cycles through views (daily / weekly /
            sessions / readiness / rustiest / spike). Outer tap
            expands the telemetry panel below. */}
      <HomeHero
        name={name}
        streak={streak}
        longestStreak={longestStreak}
        weekSessionCount={weekSessionCount}
        consistentWeeks={consistentWeeks}
        acwr={acwr}
        rustiest={rustiest}
        spikiest={spikiest}
        onTap={undefined}
        rouletteSlot={
          <RepRouletteFab
            fabPosition="inline"
            onLogDrill={(preset) => {
              const presetData = preset.pool === 'drill'
                ? { heading: preset.heading, sessionType: preset.sessionType, subSkillTag: preset.subSkillTag }
                : { heading: preset.heading, sessionType: preset.sessionType, constraintName: preset.constraintName };
              openLog({ date: toDateString(today), preset: presetData });
            }}
          />
        }
      />

      {/* ── Training Telemetry — always visible, no card ──────── */}
      {telemetryContent}

      {/* ── B + C. TodayCard + IntentionHeroCard ────────────────────
            When no class today: quiet inline text + full-width intent card.
            When class exists: side-by-side compact cards. */}
      {hasClassToday ? (
        <div style={{ display: 'grid', gridTemplateColumns: intentionsEnabled ? '1fr 1fr' : '1fr', gap: 10 }}>
          <TodayCard
            sessions={allSessions}
            onLogSession={(ctx) => openLog({ date: ctx.date })}
            compact
          />
          {intentionsEnabled && (
            <IntentionHeroCard
              intention={activeIntention}
              weekSessionCount={weekSessionCount}
              onSetIntent={() => setSetIntentOpen(true)}
              onEditIntent={activeIntention ? () => setEditIntention(activeIntention) : undefined}
              onViewJournal={activeIntention ? () => navigate(`/intentions/${activeIntention.id}/journal`) : undefined}
              onDeleteIntent={handleDeleteIntention}
              compact
            />
          )}
        </div>
      ) : (
        <>
          <TodayCard
            sessions={allSessions}
            onLogSession={(ctx) => openLog({ date: ctx.date })}
            quiet
          />
          {intentionsEnabled && (
            <IntentionHeroCard
              intention={activeIntention}
              weekSessionCount={weekSessionCount}
              onSetIntent={() => setSetIntentOpen(true)}
              onEditIntent={activeIntention ? () => setEditIntention(activeIntention) : undefined}
              onViewJournal={activeIntention ? () => navigate(`/intentions/${activeIntention.id}/journal`) : undefined}
              onDeleteIntent={handleDeleteIntention}
            />
          )}
        </>
      )}

      {/* ── D-H. Main content (conditional on sessions) ────────── */}
      {!loading && allSessions.length === 0 ? (
        <FirstVisitCard onLogFirst={() => openLog()} />
      ) : (
      <>
        <PathAheadWeekSection
          weekOffset={weekOffset}
          weekLabel={weekLabel}
          weekView={weekView}
          onWeekOffsetChange={onWeekOffsetChange}
          onWeekViewChange={onWeekViewChange}
          displayWeekDays={displayWeekDays}
          today={today}
          sessionsByDate={sessionsByDate}
          weekSessionsList={weekSessionsList}
          onLogTap={onLogTap}
          onDayTap={onDayTap}
          onSessionTap={onSessionTap}
        />
        {heatmapSection}
      </>
      )}

      {modals}
    </div>
    </PageContent>
  );
}
