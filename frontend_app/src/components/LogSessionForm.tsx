import { useState, useEffect } from 'react';
import { api, ApiError } from '../lib/api.ts';
import { toast } from '../hooks/use-toast.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import { CARD_BG, COPPER, COPPER_BORDER, SURFACE_2, SURFACE_3, DATE_INPUT_STYLE } from '../lib/theme.ts';
import type { Intention } from '../types/api.ts';

interface LogSessionResponse {
  message: string;
  session_count?: number;
}

type GiNoGi = 'gi' | 'no_gi';
type SessionType = 'drilling' | 'class' | 'competition_training';
type Polarity = 'offense' | 'defense' | 'neutral';
type ScriptSource = 'directed' | 'organic';

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

const btnBase = 'px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer';
const btnActive = 'bg-brand-orange text-white';
const btnInactive = 'bg-white/10 text-white/60 hover:bg-white/20';

export default function LogSessionForm({ onSuccess, onCancel, defaultDate }: { onSuccess?: (sessionCount?: number) => void; onCancel?: () => void; defaultDate?: string }) {
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

  // Dynamic Pillar Engine fields
  const [heading,      setHeading]      = useState<string | null>(null);
  const [polarity,     setPolarity]     = useState<Polarity | null>(null);
  const [subSkillTag,  setSubSkillTag]  = useState('');
  const [scriptSource, setScriptSource] = useState<ScriptSource | null>(null);
  const [resonance,    setResonance]    = useState<number | null>(null);

  // Current intention hint
  const [currentIntention, setCurrentIntention] = useState<Intention | null>(null);
  useEffect(() => {
    const weekStart = (() => {
      const d = new Date();
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    api.get<{ intention: Intention | null }>(`/api/intentions/current?week_start=${weekStart}`)
      .then(r => setCurrentIntention(r.intention))
      .catch(() => {});
  }, []);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const resetForm = () => {
    setForm({ date: today, notes: '', gi_nogi: 'gi', intensity: 3, session_type: 'class' });
    setDurationMinutes(null);
    setHeading(null);
    setPolarity(null);
    setSubSkillTag('');
    setScriptSource(null);
    setResonance(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!durationMinutes || durationMinutes < DUR_MIN) {
      setError('Please select a duration.');
      return;
    }

    if (!heading) {
      setError('Please select a pillar focus.');
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
        tags:         [heading],
        heading,
        polarity:      polarity      ?? undefined,
        sub_skill_tag: subSkillTag   || undefined,
        script_source: scriptSource  ?? undefined,
        resonance:     resonance     ?? undefined,
      };

      const data = await api.post<LogSessionResponse>('/api/sessions', {
        date:         sessionSnapshot.date,
        duration:     sessionSnapshot.duration,
        notes:        form.notes,
        gi_nogi:      sessionSnapshot.gi_nogi,
        intensity:    sessionSnapshot.intensity,
        session_type: sessionSnapshot.session_type,
        tags:         sessionSnapshot.tags,
        heading:      sessionSnapshot.heading,
        polarity:     sessionSnapshot.polarity,
        sub_skill_tag: sessionSnapshot.sub_skill_tag,
        script_source: sessionSnapshot.script_source,
        resonance:    sessionSnapshot.resonance,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dataAny = data as any;
      if (data.message !== 'Session logged.' && !dataAny._offline) {
        setError(data.message ?? 'Failed to log session.');
        return;
      }

      if (dataAny._offline) {
        const { addPending } = await import('../lib/pendingSessions.ts');
        addPending({ id: `pending-${Date.now()}`, ...sessionSnapshot });
      }

      resetForm();
      toast({
        title: dataAny._offline
          ? 'Session saved offline — will sync when connected.'
          : 'Session logged!',
      });
      onSuccess?.(dataAny._offline ? undefined : data.session_count);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 0) {
          setError("Couldn't reach the server — check your connection and try again.");
        } else if (err.status >= 500) {
          setError(`Couldn't save your session — the server ran into an unexpected error. Please try again. ${err.message ? `(${err.message})` : ''}`.trim());
        } else {
          setError(err.message || "Couldn't save your session. Please check your inputs and try again.");
        }
      } else {
        setError("Couldn't save your session. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl p-6 overflow-hidden" style={{ backgroundColor: CARD_BG, border: `1px solid ${COPPER_BORDER}` }}>
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
            className="w-full rounded-lg px-3 py-2.5 text-sm text-white/90 outline-none focus:ring-1"
            style={DATE_INPUT_STYLE}
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

        {/* ── Dynamic Pillar Engine ────────────────────────────────── */}

        {/* Pillar Focus (Heading) */}
        <div>
          <div className="flex items-baseline gap-2 mb-1.5">
            <label className="text-sm text-white/70">Pillar Focus</label>
            {currentIntention && (
              <span className="text-[11px] text-white/35">
                This week: <span style={{ color: COPPER }}>{currentIntention.intent_label}</span>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SKILL_TAGS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setHeading(value); setPolarity(null); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  backgroundColor: heading === value ? COPPER : SURFACE_3,
                  color: heading === value ? '#fff' : 'rgba(255,255,255,0.5)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Polarity — only for guard and pins */}
        {(heading === 'guard' || heading === 'pins') && (
          <div>
            <label className="block text-xs text-white/60 mb-1.5">Polarity</label>
            <div className="flex gap-1.5">
              {(['offense', 'defense', 'neutral'] as Polarity[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPolarity(prev => prev === p ? null : p)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors"
                  style={{
                    backgroundColor: polarity === p ? COPPER : SURFACE_3,
                    color: polarity === p ? '#fff' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Script Source */}
        <div>
          <label className="block text-xs text-white/60 mb-1.5">Source</label>
          <div className="flex gap-1.5">
            {(['directed', 'organic'] as ScriptSource[]).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setScriptSource(prev => prev === s ? null : s)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  backgroundColor: scriptSource === s ? COPPER : SURFACE_3,
                  color: scriptSource === s ? '#fff' : 'rgba(255,255,255,0.5)',
                }}
              >
                {s === 'directed' ? 'Class / Directed' : 'Open Mat / Organic'}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-skill tag */}
        <div>
          <label className="block text-xs text-white/60 mb-1.5">
            Sub-skill <span className="text-white/25">(optional — e.g. K-Guard)</span>
          </label>
          <input
            type="text"
            maxLength={50}
            value={subSkillTag}
            onChange={e => setSubSkillTag(e.target.value)}
            placeholder="e.g. K-Guard, Single Leg, Guillotine"
            className="w-full border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/25 outline-none focus:border-white/25"
            style={{ backgroundColor: SURFACE_2 }}
          />
        </div>

        {/* Resonance — 5 dots (1–10 stored as 2/4/6/8/10) */}
        <div>
          <label className="block text-xs text-white/60 mb-1.5">
            Resonance <span className="text-white/25">(how aligned did it feel?)</span>
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => {
              const val = n * 2;
              const active = resonance !== null && resonance >= val;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setResonance(prev => prev === val ? null : val)}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    backgroundColor: active ? COPPER : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${active ? COPPER : 'rgba(255,255,255,0.12)'}`,
                    transition: 'background-color 0.15s',
                  }}
                />
              );
            })}
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
            className="ml-auto bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold px-6 py-2.5 rounded-full transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Log Session'}
          </button>
        </div>

      </form>
    </div>
  );
}
