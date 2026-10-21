import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  BRAND_ORANGE, CARD_BG, COPPER, COPPER_BORDER, FONT_EDITORIAL, GLOW_SOFT, PALE_YELLOW,
  TEXT_BODY, TEXT_DISABLED, TEXT_HINT, TEXT_SECONDARY, TEXT_TERTIARY, WHISPER_BORDER,
} from '../../lib/theme.ts';
import {
  MONTH_FULL, buildShelf, shiftDays, excerpt, formatHours, mondayOf, mostWritten, noteOf, numberWords,
  promotionText, totalMinutes, weekOfChapter, yearSentence,
} from '../../lib/calendarBook.ts';
import type { Chapter, ShelfWeek } from '../../lib/calendarBook.ts';
import { sessionDateKey } from '../../lib/analyticsUtils.ts';
import type { BeltHistoryEntry, SessionSummary } from '../../types/api.ts';
import { SessionDot, formatDay, formatRange } from './marks.tsx';

const SHELF_HEIGHT = 64;
const MONTH_LETTER = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

interface Props {
  year: number;
  todayStr: string;
  sessions: SessionSummary[];
  chapters: Chapter[];
  promotions: BeltHistoryEntry[];
  loading: boolean;
  canGoForward: boolean;
  onYearChange: (dir: 1 | -1) => void;
  onOpenChapter: (chapter: Chapter) => void;
  onOpenMonth: (month: number) => void;
}

type Item =
  | { kind: 'chapter'; date: string; chapter: Chapter }
  | { kind: 'promotion'; date: string; promotion: BeltHistoryEntry };

export default function YearBook({
  year, todayStr, sessions, chapters, promotions, loading, canGoForward, onYearChange, onOpenChapter, onOpenMonth,
}: Props) {
  const isCurrentYear = todayStr.slice(0, 4) === String(year);
  const shelf = useMemo(() => buildShelf(sessions, year, todayStr), [sessions, year, todayStr]);
  const sentence = useMemo(
    () => yearSentence({ year, isCurrentYear, sessions, chapters, promotions }),
    [year, isCurrentYear, sessions, chapters, promotions],
  );

  // The intention chapter (if any) each shelf week falls in, for the band under the books
  const bandFor = useMemo(() => {
    const intentionChapters = chapters.filter(c => c.kind === 'intention');
    return (week: ShelfWeek) => {
      const weekEnd = shiftDays(week.start, 6);
      return intentionChapters.find(c => c.start <= weekEnd && c.end >= week.start);
    };
  }, [chapters]);

  const promotionWeek = useMemo(() => {
    const map = new Map<string, BeltHistoryEntry>();
    for (const p of promotions) map.set(mondayOf(p.promoted_at.slice(0, 10)), p);
    return map;
  }, [promotions]);

  const peak = useMemo(
    () => Math.max(180, ...shelf.flatMap(b => b.weeks.map(w => w.minutes))),
    [shelf],
  );

  // Chapters newest first, with promotions standing between them by date
  const items = useMemo<Item[]>(() => {
    const list: Item[] = [
      ...chapters.map(c => ({ kind: 'chapter' as const, date: c.start, chapter: c })),
      ...promotions.map(p => ({ kind: 'promotion' as const, date: p.promoted_at.slice(0, 10), promotion: p })),
    ];
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [chapters, promotions]);

  const yearButton = {
    width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Year */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <button onClick={() => onYearChange(-1)} className="touch-manipulation" style={{ ...yearButton, color: TEXT_HINT }} aria-label="Previous year">
            <ChevronLeft size={18} />
          </button>
          <h1 style={{ margin: 0, fontFamily: FONT_EDITORIAL, fontWeight: 500, fontSize: 44, letterSpacing: '0.04em', color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
            {year}
          </h1>
          <button
            onClick={() => onYearChange(1)}
            disabled={!canGoForward}
            className="touch-manipulation"
            style={{ ...yearButton, color: canGoForward ? TEXT_HINT : TEXT_DISABLED, cursor: canGoForward ? 'pointer' : 'default' }}
            aria-label="Next year"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <p style={{ margin: 0, maxWidth: 420, minHeight: 58, fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 21, lineHeight: 1.4, color: PALE_YELLOW, opacity: loading ? 0 : 0.85, transition: 'opacity 300ms ease', textAlign: 'center' }}>
          {sentence}
        </p>
      </div>

      {/* The shelf — one book per month, one spine per week */}
      <section aria-label={`Time on the mat by week, ${year}`}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
          {shelf.map(book => {
            const sessionsInMonth = sessions.filter(s => Number(sessionDateKey(s).slice(5, 7)) - 1 === book.month).length;
            const promo = book.weeks.map(w => promotionWeek.get(w.start)).find(Boolean);
            const isFutureMonth = book.weeks.every(w => w.future);
            return (
              <button
                key={book.month}
                onClick={() => sessionsInMonth > 0 && onOpenMonth(book.month)}
                disabled={sessionsInMonth === 0}
                className="touch-manipulation"
                aria-label={`${MONTH_FULL[book.month]}: ${sessionsInMonth} session${sessionsInMonth !== 1 ? 's' : ''}`}
                style={{
                  flex: `${book.weeks.length} 1 0`,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  cursor: sessionsInMonth > 0 ? 'pointer' : 'default',
                }}
              >
                {/* Promotion over its book */}
                <span style={{ height: 16, width: '100%', display: 'flex', justifyContent: 'center', overflow: 'visible' }}>
                  {promo && (
                    <span style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 13, color: COPPER, whiteSpace: 'nowrap' }}>
                      {promo.stripes > 0 ? 'Stripe' : `${promo.belt_rank.charAt(0).toUpperCase()}${promo.belt_rank.slice(1)}`}
                    </span>
                  )}
                </span>
                {/* Spines */}
                <span
                  style={{
                    height: SHELF_HEIGHT,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 1,
                    padding: '0 1px',
                    boxSizing: 'border-box',
                    borderRadius: '2px 2px 0 0',
                    boxShadow: WHISPER_BORDER,
                    borderBottom: `1px solid ${COPPER_BORDER}`,
                  }}
                >
                  {book.weeks.map(w => {
                    const isPromo = promotionWeek.has(w.start);
                    const h = w.minutes > 0 ? Math.round(6 + (Math.min(w.minutes, peak) / peak) * (SHELF_HEIGHT - 10)) : 2;
                    return (
                      <span
                        key={w.start}
                        style={{
                          flex: '1 1 0',
                          height: isPromo ? SHELF_HEIGHT - 2 : h,
                          borderRadius: '1px 1px 0 0',
                          backgroundColor: isPromo ? COPPER : w.hard ? COPPER : PALE_YELLOW,
                          opacity: isPromo ? 0.9 : w.future ? 0.08 : w.minutes === 0 ? 0.18 : w.isNow ? 1 : w.hard ? 0.85 : 0.5,
                          boxShadow: w.isNow ? GLOW_SOFT : 'none',
                        }}
                      />
                    );
                  })}
                </span>
                {/* Chapter bands */}
                <span style={{ height: 3, width: '100%', display: 'flex', gap: 1, padding: '0 1px', boxSizing: 'border-box' }}>
                  {book.weeks.map(w => {
                    const ch = bandFor(w);
                    return (
                      <span key={w.start} style={{ flex: '1 1 0', borderRadius: 2, backgroundColor: ch ? (ch.ongoing ? BRAND_ORANGE : COPPER) : 'transparent', opacity: ch ? (ch.ongoing ? 1 : 0.55) : 0 }} />
                    );
                  })}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: isFutureMonth ? TEXT_DISABLED : TEXT_TERTIARY, textAlign: 'center' }}>
                  {MONTH_LETTER[book.month]}
                </span>
              </button>
            );
          })}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 11, color: TEXT_TERTIARY }}>
          Each line is a week; taller is more time on the mat. Tap a month to read it.
        </p>
      </section>

      {/* Chapters */}
      <section aria-label="Chapters" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: TEXT_TERTIARY }}>
          Chapters
        </h2>
        {!loading && items.length === 0 && (
          <p style={{ margin: 0, fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 17, color: TEXT_TERTIARY }}>
            {isCurrentYear
              ? 'The first chapter starts with your next session, or when you set an intention.'
              : 'Nothing was written in this year.'}
          </p>
        )}
        {items.map(item => item.kind === 'promotion' ? (
          <div key={`p-${item.promotion.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 2px' }}>
            <span style={{ flex: 1, height: 1, backgroundColor: COPPER_BORDER }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: FONT_EDITORIAL, fontSize: 20, fontWeight: 500, color: COPPER }}>{promotionText(item.promotion)}</div>
              <div style={{ fontSize: 11, color: TEXT_TERTIARY }}>{formatDay(item.date, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            </div>
            <span style={{ flex: 1, height: 1, backgroundColor: COPPER_BORDER }} />
          </div>
        ) : (
          <ChapterCard key={item.chapter.key} chapter={item.chapter} todayStr={todayStr} onOpen={onOpenChapter} />
        ))}
      </section>
    </div>
  );
}

function ChapterCard({ chapter, todayStr, onOpen }: { chapter: Chapter; todayStr: string; onOpen: (c: Chapter) => void }) {
  const quote = mostWritten(chapter.sessions);
  const n = chapter.sessions.length;
  const eyebrow = chapter.ongoing
    ? `Now · week ${numberWords(weekOfChapter(chapter, todayStr))}`
    : chapter.kind === 'intention'
      ? `Chapter ${numberWords(chapter.number ?? 0)}${chapter.pillar ? ` · ${chapter.pillar}` : ''}`
      : chapter.kind === 'between' ? 'Between chapters' : 'The month';
  const reflected = !!chapter.intention?.journal_entry?.trim();

  return (
    <button
      onClick={() => onOpen(chapter)}
      className="touch-manipulation"
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        borderRadius: 16,
        padding: chapter.ongoing ? '18px 18px 16px' : '16px 18px',
        backgroundColor: CARD_BG,
        border: 'none',
        boxShadow: chapter.ongoing ? `0 0 0 1px ${COPPER_BORDER}` : WHISPER_BORDER,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: chapter.ongoing ? BRAND_ORANGE : TEXT_TERTIARY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {eyebrow}
        </span>
        <span style={{ flexShrink: 0, fontSize: 11, color: TEXT_TERTIARY }}>{formatRange(chapter.start, chapter.end, chapter.ongoing)}</span>
      </div>
      <div style={{ fontFamily: FONT_EDITORIAL, fontSize: chapter.ongoing ? 26 : 22, fontWeight: 500, lineHeight: 1.15, color: PALE_YELLOW }}>
        {chapter.title}
      </div>
      {n > 0 && (
        <div style={{ display: 'flex', gap: 5, margin: '12px 0 10px', flexWrap: 'wrap' }}>
          {chapter.sessions.map(s => <SessionDot key={s.id} session={s} size={chapter.ongoing ? 8 : 6} />)}
        </div>
      )}
      {quote ? (
        <p style={{ margin: n > 0 ? 0 : '10px 0 0', fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: chapter.ongoing ? 17 : 16, lineHeight: 1.35, color: chapter.ongoing ? TEXT_BODY : TEXT_SECONDARY }}>
          “{excerpt(noteOf(quote), 140)}”
        </p>
      ) : (
        <p style={{ margin: n > 0 ? 0 : '10px 0 0', fontSize: 12, color: TEXT_TERTIARY }}>Nothing written yet.</p>
      )}
      <div style={{ marginTop: 8, fontSize: 11, color: TEXT_TERTIARY }}>
        {n} session{n !== 1 ? 's' : ''} · {formatHours(totalMinutes(chapter.sessions))}
        {reflected ? ' · closed with a reflection' : ''}
      </div>
    </button>
  );
}
