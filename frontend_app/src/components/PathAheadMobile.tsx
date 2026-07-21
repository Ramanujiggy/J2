// PathAheadMobile — mobile home layout (v2: record-first, one accent).
//
// Vertical order per Home v2 spec:
// 1. Masthead (greeting + streak pill + Sharpen)
// 2. Day rail (7 completion rings)
// 3. HERO — "Still fresh" capture card (dominant object)
// 4. Record — sessions remembered + tenure
// 5. This week — stats + qualitative sentence
// 6. This week's focus — intention row
// 7. Week strip (existing WeekSection, for nav)
// 8. The longer arc (heatmap/sparkline)

import { useNavigate } from 'react-router-dom';
import HomeHero from './HomeHero.tsx';
import DayRail from './DayRail.tsx';
import StillFreshHero from './StillFreshHero.tsx';
import IntentionHeroCard from './IntentionHeroCard.tsx';
import FirstVisitCard from './FirstVisitCard.tsx';
import RepRouletteFab from './RepRouletteFab.tsx';
import PageContent from './PageContent.tsx';
import PathAheadWeekSection, { type WeekViewMode } from './PathAheadWeekSection.tsx';
import { toDateString } from '../lib/sessionUtils.ts';
import type { Intention, SessionSummary } from '../types/api.ts';

interface DaySessionEntry {
  session: SessionSummary;
  day: Date;
  dayStr: string;
}

interface Props {
  name: string | null;
  intentionsEnabled: boolean;
  loading: boolean;
  streak: number;
  weekSessionCount: number;
  totalSessions: number;
  tenure: string;
  lastSession: { id: string; date: string; duration: number; focusLabel: string; endedAgo: string } | null;
  dayRailData: Array<{ dow: string; date: number; state: 'done' | 'today' | 'rest' | 'future' }>;
  telemetryContent: React.ReactNode;
  activeIntention: Intention | null;
  activeIntentionProgress: { completed: number; target: number; unit: 'sessions' | 'training_weeks' } | null;
  allSessions: SessionSummary[];
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
  heatmapSection: React.ReactNode;
  modals: React.ReactNode;
  styleBlock: React.ReactNode;
  openLog: (opts?: { date?: string; preset?: { heading?: string; sessionType?: 'drilling' | 'cla'; subSkillTag?: string; constraintName?: string } | null }) => void;
  setSetIntentOpen: (v: boolean) => void;
  handleDeleteIntention: () => void;
}

export default function PathAheadMobile({
  name,
  intentionsEnabled,
  loading,
  streak,
  weekSessionCount,
  totalSessions,
  tenure,
  lastSession,
  dayRailData,
  telemetryContent,
  activeIntention,
  activeIntentionProgress,
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
  handleDeleteIntention,
}: Props) {
  const navigate = useNavigate();

  return (
    <PageContent ready={!loading} loadingMessages={['Shrimping down the mat...', 'Doing mat swims...', 'Pulling up gi pants...']}>
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-0 pb-3" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {styleBlock}

      {/* ── 1. Masthead — greeting + streak pill + Sharpen ──── */}
      <HomeHero
        totalSessions={totalSessions}
        tenure={tenure}
        streakDays={streak}
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

      {/* ── 2. Day rail — 7 completion rings ─────────────────── */}
      <DayRail days={dayRailData} />

      {/* ── 3. HERO — "Still fresh" capture card ──────────────── */}
      <StillFreshHero
        lastSession={lastSession}
        onAddNotes={() => openLog({ date: lastSession?.date })}
        onDismiss={() => {/* quiet dismiss — no action needed */}}
      />

      {/* ── 4 + 5. This week (telemetry) ──────────────────────── */}
      {telemetryContent}

      {/* ── 6. This week's focus ──────────────────────────────── */}
      {intentionsEnabled && (
        <IntentionHeroCard
          intention={activeIntention}
          weekSessionCount={weekSessionCount}
          progress={activeIntentionProgress}
          onSetIntent={() => setSetIntentOpen(true)}
          onViewJournal={activeIntention ? () => navigate(`/intentions/${activeIntention.id}/journal`, { state: { from: '/home' } }) : undefined}
          onDeleteIntent={handleDeleteIntention}
        />
      )}

      {/* ── 7 + 8. Week strip + longer arc ─────────────────── */}
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
