import { useState } from 'react';
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
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const charsLeft = 20 - label.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.post<CreateIntentionResponse>('/api/intentions', {
        intent_label: label.trim(),
        intent_category: category || null,
        week_start: getWeekStart(weekStart),
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to set intention.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4"
      style={{ backgroundColor: 'rgba(38, 70, 83, 0.85)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 border border-white/10"
        style={{ backgroundColor: '#1a2c38' }}
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
              {saving ? 'Setting…' : 'Set Intent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
