import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.ts';
import { PALE_YELLOW, GLOW_SOFT, COPPER_BORDER, SURFACE_2, SURFACE_3, COPPER } from '../lib/theme.ts';
import { vibrate } from '../lib/haptics.ts';
import PillarPrism from './PillarPrism.tsx';
import SegmentedToggle from './SegmentedToggle.tsx';
import type { Intention } from '../types/api.ts';

const DURATION_OPTIONS: { value: string; label: string }[] = [
  { value: '3',  label: '3d' },
  { value: '5',  label: '5d' },
  { value: '7',  label: '7d' },
  { value: '14', label: '14d' },
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
  const isEdit = !!editIntention;

  const [heading,      setHeading]      = useState<string | null>(editIntention?.heading ?? null);
  const [label,        setLabel]        = useState(editIntention?.intent_label ?? '');
  const [durationDays, setDurationDays] = useState<number>(editIntention?.duration_days ?? 7);
  const [writeJournal, setWriteJournal] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  const charsLeft = 20 - label.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!heading) {
      setError('Tap a vertex on the Prism to set your focus.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await api.patch<IntentionResponse>(`/api/intentions/${editIntention!.id}`, {
          intent_label:  label.trim() || undefined,
          heading,
          duration_days: durationDays,
        });
        onSaved();
        onClose();
      } else {
        const res = await api.post<IntentionResponse>('/api/intentions', {
          intent_label:  label.trim() || undefined,
          heading,
          week_start:    todayStr(),
          duration_days: durationDays,
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
        backgroundColor: 'rgba(13, 26, 20, 0.97)',
        backdropFilter: 'blur(16px)',
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm rounded-2xl overflow-hidden animate-j2-modal-in"
        style={{
          backgroundColor: '#152E22',
          border: `1px solid ${COPPER_BORDER}`,
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
            {isEdit ? 'Edit your focus' : 'Set your focus'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── Focus card ───────────────────────────────── */}
            <div className="rounded-xl px-4 py-4 space-y-4" style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Tap a vertex to declare what you're working on.
              </p>

              <PillarPrism
                heading={heading}
                resonance={heading ? 10 : null}
                defaultHeading={editIntention?.heading ?? undefined}
                snapOnly
                onSelect={(h, _r, _w) => { setHeading(h); setError(''); }}
              />

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

            {/* ── Duration card ─────────────────────────────── */}
            <div className="rounded-xl px-4 py-4 space-y-3" style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Duration
              </span>

              <SegmentedToggle
                options={DURATION_OPTIONS}
                value={String(durationDays)}
                onChange={v => { if (v) setDurationDays(Number(v)); }}
              />

              <p className="text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.22)' }}>
                How long to hold this focus
              </p>
            </div>

            {/* ── Journal toggle (create only) ──────────────── */}
            {!isEdit && (
              <button
                type="button"
                onClick={() => { vibrate(8); setWriteJournal(v => !v); }}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 transition-colors touch-manipulation"
                style={{
                  backgroundColor: writeJournal ? 'rgba(196,145,95,0.08)' : SURFACE_2,
                  border: writeJournal ? '1px solid rgba(196,145,95,0.25)' : '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div
                  className="w-11 h-6 rounded-full relative flex-shrink-0 transition-colors"
                  style={{ backgroundColor: writeJournal ? COPPER : 'rgba(255,255,255,0.10)' }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                    style={{ transform: writeJournal ? 'translateX(22px)' : 'translateX(2px)' }}
                  />
                </div>
                <span className="text-sm" style={{ color: writeJournal ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.40)' }}>
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
