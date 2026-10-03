// PathAheadMobile — mobile home. A table of contents, not a summary.
//
// Vertical order:
//   1. Masthead — seigaiha + wordmark. Lives in MobileAppShell, not here.
//   2. Greeting row — greeting, today's date, the die button.
//   3. HERO — one dominant card (unfinished entry, or the reading deck).
//   4. The list — the last three things you wrote.
//   5. The portrait — every session stacked into one shape.
//
// Nothing else. The record number, tenure, the seven-ring week rail, the
// day-by-day spine, the "this week" stat pair and the sparkline all moved to
// Profile — identity lives on the identity screen; home is for today. There
// is no streak anywhere: the collection only grows, and nothing on home can
// go backwards.
//
// Numbers permitted on this screen: today's date, and "All {n} entries →".

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeGreetingRow from './HomeGreetingRow.tsx';
import HomeHeroCard from './HomeHeroCard.tsx';
import HomeEntryList from './HomeEntryList.tsx';
import HomePortrait from './HomePortrait.tsx';
import RepRouletteFab from './RepRouletteFab.tsx';
import PageContent from './PageContent.tsx';
import type { MemoryEntry, RecentEntry, TechniqueCard } from '../lib/homeViewModel.ts';
import type { Intention, PillarDistribution, SessionSummary, UserTag } from '../types/api.ts';

interface Props {
  loading: boolean;
  totalSessions: number;
  unfinishedEntry: SessionSummary | null;
  memoryEntry: MemoryEntry | null;
  recentEntries: RecentEntry[];
  portraitShapes: PillarDistribution[];
  /** Profile feature flag. When off, the intention card must not reach the
   *  deck — its CTA deep-links into a section the nav has hidden. */
  intentionsEnabled: boolean;
  activeIntention: Intention | null;
  /** Sessions touching the intention since it was set — computed over the
   *  full history in PathAheadPage, not over `recentEntries`. */
  intentionTouchedCount: number;
  /** Intentions already run, newest first — readable from the hero deck. */
  pastIntentions: Intention[];
  /** Library techniques classified Learning / Go-to. */
  techniqueCards: TechniqueCard[];
  techniquesForIntention: (intention: Intention) => UserTag[];
  modals: React.ReactNode;
  styleBlock: React.ReactNode;
  openLog: (opts?: { date?: string }) => void;
  onEntryTap: (session: SessionSummary) => void;
}

export default function PathAheadMobile({
  loading,
  totalSessions,
  unfinishedEntry,
  memoryEntry,
  recentEntries,
  portraitShapes,
  intentionsEnabled,
  activeIntention,
  intentionTouchedCount,
  pastIntentions,
  techniqueCards,
  techniquesForIntention,
  modals,
  styleBlock,
  openLog,
  onEntryTap,
}: Props) {
  const navigate = useNavigate();

  // "Keep writing" and "Two lines is plenty" both land in the same place the
  // Edit affordance does — the existing entry flow. Voice-first capture for
  // NEW sessions is a separate surface and is not touched here.
  const handleKeepWriting = useCallback((session: SessionSummary) => {
    onEntryTap(session);
  }, [onEntryTap]);

  const handleOpenIntention = useCallback(() => {
    if (!activeIntention) return;
    navigate(`/intentions/${activeIntention.id}/journal`, { state: { from: '/home' } });
  }, [activeIntention, navigate]);

  const handleOpenPastIntention = useCallback((intention: Intention) => {
    navigate(`/intentions/${intention.id}/journal`, { state: { from: '/home' } });
  }, [navigate]);

  const handleOpenTechnique = useCallback((tag: UserTag) => {
    navigate(`/techniques/${tag.id}`, { state: { from: '/home' } });
  }, [navigate]);

  // Weeks elapsed since the intention was set, 1-based ("3rd week").
  const intentionWeeksIn = activeIntention
    ? Math.floor(
        (Date.now() - new Date(activeIntention.week_start.slice(0, 10) + 'T00:00:00').getTime())
        / (7 * 86_400_000),
      ) + 1
    : 0;

  return (
    <PageContent
      ready={!loading}
      loadingMessages={['Shrimping down the mat...', 'Doing mat swims...', 'Pulling up gi pants...']}
    >
      <div
        className="max-w-5xl mx-auto px-4 sm:px-6 pt-0 pb-3"
        style={{ display: 'flex', flexDirection: 'column', gap: 22 }}
      >
        {styleBlock}

        {/* ── 2. Greeting row ─────────────────────────────────────────── */}
        <HomeGreetingRow rouletteSlot={<RepRouletteFab fabPosition="inline" />} />

        {/* ── 3. HERO ─────────────────────────────────────────────────── */}
        <HomeHeroCard
          unfinishedEntry={unfinishedEntry}
          memoryEntry={memoryEntry}
          activeIntention={intentionsEnabled ? activeIntention : null}
          intentionWeeksIn={intentionWeeksIn}
          intentionTouchedCount={intentionTouchedCount}
          pastIntentions={intentionsEnabled ? pastIntentions : []}
          techniqueCards={techniqueCards}
          techniquesForIntention={techniquesForIntention}
          hasAnySessions={totalSessions > 0}
          onKeepWriting={handleKeepWriting}
          onReadEntry={onEntryTap}
          onOpenIntention={handleOpenIntention}
          onOpenPastIntention={handleOpenPastIntention}
          onOpenTechnique={handleOpenTechnique}
          onLog={() => openLog()}
        />

        {/* ── 4. The list ─────────────────────────────────────────────── */}
        <HomeEntryList
          entries={recentEntries}
          totalCount={totalSessions}
          onEntryTap={onEntryTap}
        />

        {/* ── 5. The portrait ─────────────────────────────────────────── */}
        <HomePortrait shapes={portraitShapes} sessionCount={totalSessions} />

        {modals}
      </div>
    </PageContent>
  );
}

