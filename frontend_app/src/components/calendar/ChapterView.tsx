import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import {
  CARD_BG, COPPER, INT_COLORS, COPPER_BORDER, FONT_EDITORIAL, GLOW_SOFT, PALE_YELLOW,
  SURFACE_2_BORDER, TEXT_BODY, TEXT_HINT, TEXT_SECONDARY, TEXT_TERTIARY,
} from '../../lib/theme.ts';
import {
  excerpt, formatHours, mondayOf, mostWritten, noteOf, numberWords, promotionText, shiftDays, totalMinutes,
} from '../../lib/calendarBook.ts';
import type { Chapter } from '../../lib/calendarBook.ts';
import { sessionDateKey } from '../../lib/analyticsUtils.ts';
import type { BeltHistoryEntry } from '../../types/api.ts';
import { DayMark, WROTE_RING, formatDay, formatRange } from './marks.tsx';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const ROW_COLS = '52px repeat(7, 12px) minmax(0, 1fr)';

interface Props {
  chapter: Chapter;
  year: number;
  todayStr: string;
  promotions: BeltHistoryEntry[];
  onBack: () => void;
  onOpenWeek: (monday: string) => void;
}

export default function ChapterView({ chapter, year, todayStr, promotions, onBack, onOpenWeek }: Props) {
  const navigate = useNavigate();
  const lastDay = chapter.ongoing && todayStr < chapter.end ? todayStr : chapter.end;

  const weeks = useMemo(() => {
    const out: { monday: string; days: { key: string; state: 'outside' | 'future' | 'past'; sessions: typeof chapter.sessions }[]; promotion?: BeltHistoryEntry }[] = [];
    for (let monday = mondayOf(chapter.start); monday <= lastDay; monday = shiftDays(monday, 7)) {
      const days = Array.from({ length: 7 }, (_, i) => {
        const key = shiftDays(monday, i);
        const outside = key < chapter.start || key > chapter.end || key.slice(0, 4) !== String(year);
        return {
          key,
          state: outside ? 'outside' as const : key > todayStr ? 'future' as const : 'past' as const,
          sessions: chapter.sessions.filter(s => sessionDateKey(s) === key),
        };
      });
      const promotion = promotions.find(p => {
        const d = p.promoted_at.slice(0, 10);
        return d >= monday && d <= shiftDays(monday, 6) && d >= chapter.start && d <= chapter.end;
      });
      out.push({ monday, days, ...(promotion ? { promotion } : {}) });
    }
    return out;
  }, [chapter, lastDay, todayStr, promotions, year]);

  const n = chapter.sessions.length;
  const written = chapter.sessions.filter(s => noteOf(s)).length;
  const eyebrow = chapter.kind === 'intention'
    ? `Chapter ${numberWords(chapter.number ?? 0)}${chapter.pillar ? ` · ${chapter.pillar}` : ''}`
    : chapter.kind === 'between' ? 'Between chapters' : 'The month';
  const reflection = chapter.intention?.journal_entry?.trim() ?? '';
  const journalPath = chapter.intention ? `/intentions/${chapter.intention.id}/journal` : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <button
        onClick={onBack}
        className="touch-manipulation"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start', padding: 0, background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: TEXT_TERTIARY, cursor: 'pointer' }}
      >
        <ChevronLeft size={16} /> {year}
      </button>

      <header style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: -8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: TEXT_TERTIARY }}>
          {eyebrow} · {formatRange(chapter.start, chapter.end, chapter.ongoing)}
        </span>
        <h1 style={{ margin: 0, fontFamily: FONT_EDITORIAL, fontSize: 36, fontWeight: 500, lineHeight: 1.1, color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
          {chapter.title}
        </h1>
        <div style={{ fontSize: 12, color: TEXT_TERTIARY }}>
          {weeks.length} week{weeks.length !== 1 ? 's' : ''} · {n} session{n !== 1 ? 's' : ''} · {formatHours(totalMinutes(chapter.sessions))} · {written} written
        </div>
      </header>

      {/* One line per week */}
      <section aria-label="Weeks in this chapter">
        <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: ROW_COLS, columnGap: 5, paddingBottom: 6, fontSize: 9.5, fontWeight: 600, color: TEXT_HINT }}>
          <span />
          {DOW.map((d, i) => <span key={i} style={{ textAlign: 'center' }}>{d}</span>)}
          <span />
        </div>
        {weeks.map(w => {
          const weekSessions = w.days.flatMap(d => d.sessions);
          const best = mostWritten(weekSessions);
          return (
            <div key={w.monday}>
              {w.promotion && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0' }}>
                  <span style={{ flex: 1, height: 1, backgroundColor: COPPER_BORDER }} />
                  <span style={{ fontFamily: FONT_EDITORIAL, fontSize: 19, fontWeight: 500, color: COPPER, textAlign: 'center' }}>
                    {promotionText(w.promotion)} · {formatDay(w.promotion.promoted_at.slice(0, 10), { day: 'numeric', month: 'long' })}
                  </span>
                  <span style={{ flex: 1, height: 1, backgroundColor: COPPER_BORDER }} />
                </div>
              )}
              <button
                onClick={() => onOpenWeek(w.monday)}
                className="touch-manipulation"
                aria-label={`Week of ${formatDay(w.monday, { month: 'long', day: 'numeric' })}: ${weekSessions.length} session${weekSessions.length !== 1 ? 's' : ''}`}
                style={{ display: 'grid', gridTemplateColumns: ROW_COLS, columnGap: 5, alignItems: 'start', width: '100%', minHeight: 44, padding: '12px 0', background: 'none', border: 'none', borderTop: `1px solid ${SURFACE_2_BORDER}`, textAlign: 'left', cursor: 'pointer' }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: TEXT_TERTIARY, paddingTop: 1 }}>{formatDay(w.monday)}</span>
                {w.days.map(d => (
                  <span key={d.key} style={{ display: 'flex', justifyContent: 'center', paddingTop: 3 }}>
                    <DayMark sessions={d.sessions} state={d.state} />
                  </span>
                ))}
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 8, minWidth: 0 }}>
                  {weekSessions.length === 0 ? (
                    <span style={{ fontSize: 13, color: TEXT_HINT }}>Rest</span>
                  ) : (
                    <>
                      <span style={{ fontSize: 11, color: TEXT_TERTIARY }}>
                        {weekSessions.length} session{weekSessions.length !== 1 ? 's' : ''} · {formatHours(totalMinutes(weekSessions))}
                      </span>
                      {best ? (
                        <span style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 15.5, lineHeight: 1.3, color: TEXT_SECONDARY }}>
                          “{excerpt(noteOf(best), 90)}”
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: TEXT_HINT }}>Nothing written</span>
                      )}
                    </>
                  )}
                </span>
              </button>
            </div>
          );
        })}
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 11, color: TEXT_TERTIARY }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: INT_COLORS[3] }} />trained
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: INT_COLORS[3], boxShadow: WROTE_RING }} />wrote about it
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: INT_COLORS[5] }} />hard roll
        </span>
      </div>

      {/* Closing the chapter */}
      {journalPath && (reflection ? (
        <button
          onClick={() => navigate(journalPath, { state: { from: '/calendar' } })}
          className="touch-manipulation"
          style={{ textAlign: 'left', borderRadius: 16, padding: 18, backgroundColor: CARD_BG, border: 'none', boxShadow: `0 0 0 1px ${COPPER_BORDER}`, cursor: 'pointer' }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: TEXT_TERTIARY, marginBottom: 8 }}>
            {chapter.ongoing ? 'So far' : 'How it went'}
          </div>
          <p style={{ margin: 0, fontFamily: FONT_EDITORIAL, fontSize: 19, lineHeight: 1.45, color: PALE_YELLOW, whiteSpace: 'pre-line' }}>
            {excerpt(reflection, 420)}
          </p>
        </button>
      ) : (
        <button
          onClick={() => navigate(journalPath, { state: { from: '/calendar' } })}
          className="touch-manipulation"
          style={{ textAlign: 'left', borderRadius: 16, padding: '16px 18px', backgroundColor: 'transparent', border: 'none', boxShadow: `inset 0 0 0 1px ${COPPER_BORDER}`, cursor: 'pointer', minHeight: 44 }}
        >
          <div style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 19, color: PALE_YELLOW }}>
            {chapter.ongoing ? 'How is this chapter going?' : 'How did this chapter go?'}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: TEXT_BODY, opacity: 0.7 }}>A line or two closes it in your own words.</div>
        </button>
      ))}
    </div>
  );
}
