// HomeHeroCard — the one dominant object on home.
//
// One shell, a deck of cards inside it: an unfinished entry to pick back up,
// your intention, and something of your own to re-read. The unfinished entry
// leads when there is one, so the prompt to write is the first thing you see.
//
// It does NOT own the hero exclusively. The handoff called for a task to
// take the slot alone on the reasoning that "a task in a carousel becomes a
// task you can swipe away" — deliberately overridden: writing is optional
// here, and a hero locked to a prompt the user has already declined is worse
// than one they can browse past. The prompt leads; it never traps.
//
// The shell is a FIXED height across every card type. A hero that resizes
// per card makes the whole page below it jump on every swipe. Type is
// carried by the pill alone. There are no dots — a weighted rotation has no
// finite ordered position to point at, so two stacked peeks signal depth
// without promising a count.

import { useCallback, useRef, useState } from 'react';
import { COPPER, PALE_YELLOW, BRAND_ORANGE, FONT_EDITORIAL, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY } from '../lib/theme.ts';
import { formatDuration } from '../lib/sessionUtils.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import { excerptOf, isExcerptTruncated } from '../lib/homeViewModel.ts';
import { STAMP_DIES, bandDate } from '../lib/stampDies.ts';
import SealStamp from './seal/SealStamp.tsx';
import SealRevealSheet from './seal/SealRevealSheet.tsx';
import type { MemoryEntry, TechniqueCard } from '../lib/homeViewModel.ts';
import type { Intention, SessionSummary, UserTag } from '../types/api.ts';

/** Fixed across every card type — the page below must never jump on swipe.
 *  Read through a custom property so the desktop desk can set its own
 *  (roomier column, so the handoff's 250px is enough) without every card
 *  component taking a size prop. */
const CARD_HEIGHT = 'var(--j2-hero-h, 262px)';

/** Horizontal travel, in px, that commits to the next card. */
const SWIPE_THRESHOLD_PX = 50;

const CARD_STYLE: React.CSSProperties = {
  position: 'relative',
  height: CARD_HEIGHT,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'radial-gradient(120% 130% at 20% -10%, #1d3b2b 0%, #14291e 55%, #0f2016 100%)',
  padding: 16,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const PILL_STYLE: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.07)',
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: TEXT_SECONDARY,
  whiteSpace: 'nowrap',
};

const MICRO_LABEL: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
};

const CTA_STYLE: React.CSSProperties = {
  height: 44,
  padding: '0 18px',
  borderRadius: 10,
  background: BRAND_ORANGE,
  color: '#fff',
  fontWeight: 600,
  fontSize: 14,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  whiteSpace: 'nowrap',
  border: 'none',
  cursor: 'pointer',
};

const GHOST_STYLE: React.CSSProperties = {
  height: 44,
  padding: '0 12px',
  color: TEXT_SECONDARY,
  fontSize: 14,
  whiteSpace: 'nowrap',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
};

/** The excerpt's copper margin rule — copper records, it never acts. */
const QUOTE_STYLE: React.CSSProperties = {
  fontFamily: FONT_EDITORIAL,
  fontSize: 18,
  lineHeight: 1.5,
  color: TEXT_PRIMARY,
  paddingLeft: 14,
  borderLeft: '1px solid rgba(196,145,95,0.4)',
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function EditIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 21h4L20 8l-4-4L3 17v4z" />
    </svg>
  );
}

function ArrowIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** The two stacked strips behind the deck — depth without a count.
 *
 *  Offsets stay inside the page's 16px gutter. The mockup's −13/−22 were
 *  drawn inside a phone frame that clipped its own overflow; here the far
 *  strip would hang 6px past the viewport, making the whole page
 *  horizontally scrollable and turning any swipe into a page pan. */
function Peeks({ onTurn }: { onTurn?: () => void }) {
  // With `onTurn` the strips ARE the click target — the handoff's prototype
  // faked this with a hardcoded x-offset on the card and flagged it as a gap.
  // Without it they stay decorative (mobile turns the deck by swiping).
  const far: React.CSSProperties = {
    position: 'absolute', right: -15, top: 24, bottom: 24, width: 26,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.06)', borderRight: 'none',
    background: 'linear-gradient(to right, #122419, #0f2016)',
    opacity: 0.5,
  };
  const near: React.CSSProperties = {
    position: 'absolute', right: -8, top: 14, bottom: 14, width: 26,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.1)', borderRight: 'none',
    background: 'linear-gradient(to right, #162c20, #12241a)',
    opacity: 0.9,
  };

  if (!onTurn) {
    return (
      <>
        <div aria-hidden style={far} />
        <div aria-hidden style={near} />
      </>
    );
  }

  return (
    <>
      <button type="button" aria-hidden tabIndex={-1} onClick={onTurn} style={{ ...far, padding: 0, cursor: 'pointer' }} />
      <button
        type="button"
        onClick={onTurn}
        aria-label="Turn to the next card"
        style={{ ...near, padding: 0, cursor: 'pointer' }}
      />
    </>
  );
}

function CardHeader({ pill, right }: { pill: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={PILL_STYLE}>{pill}</span>
      {right}
    </div>
  );
}

// ── Card bodies ─────────────────────────────────────────────────────────────

function TaskCard({ entry, onKeepWriting }: {
  entry: SessionSummary;
  onKeepWriting: () => void;
}) {
  const [sealOpen, setSealOpen] = useState(false);
  const dateKey = typeof entry.date === 'string' ? entry.date.slice(0, 10) : entry.date;
  const d = new Date(dateKey + 'T00:00:00');
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(d);
  // `heading` is a pillar slug ("passing"); every other surface resolves it
  // through SKILL_TAGS before showing it to anyone.
  const heading = entry.heading?.trim();
  const discipline = heading
    ? (SKILL_TAGS.find(s => s.value === heading)?.label ?? heading)
    : 'Jiu Jitsu';
  const stamp = entry.stamps?.[0];
  const die = stamp ? STAMP_DIES[stamp.die_key] : undefined;
  // An unfinished entry is one with nothing written, but if a fragment does
  // exist it gets the quote treatment — the copper margin rule means "your
  // own words" and must never frame copy the app wrote.
  const EXCERPT_CHARS = 90;
  const excerpt = excerptOf(entry, EXCERPT_CHARS);
  const truncated = isExcerptTruncated(entry, EXCERPT_CHARS);

  return (
    <div style={CARD_STYLE}>
      <CardHeader
        pill={weekday}
        right={<span style={{ ...MICRO_LABEL, color: COPPER }}>Unfinished</span>}
      />

      <div
        style={{
          fontFamily: FONT_EDITORIAL, fontSize: 30, fontWeight: 600,
          color: PALE_YELLOW, marginTop: 18, lineHeight: 1.15,
        }}
      >
        {discipline} · {formatDuration(entry.duration)}
      </div>

      {/* Max-width keeps the text clear of the die in the bottom-right. */}
      {excerpt ? (
        <div style={{ ...QUOTE_STYLE, marginTop: 12, maxWidth: 236 }}>
          {excerpt}
          {truncated && <span style={{ color: TEXT_TERTIARY }}> …</span>}
        </div>
      ) : (
        <div
          style={{
            fontFamily: FONT_EDITORIAL, fontSize: 18, fontStyle: 'italic',
            lineHeight: 1.5, color: TEXT_TERTIARY,
            marginTop: 12, maxWidth: 236,
          }}
        >
          Nothing written yet.
        </div>
      )}

      <div style={{ marginTop: 'auto' }}>
        <button type="button" style={CTA_STYLE} onClick={onKeepWriting}>
          <EditIcon /> Keep writing
        </button>
      </div>

      {die && stamp && (
        <>
          <button
            type="button"
            aria-label={`${die.name} seal — a mat moment, ${bandDate(stamp.struck_at)}. Open details.`}
            onClick={e => { e.stopPropagation(); setSealOpen(true); }}
            style={{
              position: 'absolute', right: 16, bottom: 16, width: 56, height: 56,
              transform: 'rotate(-8deg)', background: 'none', border: 'none',
              padding: 0, cursor: 'pointer',
            }}
          >
            <SealStamp die={die} top={bandDate(stamp.struck_at)} size={56} />
          </button>
          <SealRevealSheet
            open={sealOpen}
            die={die}
            struckAt={stamp.struck_at}
            count={entry.stamps?.filter(s => s.die_key === stamp.die_key).length ?? 1}
            autoEarned={die.earnRule === 'auto'}
            onClose={() => setSealOpen(false)}
          />
        </>
      )}
    </div>
  );
}

function MemoryCard({ memory, onRead, onLogToday }: {
  memory: MemoryEntry;
  onRead: (session: SessionSummary) => void;
  onLogToday: () => void;
}) {
  const dateKey = typeof memory.session.date === 'string'
    ? memory.session.date.slice(0, 10) : memory.session.date;
  const d = new Date(dateKey + 'T00:00:00');
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(d);

  return (
    <div style={CARD_STYLE}>
      <CardHeader
        pill={memory.label}
        right={
          <span style={{ ...MICRO_LABEL, color: TEXT_TERTIARY }}>
            {ordinal(memory.ordinal)} session
          </span>
        }
      />

      <div
        style={{
          fontFamily: FONT_EDITORIAL, fontSize: 24, fontWeight: 600,
          color: PALE_YELLOW, marginTop: 16, lineHeight: 1.15,
        }}
      >
        {dateLabel}
        <span
          style={{
            display: 'block', fontSize: 14, fontWeight: 500,
            color: TEXT_SECONDARY,
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
          }}
        >
          {d.getFullYear()}
        </span>
      </div>

      {/* This state exists to be READ — the excerpt runs longer here. */}
      <div
        style={{
          ...QUOTE_STYLE, fontSize: 16, marginTop: 12, maxWidth: 280,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {excerptOf(memory.session, 160)}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
        <button type="button" style={CTA_STYLE} onClick={() => onRead(memory.session)}>
          Read it <ArrowIcon />
        </button>
        <button type="button" style={GHOST_STYLE} onClick={onLogToday}>
          Log today
        </button>
      </div>
    </div>
  );
}

function IntentionCard({ intention, weeksIn, touchedCount, onOpen }: {
  intention: Intention;
  weeksIn: number;
  touchedCount: number;
  onOpen: () => void;
}) {
  return (
    <div style={CARD_STYLE}>
      <CardHeader
        pill="Your intention"
        right={
          <span style={{ ...MICRO_LABEL, color: COPPER }}>
            {ordinal(weeksIn)} week
          </span>
        }
      />

      <div
        style={{
          fontFamily: FONT_EDITORIAL, fontSize: 25, fontWeight: 600,
          color: PALE_YELLOW, marginTop: 16, lineHeight: 1.15,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {intention.intent_label}
      </div>

      <div
        style={{
          fontSize: 13.5, color: TEXT_SECONDARY, marginTop: 10,
          lineHeight: 1.6, maxWidth: 270,
        }}
      >
        {touchedCount > 0
          ? `${touchedCount} session${touchedCount === 1 ? ' has' : 's have'} touched this since you set it.`
          : 'Nothing has touched this yet. It keeps until something does.'}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <button type="button" style={CTA_STYLE} onClick={onOpen}>
          Open the thread
        </button>
      </div>
    </div>
  );
}

function DayOneCard({ onLogFirst }: { onLogFirst: () => void }) {
  return (
    <div style={CARD_STYLE}>
      <CardHeader
        pill="First page"
        right={<span style={{ ...MICRO_LABEL, color: COPPER }}>Blank</span>}
      />

      <div
        style={{
          fontFamily: FONT_EDITORIAL, fontSize: 29, fontWeight: 600,
          color: PALE_YELLOW, marginTop: 22, lineHeight: 1.14,
        }}
      >
        Nothing written<br />here yet.
      </div>

      {/* The promise has to be small enough to keep — name the habit as two
          lines, deliberately. */}
      <div
        style={{
          fontSize: 13.5, color: TEXT_SECONDARY, marginTop: 10,
          lineHeight: 1.55, maxWidth: 250,
        }}
      >
        Log tonight's session and write two lines about it. That's the whole habit.
      </div>

      <div style={{ marginTop: 'auto' }}>
        <button type="button" style={CTA_STYLE} onClick={onLogFirst}>
          <PlusIcon /> Log a session
        </button>
      </div>
    </div>
  );
}

/**
 * A technique the user classified as theirs to work on. The copy always
 * states the anchor — how much of their own recent training touched it —
 * because a technique card that can't say why it's here is library browsing
 * wearing the hero's clothes.
 */
function TechniqueCardView({ card, onOpen }: {
  card: TechniqueCard;
  onOpen: () => void;
}) {
  const { tag, recentCount, windowSize } = card;
  const learning = tag.affinity === 'learning';
  const pillar = SKILL_TAGS.find(s => s.value === tag.parent_pillar)?.label ?? tag.parent_pillar;

  const anchor = recentCount > 0
    ? `You've trained this in ${spellSmall(recentCount)} of your last ${spellSmall(windowSize)} sessions.`
    : learning
      ? "You marked this as something you're working on. It hasn't come up lately."
      : 'One of your go-to techniques.';

  // The user's own note on the technique outranks anything we could say.
  const journal = tag.resonance_journal?.trim();

  return (
    <div style={CARD_STYLE}>
      <CardHeader
        pill={learning ? 'Working on' : 'Go-to'}
        right={<span style={{ ...MICRO_LABEL, color: TEXT_TERTIARY }}>{pillar}</span>}
      />

      <div
        style={{
          fontFamily: FONT_EDITORIAL, fontSize: 25, fontWeight: 600,
          color: PALE_YELLOW, marginTop: 16, lineHeight: 1.15,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {tag.name}
      </div>

      {journal ? (
        <div
          style={{
            ...QUOTE_STYLE, fontSize: 15, marginTop: 10, maxWidth: 270,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {journal}
        </div>
      ) : (
        <div
          style={{
            fontSize: 13.5, color: TEXT_SECONDARY, marginTop: 10,
            lineHeight: 1.6, maxWidth: 270,
          }}
        >
          {anchor}
        </div>
      )}

      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" style={CTA_STYLE} onClick={onOpen}>
          Open technique
        </button>
        {journal && recentCount > 0 && (
          <span style={{ fontSize: 11.5, color: TEXT_TERTIARY }}>
            {recentCount} of {windowSize}
          </span>
        )}
      </div>
    </div>
  );
}

/** An intention that has already run — kept so the user can re-read it. */
function PastIntentionCard({ intention, techniques, onOpen }: {
  intention: Intention;
  techniques: UserTag[];
  onOpen: () => void;
}) {
  const start = new Date(intention.week_start.slice(0, 10) + 'T00:00:00');
  const when = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(start);

  return (
    <div style={CARD_STYLE}>
      <CardHeader
        pill="Earlier intention"
        right={<span style={{ ...MICRO_LABEL, color: TEXT_TERTIARY }}>{when}</span>}
      />

      <div
        style={{
          fontFamily: FONT_EDITORIAL, fontSize: 25, fontWeight: 600,
          color: PALE_YELLOW, marginTop: 16, lineHeight: 1.15,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {intention.intent_label}
      </div>

      {techniques.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {techniques.slice(0, 3).map(t => (
            <span
              key={t.id}
              style={{
                fontSize: 11, fontWeight: 600,
                padding: '4px 10px', borderRadius: 999,
                border: '1px solid rgba(196,145,95,0.35)',
                color: COPPER, whiteSpace: 'nowrap',
              }}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}

      <div style={{ marginTop: 'auto' }}>
        <button type="button" style={CTA_STYLE} onClick={onOpen}>
          Open the thread
        </button>
      </div>
    </div>
  );
}

/** Small counts read better spelled out in the card's editorial voice. */
function spellSmall(n: number): string {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  return words[n] ?? String(n);
}

/**
 * Sessions exist but there's nothing to read yet — everything logged is
 * either unwritten or too recent to feel resurfaced, and no intention is set.
 * States what's true without implying the user failed to do something.
 */
function NothingToResurfaceCard({ onLog }: { onLog: () => void }) {
  return (
    <div style={CARD_STYLE}>
      <CardHeader
        pill="Your journal"
        right={<span style={{ ...MICRO_LABEL, color: COPPER }}>Building</span>}
      />

      <div
        style={{
          fontFamily: FONT_EDITORIAL, fontSize: 27, fontWeight: 600,
          color: PALE_YELLOW, marginTop: 20, lineHeight: 1.14,
        }}
      >
        Nothing to read<br />back yet.
      </div>

      <div
        style={{
          fontSize: 13.5, color: TEXT_SECONDARY, marginTop: 10,
          lineHeight: 1.55, maxWidth: 260,
        }}
      >
        Write two lines after a session and it will find its way back to you here.
      </div>

      <div style={{ marginTop: 'auto' }}>
        <button type="button" style={CTA_STYLE} onClick={onLog}>
          <PlusIcon /> Log a session
        </button>
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}

// ── HomeHeroCard ────────────────────────────────────────────────────────────

interface Props {
  unfinishedEntry: SessionSummary | null;
  memoryEntry: MemoryEntry | null;
  activeIntention: Intention | null;
  intentionWeeksIn: number;
  intentionTouchedCount: number;
  /** Techniques classified as Learning / Go-to in the library. */
  techniqueCards: TechniqueCard[];
  /** Intentions that have already run, newest first. */
  pastIntentions: Intention[];
  /** Resolves an intention's user_tag_ids to library rows. */
  techniquesForIntention: (intention: Intention) => UserTag[];
  hasAnySessions: boolean;
  onKeepWriting: (session: SessionSummary) => void;
  onReadEntry: (session: SessionSummary) => void;
  onOpenIntention: () => void;
  onOpenPastIntention: (intention: Intention) => void;
  onOpenTechnique: (tag: UserTag) => void;
  onLog: () => void;
  /** Desktop: the peek strips become the affordance that turns the deck.
   *  On touch the swipe already does that, so the strips stay decorative. */
  peeksTurn?: boolean;
}

export default function HomeHeroCard({
  unfinishedEntry,
  memoryEntry,
  activeIntention,
  intentionWeeksIn,
  intentionTouchedCount,
  techniqueCards,
  pastIntentions,
  techniquesForIntention,
  hasAnySessions,
  onKeepWriting,
  onReadEntry,
  onOpenIntention,
  onOpenPastIntention,
  onOpenTechnique,
  onLog,
  peeksTurn,
}: Props) {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  /** True only while easing back after a swipe that didn't reach the
   *  threshold. On a committed swipe the drag resets with no transition, so
   *  it doesn't travel one way while the incoming card travels the other. */
  const [snapBack, setSnapBack] = useState(false);
  /** Direction the incoming card should enter from, or null on first paint. */
  const [enterDir, setEnterDir] = useState<1 | -1 | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);

  // Deck order: the unfinished entry leads so the prompt to write is what you
  // land on, then the intention (the thing you asked for), then a memory.
  // Every card after the first is something to read, and the first can be
  // swiped past — declining to write is a valid answer.
  const deck: React.ReactNode[] = [];
  if (unfinishedEntry) {
    deck.push(
      <TaskCard
        key={`task-${unfinishedEntry.id}`}
        entry={unfinishedEntry}
        onKeepWriting={() => onKeepWriting(unfinishedEntry)}
      />,
    );
  }
  if (activeIntention) {
    deck.push(
      <IntentionCard
        key="intention"
        intention={activeIntention}
        weeksIn={intentionWeeksIn}
        touchedCount={intentionTouchedCount}
        onOpen={onOpenIntention}
      />,
    );
  }
  if (memoryEntry) {
    deck.push(
      <MemoryCard
        key="memory"
        memory={memoryEntry}
        onRead={onReadEntry}
        onLogToday={onLog}
      />,
    );
  }
  for (const card of techniqueCards) {
    deck.push(
      <TechniqueCardView
        key={`tech-${card.tag.id}`}
        card={card}
        onOpen={() => onOpenTechnique(card.tag)}
      />,
    );
  }
  for (const past of pastIntentions) {
    deck.push(
      <PastIntentionCard
        key={`past-${past.id}`}
        intention={past}
        techniques={techniquesForIntention(past)}
        onOpen={() => onOpenPastIntention(past)}
      />,
    );
  }

  const count = deck.length;

  const step = useCallback((dir: 1 | -1) => {
    if (count <= 1) return;
    setIndex(prev => (prev + dir + count) % count);
    setEnterDir(prefersReducedMotion() ? null : dir);
  }, [count]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]!.clientX;
    touchStartY.current = e.touches[0]!.clientY;
    isHorizontal.current = null;
    setSnapBack(false);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0]!.clientX - touchStartX.current;
    const dy = e.touches[0]!.clientY - touchStartY.current;
    // Lock the axis on the first meaningful movement so a vertical scroll
    // that wanders sideways never drags the card.
    if (isHorizontal.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        isHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }
    if (!isHorizontal.current) return;
    // Half-distance: attached to the finger without travelling the full span.
    setDragX(prefersReducedMotion() ? 0 : dx * 0.5);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0]!.clientX - touchStartX.current;
    const committed = !!isHorizontal.current && Math.abs(dx) > SWIPE_THRESHOLD_PX;
    setSnapBack(!committed);
    setDragX(0);
    if (committed) step(dx < 0 ? 1 : -1);
  }, [step]);

  // ── Day one · a blank first page, not a dashboard reporting zero. ─────────
  // Gated on having no sessions at all. It must NEVER stand in for an empty
  // deck: telling a user with entries behind it that nothing is written here
  // contradicts the very list sitting below the hero.
  if (!hasAnySessions) {
    return <DayOneCard onLogFirst={onLog} />;
  }

  // ── Sessions logged, but nothing to resurface yet. ────────────────────────
  if (count === 0) {
    return <NothingToResurfaceCard onLog={onLog} />;
  }

  // ── Mode B · the reading deck. ────────────────────────────────────────────
  const swipeable = count > 1;
  const enterClass = enterDir === 1
    ? 'animate-j2-page-slide-in-forward'
    : enterDir === -1 ? 'animate-j2-page-slide-in-back' : undefined;

  return (
    <div style={{ position: 'relative' }}>
      {swipeable && <Peeks onTurn={peeksTurn ? () => step(1) : undefined} />}
      <div
        data-no-page-swipe=""
        onTouchStart={swipeable ? handleTouchStart : undefined}
        onTouchMove={swipeable ? handleTouchMove : undefined}
        onTouchEnd={swipeable ? handleTouchEnd : undefined}
        style={{
          // pan-y is the whole fix for the page sliding along with the card:
          // it tells the browser we own the horizontal axis, so it only pans
          // vertically. Without it the native pan and this transform both run.
          touchAction: swipeable ? 'pan-y' : undefined,
          transform: dragX ? `translateX(${dragX}px)` : undefined,
          transition: snapBack ? 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
          willChange: swipeable ? 'transform' : undefined,
        }}
      >
        {/* Keyed so the incoming card remounts and plays its entrance from
            the side the swipe came from. */}
        <div key={index} className={enterClass}>
          {deck[index % count]}
        </div>
      </div>
    </div>
  );
}
