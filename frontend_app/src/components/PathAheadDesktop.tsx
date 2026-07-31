// PathAheadDesktop — Today, as a desk.
//
// The same table of contents mobile shows, laid out the way an annotated
// page reads: a 620px prose column with the hero, the last three things you
// wrote, and the portrait — and a 296px margin column beside it holding the
// two things worth a glance but not a whole card.
//
// What it is NOT, any more: the operational dashboard that used to live
// here (streak subtitle, stat strip, week carousel, telemetry, partner and
// constraint rails). Those numbers moved to Profile and Atlas when home
// became a journal rather than a tracker — desktop simply agreed with
// mobile late. There is no streak on this page: the collection only grows,
// and nothing on home should be able to go backwards.
//
// Numbers permitted here: today's date, the intention's week count and
// touched-entry count, and the session count inside the portrait's sentence.
//
// Pure layout. Every value arrives as a prop from PathAheadPage.

import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeHeroCard from './HomeHeroCard.tsx';
import HomeEntryList from './HomeEntryList.tsx';
import HomePortrait from './HomePortrait.tsx';
import PageContent from './PageContent.tsx';
import DesktopPathAheadSkeleton from './DesktopPathAheadSkeleton.tsx';
import RepRouletteFab from './RepRouletteFab.tsx';
import { COPPER, FONT_EDITORIAL, PALE_YELLOW, BRAND_ORANGE } from '../lib/theme.ts';
import { excerptOf } from '../lib/homeViewModel.ts';
import type { MemoryEntry, RecentEntry, TechniqueCard } from '../lib/homeViewModel.ts';
import type { Intention, PillarDistribution, SessionSummary, UserTag } from '../types/api.ts';

const TEXT_PRIMARY   = 'rgba(255,255,255,0.92)';
const TEXT_SECONDARY = 'rgba(255,255,255,0.66)';
const TEXT_TERTIARY  = 'rgba(255,255,255,0.46)';
const TEXT_HINT      = 'rgba(255,255,255,0.26)';
const HAIRLINE       = '1px solid rgba(255,255,255,0.06)';

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700,
  letterSpacing: '0.15em', textTransform: 'uppercase',
  color: TEXT_TERTIARY,
};

/** A margin note — a border-topped block, never a card. Cards would make
 *  the margin compete with the hero; the whole point is that it doesn't. */
function MarginNote({
  label, labelColor, children, sub, link, onClick,
}: {
  label: string;
  labelColor?: string;
  children: React.ReactNode;
  sub?: string;
  link?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '20px 0 24px',
        borderTop: HAIRLINE,
        background: 'none', border: 'none', borderTopWidth: 1,
        borderTopStyle: 'solid', borderTopColor: 'rgba(255,255,255,0.06)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span
        style={{
          display: 'block',
          fontSize: 9.5, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: labelColor ?? TEXT_TERTIARY,
          marginBottom: 12,
        }}
      >
        {label}
      </span>
      {children}
      {sub && (
        <span style={{ display: 'block', fontSize: 12, color: TEXT_TERTIARY, marginTop: 9, lineHeight: 1.5 }}>
          {sub}
        </span>
      )}
      {link && (
        <span style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 600, color: BRAND_ORANGE, marginTop: 12 }}>
          {link}
        </span>
      )}
    </button>
  );
}

interface Props {
  name: string | null;
  loading: boolean;
  totalSessions: number;
  unfinishedEntry: SessionSummary | null;
  memoryEntry: MemoryEntry | null;
  /** A second, different memory for the margin — the hero already has one. */
  marginMemory: MemoryEntry | null;
  recentEntries: RecentEntry[];
  portraitShapes: PillarDistribution[];
  intentionsEnabled: boolean;
  activeIntention: Intention | null;
  intentionTouchedCount: number;
  pastIntentions: Intention[];
  techniqueCards: TechniqueCard[];
  techniquesForIntention: (intention: Intention) => UserTag[];
  modals: React.ReactNode;
  openLog: (opts?: { date?: string }) => void;
  onEntryTap: (session: SessionSummary) => void;
}

export default function PathAheadDesktop({
  name,
  loading,
  totalSessions,
  unfinishedEntry,
  memoryEntry,
  marginMemory,
  recentEntries,
  portraitShapes,
  intentionsEnabled,
  activeIntention,
  intentionTouchedCount,
  pastIntentions,
  techniqueCards,
  techniquesForIntention,
  modals,
  openLog,
  onEntryTap,
}: Props) {
  const navigate = useNavigate();

  const today = useMemo(() => new Date(), []);
  const dateLabel = useMemo(
    () => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      .format(today)
      .replace(',', ' ·'),
    [today],
  );
  // "Evening, Robert" — the time of day, not a wish. A greeting that
  // congratulates ("Good evening!") is the register this app doesn't use.
  const partOfDay = useMemo(() => {
    const h = today.getHours();
    return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  }, [today]);

  const handleKeepWriting = useCallback((s: SessionSummary) => onEntryTap(s), [onEntryTap]);
  const handleOpenIntention = useCallback(() => {
    if (!activeIntention) return;
    navigate(`/intentions/${activeIntention.id}/journal`, { state: { from: '/home' } });
  }, [activeIntention, navigate]);
  const handleOpenPastIntention = useCallback((i: Intention) => {
    navigate(`/intentions/${i.id}/journal`, { state: { from: '/home' } });
  }, [navigate]);
  const handleOpenTechnique = useCallback((tag: UserTag) => {
    navigate(`/techniques/${tag.id}`, { state: { from: '/home' } });
  }, [navigate]);

  const intentionWeeksIn = activeIntention
    ? Math.floor(
        (Date.now() - new Date(activeIntention.week_start.slice(0, 10) + 'T00:00:00').getTime())
        / (7 * 86_400_000),
      ) + 1
    : 0;

  // Whether the hero is actually a deck — drives the "turn the card" hint.
  // Mirrors HomeHeroCard's own deck assembly; a hint pointing at a single
  // card would be a lie.
  const deckSize =
    (unfinishedEntry ? 1 : 0)
    + (intentionsEnabled && activeIntention ? 1 : 0)
    + (memoryEntry ? 1 : 0)
    + techniqueCards.length
    + (intentionsEnabled ? pastIntentions.length : 0);

  const marginQuote = marginMemory ? excerptOf(marginMemory.session, 120) : null;

  if (loading) {
    return (
      <PageContent ready={true}>
        <DesktopPathAheadSkeleton />
      </PageContent>
    );
  }

  return (
    <PageContent ready={!loading}>
      <div className="j2-desk-page">
        <div className="j2-desk">
          {/* ── The prose column ────────────────────────────────── */}
          <div className="j2-desk-main">
            <div style={LABEL_STYLE}>{dateLabel}</div>
            <h1
              style={{
                fontFamily: FONT_EDITORIAL,
                fontSize: 33, fontWeight: 600,
                color: PALE_YELLOW,
                letterSpacing: '-0.01em',
                margin: '8px 0 0',
                lineHeight: 1.1,
              }}
            >
              {partOfDay}{name ? `, ${name}` : ''}
            </h1>

            {/* The hero. 250px is enough in a 620px column — the custom
                property overrides the phone's 262px without every card
                component learning about viewports. */}
            <div style={{ marginTop: 26, ['--j2-hero-h' as string]: '250px' }}>
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
                peeksTurn
              />
            </div>
            {deckSize > 1 && (
              <div style={{ fontSize: 10.5, color: TEXT_HINT, marginTop: 9, textAlign: 'right', paddingRight: 2 }}>
                the deck edge turns the card →
              </div>
            )}

            {/* The list */}
            <div style={{ marginTop: 34 }}>
              <div style={{ ...LABEL_STYLE, marginBottom: 4 }}>The last things you wrote</div>
              <HomeEntryList
                entries={recentEntries}
                totalCount={totalSessions}
                onEntryTap={onEntryTap}
                variant="desk"
              />
            </div>

            {/* The portrait */}
            <HomePortrait shapes={portraitShapes} sessionCount={totalSessions} variant="desk" />
          </div>

          {/* ── The margin ──────────────────────────────────────── */}
          <div className="j2-desk-margin">
            {intentionsEnabled && activeIntention && (
              <MarginNote
                label="Your intention · active"
                labelColor={COPPER}
                sub={`Set ${intentionWeeksIn} week${intentionWeeksIn === 1 ? '' : 's'} ago · ${intentionTouchedCount} ${intentionTouchedCount === 1 ? 'entry has' : 'entries have'} touched it`}
                link="Open the thread →"
                onClick={handleOpenIntention}
              >
                <span
                  style={{
                    display: 'block',
                    fontFamily: FONT_EDITORIAL,
                    fontSize: 21, lineHeight: 1.35, fontWeight: 600,
                    color: TEXT_PRIMARY,
                    textWrap: 'pretty',
                  }}
                >
                  {activeIntention.intent_label}
                </span>
              </MarginNote>
            )}

            {marginMemory && marginQuote && (
              <MarginNote
                label={marginMemory.label}
                sub={new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' })
                  .format(new Date(marginMemory.session.date.toString().slice(0, 10) + 'T00:00:00'))}
                link="Read it →"
                onClick={() => onEntryTap(marginMemory.session)}
              >
                <span
                  style={{
                    display: 'block',
                    fontFamily: FONT_EDITORIAL,
                    fontSize: 17.5, lineHeight: 1.5,
                    fontStyle: 'italic',
                    color: TEXT_SECONDARY,
                    textWrap: 'pretty',
                  }}
                >
                  “{marginQuote}”
                </span>
              </MarginNote>
            )}
          </div>
        </div>

        {modals}
        <RepRouletteFab />
      </div>
    </PageContent>
  );
}
