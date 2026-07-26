// HomeEntryList — the last three things you wrote.
//
// A row is a date and a sentence. There is no seal indicator of any kind:
// dies are multi-coloured objects, so any list-scale treatment either lies
// about the colour or shrinks to a smudge — and reserving an empty slot for
// an unearned seal reintroduces the achievement-checklist feeling that
// removing the streak was meant to eliminate. Discovering a seal is part of
// opening the entry.
//
// Sessions with no notes still get a row. Without them the list silently
// drops training days and stops being a truthful record of the week.

import { useNavigate } from 'react-router-dom';
import { FONT_EDITORIAL, SAGE, BRAND_ORANGE } from '../lib/theme.ts';
import type { RecentEntry } from '../lib/homeViewModel.ts';
import type { SessionSummary } from '../types/api.ts';

const ROW_BORDER = '1px solid rgba(255,255,255,0.06)';

interface Props {
  entries: RecentEntry[];
  totalCount: number;
  onEntryTap: (session: SessionSummary) => void;
}

function dateParts(session: SessionSummary): { day: string; weekday: string } {
  const key = typeof session.date === 'string' ? session.date.slice(0, 10) : session.date;
  const d = new Date(key + 'T00:00:00');
  return {
    day: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d),
    weekday: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(d),
  };
}

export default function HomeEntryList({ entries, totalCount, onEntryTap }: Props) {
  const navigate = useNavigate();
  if (entries.length === 0) return null;

  return (
    <div>
      {entries.map(({ session, excerpt }) => {
        const { day, weekday } = dateParts(session);
        return (
          <button
            key={session.id}
            type="button"
            onClick={() => onEntryTap(session)}
            className="j2-press"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              width: '100%',
              minHeight: 44,
              padding: '16px 0',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              borderTop: ROW_BORDER,
              cursor: 'pointer',
            }}
          >
            {/* Sage is spent here and nowhere else — it is what makes the list
                read as journal pages rather than table rows. */}
            <span style={{ width: 84, flex: 'none', lineHeight: 1.15 }}>
              <span
                style={{
                  display: 'block',
                  fontFamily: FONT_EDITORIAL,
                  fontSize: 19,
                  color: SAGE,
                  whiteSpace: 'nowrap',
                }}
              >
                {day}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.46)',
                  marginTop: 3,
                }}
              >
                {weekday}
              </span>
            </span>

            <span
              style={{
                flex: 1,
                fontFamily: FONT_EDITORIAL,
                fontSize: 16.5,
                lineHeight: 1.45,
                color: excerpt ? 'rgba(255,255,255,0.66)' : 'rgba(255,255,255,0.46)',
                fontStyle: excerpt ? 'normal' : 'italic',
                textWrap: 'pretty',
              }}
            >
              {excerpt ?? 'No notes yet'}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => navigate('/journal')}
        style={{
          display: 'block',
          width: '100%',
          minHeight: 44,
          textAlign: 'center',
          padding: '16px 0 0',
          fontSize: 13.5,
          fontWeight: 600,
          color: BRAND_ORANGE,
          borderTop: ROW_BORDER,
          background: 'none',
          cursor: 'pointer',
        }}
      >
        All {totalCount} {totalCount === 1 ? 'entry' : 'entries'} →
      </button>
    </div>
  );
}
