// PathAheadMobile — mobile home layout (v2: record-first, one accent).
//
// Vertical order:
// 1. Masthead (greeting + streak pill + Sharpen)
// 2. Day rail (7 interactive completion rings — tap done to view, tap today to log)
// 3. HERO — "Still fresh" capture card (dominant object)
// 4. This week — stats + qualitative sentence
// 5. This week's focus — intention row
// 6. The longer arc (heatmap/sparkline)
//
// The old PathAheadWeekSection (carousel + list toggle) is removed —
// the DayRail covers the same Mon–Sun data in a lighter, tappable form.

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeHero from './HomeHero.tsx';
import DayRail from './DayRail.tsx';
import StillFreshHero from './StillFreshHero.tsx';
import IntentionHeroCard from './IntentionHeroCard.tsx';
import FirstVisitCard from './FirstVisitCard.tsx';
import RepRouletteFab from './RepRouletteFab.tsx';
import PageContent from './PageContent.tsx';
import { toDateString } from '../lib/sessionUtils.ts';
import type { Intention, SessionSummary } from '../types/api.ts';

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
  weekDays: Date[];
  sessionsByDate: Map<string, SessionSummary[]>;
  telemetryContent: React.ReactNode;
  activeIntention: Intention | null;
  activeIntentionProgress: { completed: number; target: number; unit: 'sessions' | 'training_weeks' } | null;
  allSessions: SessionSummary[];
  today: Date;
  heatmapSection: React.ReactNode;
  modals: React.ReactNode;
  styleBlock: React.ReactNode;
  openLog: (opts?: { date?: string; preset?: { heading?: string; sessionType?: 'drilling' | 'cla'; subSkillTag?: string; constraintName?: string } | null }) => void;
  onDayTap: (day: Date, sessions: SessionSummary[]) => void;
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
  weekDays,
  sessionsByDate,
  telemetryContent,
  activeIntention,
  activeIntentionProgress,
  allSessions,
  today,
  heatmapSection,
  modals,
  styleBlock,
  openLog,
  onDayTap,
  setSetIntentOpen,
  handleDeleteIntention,
}: Props) {
  const navigate = useNavigate();

  const handleDayRailTap = useCallback((index: number) => {
    const day = weekDays[index];
    if (!day) return;
    const dayStr = toDateString(day);
    const sessions = sessionsByDate.get(dayStr) ?? [];
    if (sessions.length > 0) {
      onDayTap(day, sessions);
    } else {
      openLog({ date: dayStr });
    }
  }, [weekDays, sessionsByDate, onDayTap, openLog]);

  return (
    <PageContent ready={!loading} loadingMessages={['Shrimping down the mat...', 'Doing mat swims...', 'Pulling up gi pants...']}>
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-0 pb-3" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {styleBlock}

      {/* ── 1. Masthead — greeting + record + streak pill + Sharpen ── */}
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

      {/* ── 2. Day rail — tappable completion rings ────────────── */}
      <DayRail days={dayRailData} onDayTap={handleDayRailTap} />

      {/* ── 3. HERO — "Still fresh" capture card ──────────────── */}
      <StillFreshHero
        lastSession={lastSession}
        onAddNotes={() => openLog({ date: lastSession?.date })}
        onDismiss={() => {}}
      />

      {/* ── 4. This week (telemetry) ──────────────────────────── */}
      {telemetryContent}

      {/* ── 5. This week's focus ──────────────────────────────── */}
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

      {/* ── 6. The longer arc ─────────────────────────────────── */}
      {!loading && allSessions.length === 0 ? (
        <FirstVisitCard onLogFirst={() => openLog()} />
      ) : (
        heatmapSection
      )}

      {modals}
    </div>
    </PageContent>
  );
}
