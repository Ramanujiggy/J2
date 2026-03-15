import { useState } from 'react';
import { api } from '../lib/api.ts';
import { toast } from '../hooks/use-toast.ts';
import { SKILL_TAGS, type SkillTag } from '../lib/constants.ts';

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

const DURATION_PRESETS = [
  { label: '1h',      minutes: 60  },
  { label: '1h 30m', minutes: 90  },
  { label: '2h',      minutes: 120 },
  { label: '2h 30m', minutes: 150 },
  { label: '3h',      minutes: 180 },
];

const btnBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer';
const btnActive = 'bg-brand-orange text-white';
const btnInactive = 'bg-white/10 text-white/60 hover:bg-white/20';

export default function LogSessionForm({ onSuccess }: { onSuccess?: () => void }) {
  const [form, setForm] = useState<SessionFormData>({
    date:         today,
    notes:        '',
    gi_nogi:      'gi',
    intensity:    3,
    session_type: 'class',
  });

  // Duration state — preset (minutes) or 'custom'
  const [durationPreset, setDurationPreset] = useState<number | 'custom' | null>(null);
  const [customH, setCustomH] = useState('');
  const [customM, setCustomM] = useState('');

  const durationMinutes =
    durationPreset === 'custom'
      ? Number(customH || 0) * 60 + Number(customM || 0)
      : (durationPreset ?? 0);

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
    setDurationPreset(null);
    setCustomH('');
    setCustomM('');
    setSelectedTags([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!durationMinutes || durationMinutes < 1) {
      setError('Please select a duration.');
      return;
    }

    if (selectedTags.length === 0) {
      setError('Please select at least one skill area.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.post<LogSessionResponse>('/api/sessions', {
        date:         form.date,
        duration:     durationMinutes,
        notes:        form.notes,
        gi_nogi:      form.gi_nogi,
        intensity:    form.intensity,
        session_type: form.session_type,
        tags:         selectedTags,
      });

      if (data.message !== 'Session logged.') {
        setError(data.message ?? 'Failed to log session.');
        return;
      }

      resetForm();
      toast({ title: 'Session logged!' });
      onSuccess?.();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl p-6" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(184,122,85,0.45)' }}>
      <h2 className="text-lg font-semibold text-white mb-5">Log a Training Session</h2>
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Date */}
        <div>
          <label className="block text-sm text-white/70 mb-1">Date</label>
          <input
            type="date"
            name="date"
            required
            value={form.date}
            onChange={handleChange}
            className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange"
          />
        </div>

        {/* Gi / No-Gi + Session Type */}
        <div className="flex gap-6">
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
                  className={`${btnBase} ${form.session_type === value ? btnActive : btnInactive}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Duration — preset chips + optional custom */}
        <div>
          <label className="block text-sm text-white/70 mb-2">Duration</label>
          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map(({ label, minutes }) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setDurationPreset(minutes)}
                className={`${btnBase} ${durationPreset === minutes ? btnActive : btnInactive}`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDurationPreset('custom')}
              className={`${btnBase} ${durationPreset === 'custom' ? btnActive : btnInactive}`}
            >
              Custom
            </button>
          </div>

          {durationPreset === 'custom' && (
            <div className="flex items-center gap-2 mt-3">
              <input
                type="number"
                min={0}
                max={12}
                placeholder="0"
                value={customH}
                onChange={e => setCustomH(e.target.value)}
                className="w-16 bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-orange"
              />
              <span className="text-white/50 text-sm">h</span>
              <input
                type="number"
                min={0}
                max={59}
                placeholder="0"
                value={customM}
                onChange={e => setCustomM(e.target.value)}
                className="w-16 bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-orange"
              />
              <span className="text-white/50 text-sm">min</span>
            </div>
          )}
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
                className={`w-10 h-10 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
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
            rows={3}
            value={form.notes}
            onChange={handleChange}
            placeholder="What did you work on today?"
            className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Log Session'}
        </button>

      </form>
    </div>
  );
}
