// JournalDesktop — the corpus as one stream.
//
// Everything you've written, newest first: sessions, notes, the intentions
// you declared, the belts you tied on. One river, told apart by a small
// type label. The search field runs against your own words; the chips
// narrow in place and never split the page into silos.
//
// No Intentions chip, deliberately — intentions are structure, not a
// content type, and their copper rows in the stream are the affordance.
//
// Right: the year scrubber. Below 1250px it collapses under the stream as
// a horizontal band, because the prose column never gets squeezed — words
// win the space fight.
//
// The merge itself lives in lib/journalStream.ts, where it can be tested.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PromotionEntrySheet from './belt/PromotionEntrySheet.tsx';
import { api } from '../lib/api.ts';
import { toast } from '../hooks/use-toast.ts';
import {
  buildStream, filterStream, groupByMonth, yearBlocks, typeLabel,
  type StreamChip, type StreamItem,
} from '../lib/journalStream.ts';
import { COPPER, PALE_YELLOW, SAGE, FONT_EDITORIAL, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY, TEXT_HINT } from '../lib/theme.ts';
import type {
  BeltHistoryEntry, Intention, SessionSummary, TrainingNote,
} from '../types/api.ts';

const HAIRLINE       = 'rgba(255,255,255,0.06)';

const CHIPS: StreamChip[] = ['All', 'Sessions', 'Notes'];

/** Copper records, sage is for sessions, neutral for a loose note. */
const LABEL_COLOR: Record<StreamItem['kind'], string> = {
  session: SAGE,
  note: 'rgba(255,255,255,0.5)',
  intention: COPPER,
  promotion: COPPER,
};

function dateParts(dateKey: string): { day: string; weekday: string } {
  const d = new Date(dateKey + 'T00:00:00');
  return {
    day: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d),
    weekday: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d),
  };
}

function SearchIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" style={{ flex: 'none' }}>
      <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
    </svg>
  );
}

interface Props {
  sessions: SessionSummary[];
  notes: TrainingNote[];
  intentions: Intention[];
  promotions: BeltHistoryEntry[];
  activeIntention: Intention | null;
  academy?: string | null;
  /** Opens a session row. Desktop routes to /journal/:id. */
  onOpenSession: (session: SessionSummary) => void;
  /** A promotion's words were saved — the parent refetches belt history. */
  onPromotionSaved?: () => void;
}

export default function JournalDesktop({
  sessions, notes, intentions, promotions, activeIntention, academy, onOpenSession, onPromotionSaved,
}: Props) {
  const navigate = useNavigate();
  const [chip, setChip] = useState<StreamChip>('All');
  const [query, setQuery] = useState('');

  const stream = useMemo(
    () => buildStream({ sessions, notes, intentions, promotions, activeIntention, academy }),
    [sessions, notes, intentions, promotions, activeIntention, academy],
  );
  const visible = useMemo(() => filterStream(stream, chip, query), [stream, chip, query]);
  const months  = useMemo(() => groupByMonth(visible), [visible]);
  // The scrubber describes the whole corpus, not the current filter — it is
  // how you leave where you are, so it must not shrink as you search.
  const years   = useMemo(() => yearBlocks(stream), [stream]);

  // A promotion row opens its own entry: prose only, no training fields.
  const [openPromotion, setOpenPromotion] = useState<BeltHistoryEntry | null>(null);
  const [savingPromotion, setSavingPromotion] = useState(false);
  const savePromotion = async (id: string, text: string) => {
    setSavingPromotion(true);
    try {
      await api.patch(`/api/belt-history/${id}`, { notes: text || null });
      setOpenPromotion(null);
      onPromotionSaved?.();
    } catch {
      toast({ title: 'Could not save that entry.', variant: 'destructive' });
    } finally {
      setSavingPromotion(false);
    }
  };

  const openItem = (item: StreamItem) => {
    if (item.kind === 'session' && item.session) { onOpenSession(item.session); return; }
    if (item.kind === 'promotion' && item.promotion) { setOpenPromotion(item.promotion); return; }
    if (item.href) navigate(item.href);
  };

  return (
    <div className="j2-desk-page">
      <div className="j2-journal-body">
        {/* ── The stream ──────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: TEXT_TERTIARY }}>
            Journal
          </div>
          <h1
            style={{
              fontFamily: FONT_EDITORIAL, fontSize: 33, fontWeight: 600,
              color: PALE_YELLOW, letterSpacing: '-0.01em', margin: '8px 0 0',
            }}
          >
            Everything you’ve written
          </h1>

          {/* Search */}
          <label
            style={{
              marginTop: 22, height: 44,
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
              display: 'flex', alignItems: 'center', gap: 9, padding: '0 15px',
              color: TEXT_HINT,
            }}
          >
            <SearchIcon />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search your own words — positions, partners, notes…"
              aria-label="Search your journal"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: TEXT_PRIMARY, fontSize: 13.5, fontFamily: 'inherit',
              }}
            />
          </label>

          {/* Chips */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {CHIPS.map(c => {
              const on = chip === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChip(c)}
                  aria-pressed={on}
                  style={{
                    height: 32, padding: '0 14px', borderRadius: 17,
                    border: on ? '1px solid transparent' : '1px solid rgba(255,255,255,0.1)',
                    background: on ? 'rgba(196,145,95,0.9)' : 'transparent',
                    color: on ? '#12130e' : TEXT_SECONDARY,
                    fontSize: 11.5, fontWeight: 700,
                    whiteSpace: 'nowrap', cursor: 'pointer',
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>

          {/* Rows */}
          {months.length === 0 ? (
            <div style={{ marginTop: 40, fontFamily: FONT_EDITORIAL, fontStyle: 'italic', color: TEXT_TERTIARY, fontSize: 17 }}>
              Nothing written matches that — yet.
            </div>
          ) : (
            months.map(group => (
              <div key={group.key}>
                <div
                  style={{
                    fontFamily: FONT_EDITORIAL, fontSize: 19, fontWeight: 600,
                    color: PALE_YELLOW, margin: '30px 0 4px',
                  }}
                >
                  {group.month}
                </div>
                {group.items.map(item => {
                  const { day, weekday } = dateParts(item.dateKey);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openItem(item)}
                      className="j2-journal-row"
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 18,
                        width: '100%', textAlign: 'left',
                        padding: '16px 0',
                        borderTop: `1px solid ${HAIRLINE}`,
                        background: 'none', border: 'none',
                        borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: HAIRLINE,
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ width: 88, flex: 'none', lineHeight: 1.15 }}>
                        <span style={{ display: 'block', fontFamily: FONT_EDITORIAL, fontSize: 19, color: SAGE, whiteSpace: 'nowrap' }}>
                          {day}
                        </span>
                        <span
                          style={{
                            display: 'block', fontSize: 10, fontWeight: 700,
                            letterSpacing: '0.1em', textTransform: 'uppercase',
                            color: TEXT_TERTIARY, marginTop: 3,
                          }}
                        >
                          {weekday}
                        </span>
                      </span>

                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: 'block', fontSize: 9.5, fontWeight: 700,
                            letterSpacing: '0.12em', textTransform: 'uppercase',
                            color: LABEL_COLOR[item.kind], marginBottom: 6,
                          }}
                        >
                          {typeLabel(item)}
                        </span>
                        <span
                          className="j2-journal-x"
                          style={{
                            display: 'block',
                            fontFamily: FONT_EDITORIAL, fontSize: 17, lineHeight: 1.5,
                            color: TEXT_SECONDARY, maxWidth: 560, textWrap: 'pretty',
                          }}
                        >
                          {item.text}{item.truncated && <span style={{ color: TEXT_TERTIARY }}> …</span>}
                        </span>
                      </span>

                      {item.meta.length > 0 && (
                        <span
                          style={{
                            width: 120, flex: 'none', textAlign: 'right',
                            fontSize: 11, color: TEXT_TERTIARY, lineHeight: 1.6, paddingTop: 3,
                          }}
                        >
                          {item.meta.map((m, i) => <span key={i} style={{ display: 'block' }}>{m}</span>)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* ── The year scrubber ───────────────────────────────────── */}
        <div className="j2-journal-scrub">
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: TEXT_TERTIARY, marginBottom: 12 }}>
            The years
          </div>
          {years.map(y => (
            <div key={y.year} style={{ padding: '16px 0', borderTop: `1px solid ${HAIRLINE}` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <b style={{ fontFamily: FONT_EDITORIAL, fontSize: 21, color: PALE_YELLOW, fontWeight: 600 }}>{y.year}</b>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: TEXT_TERTIARY }}>
                  {y.range}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 2.5, marginTop: 10, height: 18, alignItems: 'flex-end' }} aria-hidden>
                {y.ticks.map((t, i) => (
                  <i
                    key={i}
                    style={{
                      flex: 1,
                      height: t === 0 ? 2 : Math.round(4 + t * 14),
                      background: 'rgba(196,145,95,0.55)',
                      borderRadius: 1,
                      opacity: t === 0 ? 0.25 : 0.8,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="j2-journal-scrubnote" style={{ fontSize: 11.5, color: TEXT_TERTIARY, lineHeight: 1.6, marginTop: 18, textWrap: 'pretty' }}>
            Imported years sit in the same stream. Density is drawn from entries, not hours.
          </div>
        </div>
      </div>

      <PromotionEntrySheet
        open={openPromotion !== null}
        promotion={openPromotion}
        academy={academy}
        saving={savingPromotion}
        onClose={() => setOpenPromotion(null)}
        onSave={(id, text) => { void savePromotion(id, text); }}
      />
    </div>
  );
}
