import { useState } from 'react';
import { api } from '../lib/api.ts';

interface LogSessionResponse {
  message: string;
}

type GiNoGi = 'gi' | 'no_gi';
type SessionType = 'drilling' | 'class' | 'competition_training';

interface SessionFormData {
  date: string;
  duration: string;
  notes: string;
  gi_nogi: GiNoGi;
  intensity: number;
  session_type: SessionType;
}

// Use local date components — toISOString() is UTC and can return tomorrow's date at night
const _d = new Date();
const today = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}-${String(_d.getDate()).padStart(2, '0')}`;

const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: 'class', label: 'Class' },
  { value: 'drilling', label: 'Drilling' },
  { value: 'competition_training', label: 'Competition' },
];

const btnBase = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer';
const btnActive = 'bg-brand-orange text-white';
const btnInactive = 'bg-white/10 text-white/60 hover:bg-white/20';

export default function LogSessionForm({ onSuccess }: { onSuccess?: () => void }) {
  const [form, setForm] = useState<SessionFormData>({
    date: today,
    duration: '',
    notes: '',
    gi_nogi: 'gi',
    intensity: 3,
    session_type: 'class',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.post<LogSessionResponse>('/api/sessions', {
        date: form.date,
        duration: Number(form.duration),
        notes: form.notes,
        gi_nogi: form.gi_nogi,
        intensity: form.intensity,
        session_type: form.session_type,
      });

      if (data.message !== 'Session logged.') {
        setError(data.message ?? 'Failed to log session.');
        return;
      }

      setSubmitted(true);
      setForm({ date: today, duration: '', notes: '', gi_nogi: 'gi', intensity: 3, session_type: 'class' });
      setTimeout(() => setSubmitted(false), 3000);
      onSuccess?.();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-lg">
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

        {/* Duration */}
        <div>
          <label className="block text-sm text-white/70 mb-1">Duration (minutes)</label>
          <input
            type="number"
            name="duration"
            required
            min="1"
            value={form.duration}
            onChange={handleChange}
            placeholder="60"
            className="w-full bg-white/10 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange"
          />
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

        {submitted && (
          <p className="text-brand-green text-sm">Session logged!</p>
        )}

      </form>
    </div>
  );
}
