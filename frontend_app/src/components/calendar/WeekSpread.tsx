import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { api } from '../../lib/api.ts';
import {
  CARD_BG, COPPER, COPPER_BORDER, FONT_EDITORIAL, INT_LABELS, PALE_YELLOW,
  SURFACE_2_BORDER, TEXT_HINT, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY, WHISPER_BORDER,
} from '../../lib/theme.ts';
import { MONTH_FULL, excerpt, formatHours, noteOf, pillarLabel, shiftDays, totalMinutes } from '../../lib/calendarBook.ts';
import { sessionDateKey } from '../../lib/analyticsUtils.ts';
import { SESSION_TYPE_LABELS, formatDuration, formatGiNogi } from '../../lib/sessionUtils.ts';
import type { SessionSummary, SessionsResponse } from '../../types/api.ts';
import SessionDetailModal from '../SessionDetailModal.tsx';
import { formatDay, intensityColor } from './marks.tsx';

interface Props {
  monday: string;
  sessions: SessionSummary[];
  todayStr: string;
  backLabel: string;
  onBack: () => void;
  onMoveWeek: (monday: string) => void;
  onLogSession: (dateKey: string) => void;
  onSessionUpdated: () => void;
}

export default function WeekSpread({ monday, sessions, todayStr, backLabel, onBack, onMoveWeek, onLogSession, onSessionUpdated }: Props) {
  const sunday = shiftDays(monday, 6);
  const [selected, setSelected] = useState<SessionSummary | null>(null);
  const [yearAgo, setYearAgo] = useState<SessionSummary[]>([]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const key = shiftDays(monday, i);
    return { key, sessions: sessions.filter(s => sessionDateKey(s) === key) };
  }), [monday, sessions]);
  const weekSessions = days.flatMap(d => d.sessions);

  // The same week a year ago (364 days keeps the weekdays aligned)
  useEffect(() => {
    let cancelled = false;
    setYearAgo([]);
    const from = shiftDays(monday, -364);
    api.get<SessionsResponse>(`/api/sessions?from=${from}&to=${shiftDays(from, 6)}`)
      .then(res => { if (!cancelled) setYearAgo(res.sessions ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [monday]);

  const yearAgoWritten = yearAgo.find(s => noteOf(s));
  const navButton = {
    width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: 'none', padding: 0, color: TEXT_TERTIARY, cursor: 'pointer',
  } as const;
  const sameMonth = monday.slice(5, 7) === sunday.slice(5, 7);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button
          onClick={onBack}
          className="touch-manipulation"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44, minWidth: 0, padding: 0, background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: TEXT_TERTIARY, cursor: 'pointer' }}
        >
          <ChevronLeft size={16} style={{ flexShrink: 0 }} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{backLabel}</span>
        </button>
        <div style={{ display: 'flex', flexShrink: 0 }}>
          <button onClick={() => onMoveWeek(shiftDays(monday, -7))} className="touch-manipulation" style={navButton} aria-label="Previous week">
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => onMoveWeek(shiftDays(monday, 7))}
            disabled={shiftDays(monday, 7) > todayStr}
            className="touch-manipulation"
            style={{ ...navButton, opacity: shiftDays(monday, 7) > todayStr ? 0.3 : 1 }}
            aria-label="Next week"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <header style={{ marginTop: -6 }}>
        <h1 style={{ margin: 0, fontFamily: FONT_EDITORIAL, fontSize: 32, fontWeight: 500, lineHeight: 1.1, color: PALE_YELLOW }}>
          {sameMonth
            ? `${Number(monday.slice(8))} – ${Number(sunday.slice(8))} ${MONTH_FULL[Number(sunday.slice(5, 7)) - 1]}`
            : `${Number(monday.slice(8))} ${formatDay(monday, { month: 'short' })} – ${Number(sunday.slice(8))} ${formatDay(sunday, { month: 'short' })}`}
        </h1>
        <div style={{ marginTop: 6, fontSize: 12, color: TEXT_TERTIARY }}>
          {weekSessions.length === 0
            ? 'A week of rest'
            : `${weekSessions.length} session${weekSessions.length !== 1 ? 's' : ''} · ${formatHours(totalMinutes(weekSessions))}`}
        </div>
      </header>

      <section aria-label="Days">
        {days.map(day => {
          const date = new Date(day.key + 'T00:00:00');
          const isFuture = day.key > todayStr;
          const isToday = day.key === todayStr;
          return (
            <div key={day.key} style={{ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr)', columnGap: 12, padding: '14px 0', borderTop: `1px solid ${SURFACE_2_BORDER}` }}>
              <div>
                <div style={{ fontFamily: FONT_EDITORIAL, fontSize: 24, fontWeight: 500, lineHeight: 1, color: day.sessions.length > 0 ? PALE_YELLOW : isToday ? COPPER : TEXT_HINT }}>
                  {date.getDate()}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: isToday ? COPPER : TEXT_HINT, marginTop: 3 }}>
                  {isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
              </div>
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {day.sessions.map(s => {
                  const note = noteOf(s);
                  const focus = pillarLabel(s.tags?.[0]) ?? 'Open rolling';
                  const meta = [
                    SESSION_TYPE_LABELS[s.session_type] ?? s.session_type,
                    formatGiNogi(s.gi_nogi),
                    formatDuration(Number(s.duration) || 0),
                    INT_LABELS[Math.max(1, Math.min(5, Number(s.intensity) || 3))]?.toLowerCase(),
                  ].filter(Boolean).join(' · ');
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelected(s)}
                      className="touch-manipulation"
                      style={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 12, padding: '12px 14px', backgroundColor: CARD_BG, border: 'none', boxShadow: WHISPER_BORDER, cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, backgroundColor: intensityColor(s.intensity) }} />
                        <span style={{ fontSize: 11, color: TEXT_TERTIARY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>{focus}</div>
                      {note ? (
                        <p style={{ margin: '4px 0 0', fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 16, lineHeight: 1.4, color: TEXT_SECONDARY }}>
                          {excerpt(note, 240)}
                        </p>
                      ) : (
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: TEXT_HINT }}>Nothing written. Tap to add a line.</p>
                      )}
                    </button>
                  );
                })}
                {day.sessions.length === 0 && (isFuture ? (
                  <div style={{ minHeight: 28 }} />
                ) : (
                  <button
                    onClick={() => onLogSession(day.key)}
                    className="touch-manipulation"
                    aria-label={`Log a session on ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, margin: '-8px 0', padding: 0, background: 'none', border: 'none', fontSize: 13, color: TEXT_HINT, cursor: 'pointer' }}
                  >
                    {isToday ? 'Nothing yet today' : 'Rest'}
                    <Plus size={15} style={{ opacity: 0.6 }} />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {yearAgo.length > 0 && (
        <section style={{ borderRadius: 16, padding: '16px 18px', boxShadow: `inset 0 0 0 1px ${COPPER_BORDER}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: COPPER, marginBottom: 6 }}>
            A year ago this week
          </div>
          {yearAgoWritten ? (
            <>
              <p style={{ margin: 0, fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 17, lineHeight: 1.4, color: TEXT_SECONDARY }}>
                “{excerpt(noteOf(yearAgoWritten), 200)}”
              </p>
              <div style={{ marginTop: 6, fontSize: 11, color: TEXT_TERTIARY }}>
                {formatDay(sessionDateKey(yearAgoWritten), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: TEXT_SECONDARY }}>
              {yearAgo.length} session{yearAgo.length !== 1 ? 's' : ''}, nothing written.
            </p>
          )}
        </section>
      )}

      {selected && (
        <SessionDetailModal
          session={selected}
          date={new Date(sessionDateKey(selected) + 'T00:00:00')}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); onSessionUpdated(); }}
          onDeleted={() => { setSelected(null); onSessionUpdated(); }}
        />
      )}
    </div>
  );
}
