// PathAheadMobile — the mobile (single-column) layout for PathAheadPage.
//
// Structure top-to-bottom: HomeHeader → StatStrip → telemetry panel
// (collapsible, gated by telemetryOpen) → IntentionHeroCard → main content
// (FirstVisitCard if empty / WeekSection + CTA + heatmap otherwise) →
// modals + RepRouletteFab.
//
// Pure layout shell. All state and computations live in the parent;
// callbacks come in as props. The shell mirrors what existed inline in
// PathAheadPage's mobile branch — no behavioural change vs that.
//
// Extracted from PathAheadPage.tsx during the 2026-05-09 refactor pass.

import { useNavigate } from 'react-router-dom';
import HomeHeader from './HomeHeader.tsx';
import StatStrip from './StatStrip.tsx';
import IntentionHeroCard from './IntentionHeroCard.tsx';
import FirstVisitCard from './FirstVisitCard.tsx';
import RepRouletteFab from './RepRouletteFab.tsx';
import PageContent from './PageContent.tsx';
import PathAheadWeekSection, { type WeekViewMode } from './PathAheadWeekSection.tsx';
import { toDateString } from '../lib/sessionUtils.ts';
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
  weekTotalMinutes: number;
  consistentWeeks: number;
  acwr?: ACWRResult | null;
  rustiest?: DecayResult | null;
  spikiest?: PillarACWRResult | null;
  // Telemetry panel
  telemetryOpen: boolean;
  setTelemetryOpen: (next: boolean | ((prev: boolean) => boolean)) => void;
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
  primaryCta: React.ReactNode;
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
  weekTotalMinutes,
  consistentWeeks,
  acwr,
  rustiest,
  spikiest,
  telemetryOpen,
  setTelemetryOpen,
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
  primaryCta,
  heatmapSection,
  modals,
  styleBlock,
  openLog,
  setSetIntentOpen,
  setEditIntention,
  handleDeleteIntention,
}: Props) {
  const navigate = useNavigate();

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
        weekSessionCount={weekSessionCount}
        weekTotalMinutes={weekTotalMinutes}
        consistentWeeks={consistentWeeks}
        acwr={acwr}
        rustiest={rustiest}
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
          weekSessionCount={weekSessionCount}
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
