import { useState } from 'react';
import { api } from '../lib/api.ts';
import { toast } from '../hooks/use-toast.ts';
import { SKILL_TAGS, type SkillTag } from '../lib/constants.ts';
import { CARD_BG, COPPER_BORDER } from '../lib/theme.ts';

interface LogSessionResponse {
  message: string;
}

type GiNoGi = 'gi' | 'no_gi';
type SessionType = 'drilling' | 'class' | 'competition_training';

interface SessionFormData {
  date: string;
  notes: string;
  gi_nogi: GiNoGi;
  intensity: number;
  session_type: SessionType;
}

// Use local date components — toISOString() is UTC and can return tomorrow's date at night
const _d = new Date();
const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;

const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: 'class',                label: 'Class' },
  { value: 'drilling',             label: 'Drilling' },
  { value: 'competition_training', label: 'Competition' },
];

const btnBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer';
const btnActive = 'bg-brand-orange text-white';
const btnInactive = 'bg-white/10 text-white/60 hover:bg-white/20';

export default function LogSessionForm({ onSuccess, onCancel, defaultDate }: { onSuccess?: () => void; onCancel?: () => void; defaultDate?: string }) {
  const [form, setForm] = useState<SessionFormData>({
    date:         defaultDate ?? today,
    notes:        '',
    gi_nogi:      'gi',
    intensity:    3,
    session_type: 'class',
  });

  // Duration stepper — 30-min increments, null = not yet selected
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const DUR_STEP = 30;
  const DUR_MIN  = 30;
  const DUR_MAX  = 240;

  function fmtDuration(m: number) {
    const h   = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 && min > 0 ? `${h} h  ${min} m`
         : h > 0             ? `${h} h`
         :                     `${min} m`;
  }

  // Skill tags
  const [selectedTags, setSelectedTags] = useState<SkillTag[]>([]);

  const toggleTag = (tag: SkillTag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const resetForm = () => {
    setForm({ date: today, notes: '', gi_nogi: 'gi', intensity: 3, session_type: 'class' });
    setDurationMinutes(null);
    setSelectedTags([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!durationMinutes || durationMinutes < DUR_MIN) {
      setError('Please select a duration.');
      return;
    }

    if (selectedTags.length === 0) {
      setError('Please select at least one skill area.');
      return;
    }

    setLoading(true);
    try {
      const sessionSnapshot = {
        date:         form.date,
        duration:     durationMinutes!,
        intensity:    form.intensity,
        gi_nogi:      form.gi_nogi,
        session_type: form.session_type,
        notes:        form.notes || undefined,
        tags:         [...selectedTags],
      };

      const data = await api.post<LogSessionResponse>('/api/sessions', {
        date:         sessionSnapshot.date,
        duration:     sessionSnapshot.duration,
        notes:        form.notes,
        gi_nogi:      sessionSnapshot.gi_nogi,
        intensity:    sessionSnapshot.intensity,
        session_type: sessionSnapshot.session_type,
        tags:         sessionSnapshot.tags,
      });

      if (data.message !== 'Session logged.' && !(data as any)._offline) {
        setError(data.message ?? 'Failed to log session.');
        return;
      }

      if ((data as any)._offline) {
        const { addPending } = await import('../lib/pendingSessions.ts');
        addPending({ id: `pending-${Date.now()}`, ...sessionSnapshot });
      }

      resetForm();
      toast({
        title: (data as any)._offline
          ? 'Session saved offline — will sync when connected.'
          : 'Session logged!',
      });
      onSuccess?.();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl p-6 overflow-hidden" style={{ backgroundColor: CARD_BG, border: `1px solid ${COPPER_BORDER}` }}>
      <h2 className="text-lg font-semibold text-white mb-5">Log a Training Session</h2>
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Date */}
        <div className="overflow-hidden">
          <label className="block text-sm text-white/70 mb-1">Date</label>
          <input
            type="date"
            name="date"
            required
            value={form.date}
            onChange={handleChange}
            className="block w-full min-w-0 max-w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
          />
        </div>

        {/* Gi / No-Gi + Session Type */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div>
            <label className="block text-sm text-white/70 mb-2">Style</label>
            <div className="flex gap-2">
              {(['gi', 'no_gi'] as GiNoGi[]).map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, gi_nogi: val }))}
                  className={`${btnBase} ${form.gi_nogi === val ? btnActive : btnInactive}`}
                >
                  {val === 'gi' ? 'Gi' : 'No-Gi'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-2">Type</label>
            <div className="flex gap-2">
              {SESSION_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, session_type: value }))}
                  className={`flex-1 ${btnBase} ${form.session_type === value ? btnActive : btnInactive}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Duration — stepper */}
        <div>
          <label className="block text-sm text-white/70 mb-2">Duration</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDurationMinutes(m => Math.max(DUR_MIN, (m ?? 60) - DUR_STEP))}
              className="w-10 h-10 rounded-lg text-lg font-semibold transition-colors bg-white/10 text-white/60 hover:bg-white/20 disabled:opacity-30"
              disabled={!!durationMinutes && durationMinutes <= DUR_MIN}
            >
              −
            </button>
            <span
              className="text-lg font-semibold w-24 text-center"
              style={{ color: durationMinutes ? 'rgba(242,228,168,0.9)' : 'rgba(255,255,255,0.2)' }}
            >
              {durationMinutes ? fmtDuration(durationMinutes) : '— —'}
            </span>
            <button
              type="button"
              onClick={() => setDurationMinutes(m => Math.min(DUR_MAX, (m ?? 0) + DUR_STEP))}
              className="w-10 h-10 rounded-lg text-lg font-semibold transition-colors bg-white/10 text-white/60 hover:bg-white/20 disabled:opacity-30"
              disabled={!!durationMinutes && durationMinutes >= DUR_MAX}
            >
              +
            </button>
          </div>
        </div>

        {/* Intensity */}
        <div>
          <label className="block text-sm text-white/70 mb-2">Intensity</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, intensity: n }))}
                className={`flex-1 h-10 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  form.intensity === n ? btnActive : btnInactive
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Skill tags */}
        <div>
          <label className="block text-sm text-white/70 mb-2">
            Skills Trained <span className="text-white/30">(select all that apply)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {SKILL_TAGS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleTag(value)}
                className={`${btnBase} ${selectedTags.includes(value) ? btnActive : btnInactive}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm text-white/70 mb-1">Notes <span className="text-white/30">(optional)</span></label>
          <textarea
            name="notes"
            rows={2}
            value={form.notes}
            onChange={handleChange}
            placeholder="What did you work on today?"
            className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:text-white/80 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="ml-auto bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Log Session'}
          </button>
        </div>

      </form>
    </div>
  );
}
