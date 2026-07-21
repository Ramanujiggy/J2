// ClassScheduleEditor — the habit-sentence pattern for editing one class slot.
// Pattern lifted from Atoms (Refero `665d…f4e1`): the schedule reads as a
// sentence with copper-underlined editable phrases.
//
//   "On  [Mon Wed Fri]  I train  [Tue Night BJJ]  at  [7:00 PM]  for  [90 min]."
//
// Each bracketed phrase opens an inline picker. Save commits to the backend.

import { useState } from 'react';
import {
  CARD_BG, CARD_GLOW, CARD_GLOW_BORDER, COPPER, COPPER_BORDER,
  PALE_YELLOW, SURFACE_2, SURFACE_2_BORDER, SURFACE_3, FONT_EDITORIAL,
} from '../lib/theme.ts';
import { DOW_LABELS_MIN, DOW_LABELS_SHORT, formatTime12, formatDurationMin } from '../lib/timeUtils.ts';
import type { ClassSchedule, ClassScheduleInput } from '../types/api.ts';

const DURATION_PRESETS = [60, 75, 90, 120];
const DAY_PRESETS: { label: string; days: number[] }[] = [
  { label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Weekdays', days: [1, 2, 3, 4, 5] },
  { label: 'Open mat days', days: [0, 6] },
];

type Phase = 'name' | 'days' | 'time' | 'duration' | null;

interface Props {
  initial?: ClassSchedule;
  /** When editing, days is locked to one value (existing rows are per-DOW).
   *  When creating, the user can multi-select and we POST one row per day. */
  isEdit: boolean;
  onSave: (rows: ClassScheduleInput[]) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel: () => void;
}

export default function ClassScheduleEditor({ initial, isEdit, onSave, onDelete, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? 'BJJ class');
  const [days, setDays] = useState<number[]>(initial ? [initial.day_of_week] : [1, 3, 5]);
  const [startTime, setStartTime] = useState((initial?.start_time ?? '19:00:00').slice(0, 5));
  const [duration, setDuration] = useState(initial?.duration_min ?? 90);
  const [editing, setEditing] = useState<Phase>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (d: number) => {
    if (isEdit) { setDays([d]); return; }
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b));
  };

  const applyPreset = (preset: number[]) => {
    if (isEdit) return;
    setDays(preset);
  };

  const handleSave = async () => {
    if (busy) return;
    if (name.trim().length === 0) { setError('Give the class a name.'); return; }
    if (days.length === 0) { setError('Pick at least one day.'); return; }
    setBusy(true); setError(null);
    try {
      const rows: ClassScheduleInput[] = days.map(d => ({
        name: name.trim(),
        day_of_week: d,
        start_time: startTime,
        duration_min: duration,
        gi_nogi: initial?.gi_nogi ?? null,
      }));
      await onSave(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setBusy(false);
    }
  };

  const daysSummary = days.length === 0
    ? 'pick days'
    : days.map(d => DOW_LABELS_SHORT[d]).join(' · ');

  return (
    <div
      style={{
        backgroundColor: CARD_BG,
        border: `1px solid ${CARD_GLOW_BORDER}`,
        boxShadow: CARD_GLOW,
        borderRadius: 18,
        padding: 24,
      }}
    >
      <p
        style={{
          fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: COPPER, marginBottom: 14,
        }}
      >
        ◇ {isEdit ? 'Edit class' : 'New class'}
      </p>

      {/* The habit sentence. Each <Phrase> is tap-to-edit. */}
      <div
        style={{
          fontFamily: FONT_EDITORIAL, fontSize: 22, lineHeight: 1.5,
          color: PALE_YELLOW, marginBottom: 20,
        }}
      >
        On <Phrase active={editing === 'days'} onClick={() => setEditing(p => p === 'days' ? null : 'days')}>{daysSummary}</Phrase>
        {' '}I train <Phrase active={editing === 'name'} onClick={() => setEditing(p => p === 'name' ? null : 'name')}>{name || '...'}</Phrase>
        {' '}at <Phrase active={editing === 'time'} onClick={() => setEditing(p => p === 'time' ? null : 'time')}>{formatTime12(startTime)}</Phrase>
        {' '}for <Phrase active={editing === 'duration'} onClick={() => setEditing(p => p === 'duration' ? null : 'duration')}>{formatDurationMin(duration)}</Phrase>.
      </div>

      {/* Inline editors */}
      {editing === 'days' && (
        <div style={{ marginBottom: 20 }}>
          {!isEdit && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {DAY_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p.days)}
                  style={{
                    padding: '6px 12px', borderRadius: 999, fontSize: 12,
                    background: SURFACE_2, border: `1px solid ${SURFACE_2_BORDER}`,
                    color: 'rgba(242,228,168,0.7)', cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {DOW_LABELS_MIN.map((l, idx) => {
              const active = days.includes(idx);
              return (
                <button
                  key={idx}
                  onClick={() => toggleDay(idx)}
                  aria-label={DOW_LABELS_SHORT[idx]}
                  style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: active ? PALE_YELLOW : 'transparent',
                    border: `1px solid ${active ? PALE_YELLOW : COPPER_BORDER}`,
                    color: active ? CARD_BG : 'rgba(242,228,168,0.6)',
                    fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {editing === 'name' && (
        <div style={{ marginBottom: 20 }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={120}
            autoFocus
            placeholder="Tue Night BJJ"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 10,
              background: SURFACE_3, border: `1px solid ${COPPER_BORDER}`,
              color: PALE_YELLOW, fontSize: 14, outline: 'none',
            }}
          />
        </div>
      )}

      {editing === 'time' && (
        <div style={{ marginBottom: 20 }}>
          <input
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: 10,
              background: SURFACE_3, border: `1px solid ${COPPER_BORDER}`,
              color: PALE_YELLOW, fontSize: 14, colorScheme: 'dark', outline: 'none',
            }}
          />
        </div>
      )}

      {editing === 'duration' && (
        <div style={{ marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DURATION_PRESETS.map(d => {
            const active = duration === d;
            return (
              <button
                key={d}
                onClick={() => setDuration(d)}
                style={{
                  padding: '8px 14px', borderRadius: 10, fontSize: 13,
                  background: active ? COPPER : SURFACE_2,
                  color: active ? '#fff' : 'rgba(242,228,168,0.7)',
                  border: `1px solid ${active ? COPPER_BORDER : SURFACE_2_BORDER}`,
                  cursor: 'pointer',
                }}
              >
                {formatDurationMin(d)}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p style={{ color: 'rgba(255,140,120,0.9)', fontSize: 13, marginBottom: 14 }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        {isEdit && onDelete ? (
          <button
            onClick={onDelete}
            style={{
              background: 'transparent', color: 'rgba(255,140,120,0.7)',
              fontSize: 13, padding: '8px 4px', cursor: 'pointer',
              borderBottom: '1px solid transparent',
            }}
          >
            Delete
          </button>
        ) : <span />}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent', color: 'rgba(242,228,168,0.55)',
              fontSize: 13, padding: '8px 4px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            style={{
              backgroundColor: COPPER, color: '#fff',
              fontSize: 14, fontWeight: 600, borderRadius: 12, padding: '10px 18px',
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PhraseProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function Phrase({ active, onClick, children }: PhraseProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        color: PALE_YELLOW,
        fontFamily: FONT_EDITORIAL,
        fontSize: 'inherit',
        padding: '0 4px',
        borderBottom: `1.5px solid ${active ? COPPER : 'rgba(196,145,95,0.45)'}`,
        cursor: 'pointer',
        lineHeight: 1.2,
      }}
    >
      {children}
    </button>
  );
}
