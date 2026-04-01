import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.ts';
import { PALE_YELLOW } from '../lib/theme.ts';

const CATEGORIES = [
  { value: 'technical',   label: 'Technical'   },
  { value: 'physical',    label: 'Physical'     },
  { value: 'mental',      label: 'Mental'       },
  { value: 'positional',  label: 'Positional'   },
  { value: 'competitive', label: 'Competitive'  },
] as const;

type Category = typeof CATEGORIES[number]['value'];

const DURATION_OPTIONS = [3, 5, 7, 14] as const;

// Returns ISO Monday (YYYY-MM-DD) for the given date, using local timezone
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  weekStart: Date;
  onSaved: () => void;
  onClose: () => void;
}

interface CreateIntentionResponse {
  message: string;
  intention: { id: string; intent_label: string; intent_category: string | null };
}

export default function SetIntentionModal({ weekStart, onSaved, onClose }: Props) {
  const navigate = useNavigate();
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [durationDays, setDurationDays] = useState<number>(7);
  const [writeJournal, setWriteJournal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const charsLeft = 20 - label.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await api.post<CreateIntentionResponse>('/api/intentions', {
        intent_label: label.trim(),
        intent_category: category || null,
        week_start: getWeekStart(weekStart),
        duration_days: durationDays,
      });
      onSaved();
      if (writeJournal && res.intention?.id) {
        navigate(`/intentions/${res.intention.id}/journal`);
      } else {
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to set intention.');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4"
      style={{ backgroundColor: 'rgba(13, 26, 20, 0.85)', backdropFilter: 'blur(12px) saturate(1.2)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm rounded-2xl p-6 animate-j2-modal-in"
        style={{
          backgroundColor: '#152E22',
          border: '1px solid rgba(196,145,95,0.45)',
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-base font-semibold mb-1" style={{ color: PALE_YELLOW }}>
          Set this week's intention
        </p>
        <p className="text-xs text-white/40 mb-5">
          A short focus to carry through your training this week.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Label input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-white/60">Focus label</label>
              <span className={`text-[11px] ${charsLeft < 5 ? 'text-brand-orange' : 'text-white/30'}`}>
                {charsLeft} left
              </span>
            </div>
            <input
              type="text"
              maxLength={20}
              required
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Active Toes"
              className="w-full bg-white/8 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/25 outline-none focus:border-white/25"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
              autoFocus
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs text-white/60 block mb-1.5">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(prev => prev === c.value ? '' : c.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: category === c.value ? 'rgba(218,116,34,0.8)' : 'rgba(255,255,255,0.07)',
                    color: category === c.value ? '#fff' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs text-white/60 block mb-1.5">Duration</label>
            <div className="flex gap-1.5">
              {DURATION_OPTIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDurationDays(d)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: durationDays === d ? 'rgba(218,116,34,0.8)' : 'rgba(255,255,255,0.07)',
                    color: durationDays === d ? '#fff' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Journal toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <div
              onClick={() => setWriteJournal(v => !v)}
              className="w-9 h-5 rounded-full relative transition-colors flex-shrink-0"
              style={{ backgroundColor: writeJournal ? 'rgba(218,116,34,0.8)' : 'rgba(255,255,255,0.1)' }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style={{ transform: writeJournal ? 'translateX(18px)' : 'translateX(2px)' }}
              />
            </div>
            <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors">
              Write a journal entry for this intention
            </span>
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-white/40 hover:text-white transition-colors px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !label.trim()}
              className="bg-brand-orange hover:bg-brand-orange/90 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Setting…' : writeJournal ? 'Set & Write' : 'Set Intent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
