// HomeHeroCard — the one dominant object on home.
//
// Two modes, one shell:
//
//   Mode A · a task exists. An unfinished entry owns the hero alone — no
//   peek, no swipe. A task in a carousel becomes a task you can swipe away.
//
//   Mode B · nothing unfinished. The hero becomes a reading deck: your own
//   past, your intention, a technique you keep returning to. Every card is
//   the same kind of thing (something to read), so swiping is honest.
//
// If a task AND a memory are both available the task wins; the memory keeps.
//
// The shell is a FIXED height across every card type. A hero that resizes
// per card makes the whole page below it jump on every swipe. Type is
// carried by the pill alone. There are no dots — a weighted rotation has no
// finite ordered position to point at, so two stacked peeks signal depth
// without promising a count.

import { useCallback, useRef, useState } from 'react';
import {
  COPPER, PALE_YELLOW, BRAND_ORANGE, FONT_EDITORIAL,
} from '../lib/theme.ts';
import { formatDuration } from '../lib/sessionUtils.ts';
import { excerptOf } from '../lib/homeViewModel.ts';
import { STAMP_DIES, bandDate } from '../lib/stampDies.ts';
import SealStamp from './seal/SealStamp.tsx';
import SealRevealSheet from './seal/SealRevealSheet.tsx';
import type { MemoryEntry } from '../lib/homeViewModel.ts';
import type { Intention, SessionSummary } from '../types/api.ts';

/** Fixed across every card type — the page below must never jump on swipe. */
const CARD_HEIGHT = 262;

const CARD_STYLE: React.CSSProperties = {
  position: 'relative',
  height: CARD_HEIGHT,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'radial-gradient(120% 130% at 20% -10%, #1d3b2b 0%, #14291e 55%, #0f2016 100%)',
  padding: 16,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const PILL_STYLE: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 20,
  background: 'rgba(255,255,255,0.07)',
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.66)',
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
  borderRadius: 11,
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
  color: 'rgba(255,255,255,0.66)',
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
  color: 'rgba(255,255,255,0.92)',
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

/** The two stacked strips behind the deck — depth without a count. */
function Peeks() {
  return (
    <>
      <div
        aria-hidden
        style={{
          position: 'absolute', right: -22, top: 24, bottom: 24, width: 26,
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.06)', borderRight: 'none',
          background: 'linear-gradient(to right, #122419, #0f2016)',
          opacity: 0.5,
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute', right: -13, top: 14, bottom: 14, width: 26,
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.1)', borderRight: 'none',
          background: 'linear-gradient(to right, #162c20, #12241a)',
          opacity: 0.9,
        }}
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
  const discipline = entry.heading?.trim() || 'Jiu Jitsu';
  const stamp = entry.stamps?.[0];
  const die = stamp ? STAMP_DIES[stamp.die_key] : undefined;
  // An unfinished entry is one with nothing written, but if a fragment does
  // exist it gets the quote treatment — the copper margin rule means "your
  // own words" and must never frame copy the app wrote.
  const EXCERPT_CHARS = 90;
  const excerpt = excerptOf(entry, EXCERPT_CHARS);
  // Only trail off when the text was actually cut — a complete short fragment
  // that ends in an ellipsis reads as truncated when it isn't.
  const truncated = !!excerpt && (entry.notes?.trim().replace(/\s+/g, ' ').length ?? 0) > excerpt.length;

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
          {truncated && <span style={{ color: 'rgba(255,255,255,0.46)' }}> …</span>}
        </div>
      ) : (
        <div
          style={{
            fontFamily: FONT_EDITORIAL, fontSize: 18, fontStyle: 'italic',
            lineHeight: 1.5, color: 'rgba(255,255,255,0.46)',
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
          <span style={{ ...MICRO_LABEL, color: 'rgba(255,255,255,0.46)' }}>
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
            color: 'rgba(255,255,255,0.66)',
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
          fontSize: 13.5, color: 'rgba(255,255,255,0.66)', marginTop: 10,
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
          fontSize: 13.5, color: 'rgba(255,255,255,0.66)', marginTop: 10,
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
          fontSize: 13.5, color: 'rgba(255,255,255,0.66)', marginTop: 10,
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
  hasAnySessions: boolean;
  onKeepWriting: (session: SessionSummary) => void;
  onReadEntry: (session: SessionSummary) => void;
  onOpenIntention: () => void;
  onLog: () => void;
}

export default function HomeHeroCard({
  unfinishedEntry,
  memoryEntry,
  activeIntention,
  intentionWeeksIn,
  intentionTouchedCount,
  hasAnySessions,
  onKeepWriting,
  onReadEntry,
  onOpenIntention,
  onLog,
}: Props) {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);

  // Deck contents. Order puts the intention first — it is the card the user
  // asked for, so it carries the slot when one is set.
  const deck: React.ReactNode[] = [];
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

  const count = deck.length;

  const step = useCallback((dir: 1 | -1) => {
    if (count <= 1) return;
    setIndex(prev => (prev + dir + count) % count);
  }, [count]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]!.clientX;
    touchStartY.current = e.touches[0]!.clientY;
    isHorizontal.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0]!.clientX - touchStartX.current;
    const dy = e.touches[0]!.clientY - touchStartY.current;
    if (isHorizontal.current === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        isHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }
    if (!isHorizontal.current) return;
    setDragX(prefersReducedMotion() ? 0 : dx);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0]!.clientX - touchStartX.current;
    if (isHorizontal.current && Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    setDragX(0);
  }, [step]);

  // ── Mode A · a task exists. It owns the hero alone. ───────────────────────
  if (unfinishedEntry) {
    return (
      <TaskCard
        entry={unfinishedEntry}
        onKeepWriting={() => onKeepWriting(unfinishedEntry)}
      />
    );
  }

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
  return (
    <div style={{ position: 'relative' }}>
      {count > 1 && <Peeks />}
      <div
        data-no-page-swipe=""
        onTouchStart={count > 1 ? handleTouchStart : undefined}
        onTouchMove={count > 1 ? handleTouchMove : undefined}
        onTouchEnd={count > 1 ? handleTouchEnd : undefined}
        style={{
          transform: dragX ? `translateX(${dragX * 0.4}px)` : undefined,
          transition: dragX ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: count > 1 ? 'transform' : undefined,
        }}
      >
        {deck[index % count]}
      </div>
    </div>
  );
}
