import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.ts';
import { PALE_YELLOW, GLOW_SOFT, SURFACE_2, SURFACE_3, COPPER } from '../lib/theme.ts';
import PillarPrism from './PillarPrism.tsx';
import type { Intention } from '../types/api.ts';

const DURATION_OPTIONS = [3, 5, 7, 14] as const;

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
          intent_label:    label.trim() || undefined,
          heading,
          duration_days:   durationDays,
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
        className="w-full sm:max-w-sm rounded-2xl p-5 animate-j2-modal-in"
        style={{
          backgroundColor: '#152E22',
          border: '1px solid rgba(196,145,95,0.45)',
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold mb-1" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
          {isEdit ? 'Edit your focus' : 'Set your focus'}
        </h2>
        <p className="text-xs text-white/40 mb-4">
          Tap a vertex to declare what you're working on.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Prism — snap-only mode for intention setting */}
          <PillarPrism
            heading={heading}
            resonance={heading ? 10 : null}
            defaultHeading={editIntention?.heading ?? undefined}
            snapOnly
            onSelect={(h, _r, _w) => { setHeading(h); setError(''); }}
          />

          {/* Optional label — flavor text for specificity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-white/50">
                What specifically? <span className="text-white/25">(optional)</span>
              </label>
              {label.length > 0 && (
                <span className={`text-[11px] ${charsLeft < 5 ? 'text-brand-orange' : 'text-white/25'}`}>
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
              className="w-full border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/25 outline-none focus:border-white/25"
              style={{ backgroundColor: SURFACE_2 }}
            />
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs text-white/50 block mb-1.5">Duration</label>
            <div className="flex gap-1.5">
              {DURATION_OPTIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDurationDays(d)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors touch-manipulation"
                  style={{
                    backgroundColor: durationDays === d ? COPPER : SURFACE_3,
                    color: durationDays === d ? '#fff' : 'rgba(255,255,255,0.45)',
                  }}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Journal toggle — create mode only */}
          {!isEdit && (
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div
                onClick={() => setWriteJournal(v => !v)}
                className="w-9 h-5 rounded-full relative transition-colors flex-shrink-0"
                style={{ backgroundColor: writeJournal ? COPPER : 'rgba(255,255,255,0.1)' }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                  style={{ transform: writeJournal ? 'translateX(18px)' : 'translateX(2px)' }}
                />
              </div>
              <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors">
                Write a journal entry
              </span>
            </label>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* CTA */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm text-white/40 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !heading}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40"
              style={{ backgroundColor: '#DA7422' }}
            >
              {saving
                ? (isEdit ? 'Updating…' : 'Setting…')
                : isEdit
                  ? 'Update Focus'
                  : writeJournal ? 'Set & Write' : 'Set Focus'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
