import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.ts';
import { PALE_YELLOW, GLOW_SOFT, SURFACE_2, SURFACE_3, COPPER } from '../lib/theme.ts';
import { vibrate } from '../lib/haptics.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import FocusAreaChips from './FocusAreaChips.tsx';
import PrismShape from './PrismShape.tsx';
import SegmentedToggle from './SegmentedToggle.tsx';
import type { ChipSelection } from '../lib/selectionsToDistribution.ts';
import type { Intention, IntentionCompletionType, Pillar } from '../types/api.ts';

const DURATION_OPTIONS: { value: string; label: string }[] = [
  { value: '3',  label: '3d' },
  { value: '5',  label: '5d' },
  { value: '7',  label: '7d' },
  { value: '14', label: '14d' },
];

const COMPLETION_MODE_OPTIONS: { value: IntentionCompletionType; label: string }[] = [
  { value: 'days',           label: 'Days'     },
  { value: 'sessions',       label: 'Sessions' },
  { value: 'training_weeks', label: 'Weeks'    },
];

const SESSION_TARGET_OPTIONS: { value: string; label: string }[] = [
  { value: '3',  label: '3'  },
  { value: '4',  label: '4'  },
  { value: '6',  label: '6'  },
  { value: '8',  label: '8'  },
  { value: '12', label: '12' },
];

const TRAINING_WEEK_TARGET_OPTIONS: { value: string; label: string }[] = [
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '6', label: '6' },
  { value: '8', label: '8' },
];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  onSaved: () => void;
  onClose: () => void;
  editIntention?: Intention;
}

interface IntentionResponse {
  message: string;
  intention: { id: string; intent_label: string; heading: string | null };
}

export default function SetIntentionModal({ onSaved, onClose, editIntention }: Props) {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const isEdit = !!editIntention;

  const initialSelections: ChipSelection[] = editIntention?.heading
    ? [{ pillar: editIntention.heading as Pillar, primary: true, deep_work: false }]
    : [];
  const [selections, setSelections] = useState<ChipSelection[]>(initialSelections);
  const heading = selections.find(s => s.primary)?.pillar ?? null;
  const [label,        setLabel]        = useState(editIntention?.intent_label ?? '');
  const [durationDays, setDurationDays] = useState<number>(editIntention?.duration_days ?? 7);
  // Completion mode (mig 034). 'days' is the legacy default; 'sessions' and
  // 'training_weeks' use target_count instead of (or as a soft cap alongside)
  // duration_days. We track them as separate state so flipping mode
  // preserves the user's recent target picks.
  const [completionType, setCompletionType] = useState<IntentionCompletionType>(
    editIntention?.completion_type ?? 'days',
  );
  const [sessionTarget, setSessionTarget] = useState<number>(
    editIntention?.completion_type === 'sessions' && editIntention?.target_count
      ? editIntention.target_count
      : 4,
  );
  const [trainingWeekTarget, setTrainingWeekTarget] = useState<number>(
    editIntention?.completion_type === 'training_weeks' && editIntention?.target_count
      ? editIntention.target_count
      : 3,
  );
  const [writeJournal, setWriteJournal] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  const charsLeft = 20 - label.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!heading) {
      setError('Tap a focus area to set your intention.');
      return;
    }
    setSaving(true);
    setError('');
    // Build the completion-mode payload. For 'days' mode, target_count is
    // null. For 'sessions'/'training_weeks', duration_days serves as a soft
    // calendar ceiling that the server defaults if we omit it.
    const targetCount = completionType === 'sessions'
      ? sessionTarget
      : completionType === 'training_weeks'
        ? trainingWeekTarget
        : null;
    try {
      if (isEdit) {
        await api.patch<IntentionResponse>(`/api/intentions/${editIntention!.id}`, {
          intent_label:    label.trim() || undefined,
          heading,
          duration_days:   durationDays,
          completion_type: completionType,
          target_count:    targetCount,
        });
        onSaved();
        onClose();
      } else {
        const res = await api.post<IntentionResponse>('/api/intentions', {
          intent_label:    label.trim() || undefined,
          heading,
          week_start:      todayStr(),
          duration_days:   durationDays,
          completion_type: completionType,
          target_count:    targetCount,
        });
        onSaved();
        if (writeJournal && res.intention?.id) {
          navigate(`/intentions/${res.intention.id}/journal`);
        } else {
          onClose();
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save intention.');
      setSaving(false);
    }
  };

  return (
    <div
      data-no-page-swipe=""
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4"
      style={{
        backgroundColor: 'rgba(13, 26, 20, 1)',
        backdropFilter: 'blur(16px)',
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm md:max-w-lg lg:max-w-2xl xl:max-w-3xl 2xl:max-w-4xl rounded-2xl overflow-hidden animate-j2-modal-in"
        style={{
          backgroundColor: '#152E22',
          border: '1px solid rgba(255,255,255,0.10)',
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className={isDesktop ? 'p-10 space-y-5' : 'p-5 space-y-4'}>
          {isDesktop ? (
            <div>
              <div className="j2-label-copper" style={{ marginBottom: 8 }}>
                ◇ {isEdit ? 'Edit your focus' : "Set this week's focus"}
              </div>
              <h2
                className="j2-serif-display"
                style={{ fontSize: 34, margin: 0, lineHeight: 1.1 }}
              >
                What do you want to work on this week?
              </h2>
            </div>
          ) : (
            <h2 className="text-lg font-display font-semibold" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
              {isEdit ? 'Edit your focus' : 'Set your focus'}
            </h2>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── Focus card ───────────────────────────────── */}
            <div className="rounded-xl px-4 py-4 space-y-4" style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Tap a focus area to declare what you're working on.
              </p>

              {/* Pokedex layout: chips on the left, live Prism shape on the right. */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <FocusAreaChips
                    selections={selections}
                    onChange={s => { setSelections(s); setError(''); }}
                    mode="single"
                  />
                </div>
                <div style={{ flex: '0 0 auto', opacity: 0.95 }}>
                  <PrismShape selections={selections} size={isDesktop ? 160 : 130} showLabels={false} />
                </div>
              </div>

              {/* Optional label */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs" style={{ color: 'rgba(255,255,255,0.40)' }}>
                    What specifically? <span style={{ color: 'rgba(255,255,255,0.20)' }}>(optional)</span>
                  </label>
                  {label.length > 0 && (
                    <span className="text-[11px]" style={{ color: charsLeft < 5 ? COPPER : 'rgba(255,255,255,0.25)' }}>
                      {charsLeft}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  maxLength={20}
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Half guard sweeps"
                  className="w-full border rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 outline-none transition-colors"
                  style={{ backgroundColor: SURFACE_3, borderColor: 'rgba(255,255,255,0.08)' }}
                />
              </div>
            </div>

            {/* ── Completion mode card ────────────────────────
                  Mig 034: intentions can complete via calendar days,
                  session count, or distinct training weeks. The first
                  toggle picks the mode; the inner control picks the
                  target. Days are the legacy default. */}
            <div className="rounded-xl px-4 py-4 space-y-3" style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Completes after
              </span>

              <SegmentedToggle
                options={COMPLETION_MODE_OPTIONS}
                value={completionType}
                onChange={v => { if (v) setCompletionType(v as IntentionCompletionType); }}
              />

              {completionType === 'days' && (
                <>
                  <SegmentedToggle
                    options={DURATION_OPTIONS}
                    value={String(durationDays)}
                    onChange={v => { if (v) setDurationDays(Number(v)); }}
                  />
                  <p className="text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    How long to hold this focus
                  </p>
                </>
              )}

              {completionType === 'sessions' && (
                <>
                  <SegmentedToggle
                    options={SESSION_TARGET_OPTIONS}
                    value={String(sessionTarget)}
                    onChange={v => { if (v) setSessionTarget(Number(v)); }}
                  />
                  <p className="text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    Sessions touching this focus — missed days don't count against you
                  </p>
                </>
              )}

              {completionType === 'training_weeks' && (
                <>
                  <SegmentedToggle
                    options={TRAINING_WEEK_TARGET_OPTIONS}
                    value={String(trainingWeekTarget)}
                    onChange={v => { if (v) setTrainingWeekTarget(Number(v)); }}
                  />
                  <p className="text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    Distinct weeks containing training — a week off pauses the clock
                  </p>
                </>
              )}
            </div>

            {/* ── Journal toggle (create only) ──────────────── */}
            {!isEdit && (
              <button
                type="button"
                onClick={() => { vibrate(8); setWriteJournal(v => !v); }}
                className="w-full rounded-xl transition-colors touch-manipulation"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                  backgroundColor: writeJournal ? 'rgba(196,145,95,0.08)' : SURFACE_2,
                  border: writeJournal ? '1px solid rgba(196,145,95,0.25)' : '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    position: 'relative',
                    flex: '0 0 auto',
                    width: 44,
                    height: 24,
                    borderRadius: 999,
                    backgroundColor: writeJournal ? COPPER : 'rgba(255,255,255,0.10)',
                    transition: 'background-color 180ms ease',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: 2,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: '#fff',
                      transform: writeJournal ? 'translateX(20px)' : 'translateX(0)',
                      transition: 'transform 180ms ease',
                    }}
                  />
                </span>
                <span
                  className="text-sm"
                  style={{ color: writeJournal ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.40)' }}
                >
                  Write a journal entry
                </span>
              </button>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}

            {/* ── Action row ────────────────────────────────── */}
            <div
              className="flex items-center gap-3 pt-2"
              style={{ borderTop: '1px solid rgba(196,145,95,0.12)' }}
            >
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 text-sm font-medium transition-colors touch-manipulation"
                style={{ color: 'rgba(255,255,255,0.40)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !heading}
                className="flex-1 text-white font-semibold rounded-xl transition-all touch-manipulation disabled:opacity-40"
                style={{
                  height: 52,
                  backgroundColor: '#DA7422',
                  boxShadow: '0 2px 12px rgba(218,116,34,0.25)',
                  fontSize: 16,
                }}
              >
                {saving
                  ? (isEdit ? 'Updating...' : 'Setting...')
                  : isEdit
                    ? 'Update Focus'
                    : writeJournal ? 'Set & Write' : 'Set Focus'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
