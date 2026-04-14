import { useState, useEffect } from 'react';
import { api, ApiError } from '../lib/api.ts';
import { toast } from '../hooks/use-toast.ts';
import { CARD_BG, COPPER, COPPER_BORDER, SURFACE_2, SURFACE_3, PALE_YELLOW, GLOW_SOFT } from '../lib/theme.ts';
import { vibrate } from '../lib/haptics.ts';
import { INTENSITY_COLOR } from '../lib/sessionUtils.ts';
import BeltDateBanner from './BeltDateBanner.tsx';
import PillarPrism from './PillarPrism.tsx';
import type { Intention, SessionSummary } from '../types/api.ts';

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

// ── Intensity labels & duration presets ────────────────────────────────────
const INTENSITY_LABELS = ['Light', 'Easy', 'Moderate', 'Hard', 'Max'];
const DURATION_PRESETS = [30, 60, 90, 120];

export default function LogSessionForm({ onSuccess, onCancel, defaultDate, defaultHeading, defaultSessionType, defaultSubSkillTag }: { onSuccess?: (sessionCount?: number) => void; onCancel?: () => void; defaultDate?: string; defaultHeading?: string; defaultSessionType?: SessionType; defaultSubSkillTag?: string }) {
  const [form, setForm] = useState<SessionFormData>({
    date:         defaultDate ?? today,
    notes:        '',
    gi_nogi:      'gi',
    intensity:    3,
    session_type: defaultSessionType ?? 'class',
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
  const [heading,      setHeading]      = useState<string | null>(defaultHeading ?? null);
  const [polarity,     setPolarity]     = useState<Polarity | null>(null);
  const [subSkillTag,  setSubSkillTag]  = useState(defaultSubSkillTag ?? '');
  // resonance initialized to max when pre-filled from roulette (dot sits at the vertex)
  const [scriptSource, setScriptSource] = useState<ScriptSource | null>(null);
  const [resonance,    setResonance]    = useState<number | null>(defaultHeading ? 10 : null);
  // Phase 1: weights computed and displayed by PillarPrism but not sent to API yet (Phase 2)
  const [_pillarWeights, setPillarWeights] = useState<Record<string, number> | null>(null);
  void _pillarWeights; // suppress unused warning — will be sent to API in Phase 2

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

  // Recent sub-skill tags for chip suggestions
  const [recentTags, setRecentTags] = useState<string[]>([]);
  useEffect(() => {
    const from = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    api.get<{ sessions: SessionSummary[] }>(`/api/sessions?from=${from}`)
      .then(r => {
        const tags = (r.sessions ?? [])
          .map(s => s.sub_skill_tag)
          .filter((t): t is string => !!t && t.trim().length > 0);
        const unique = [...new Set(tags)].slice(0, 6);
        setRecentTags(unique);
      })
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
    setPillarWeights(null);
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

  // ── Shared toggle renderer ────────────────────────────────────────────────
  function SegmentedToggle<T extends string>({ options, value, onChange, deselectable }: {
    options: { value: T; label: string }[];
    value: T | null;
    onChange: (v: T | null) => void;
    deselectable?: boolean;
  }) {
    return (
      <div className="flex rounded-xl p-0.5" style={{ backgroundColor: SURFACE_2 }}>
        {options.map(opt => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                vibrate(8);
                onChange(deselectable && active ? null : opt.value);
              }}
              className="flex-1 h-10 rounded-[10px] text-sm font-medium transition-all touch-manipulation"
              style={{
                backgroundColor: active ? COPPER : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                transition: 'background-color 200ms ease, color 200ms ease',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: CARD_BG, border: `1px solid ${COPPER_BORDER}`, isolation: 'isolate' }}>
      <form onSubmit={handleSubmit}>
        {/* Belt date banner — full-bleed, animates in from the right on mount */}
        <BeltDateBanner
          value={form.date}
          required
          onChange={date => setForm(prev => ({ ...prev, date }))}
        />

        <div className="px-5 pb-5 pt-4 space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: PALE_YELLOW }}>Log a Training Session</h2>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 1: The Basics
            ══════════════════════════════════════════════════════════════ */}
        <div className="rounded-xl px-4 py-4 space-y-4" style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.28)' }}>
            The Basics
          </span>

          {/* Gi / No-Gi */}
          <SegmentedToggle
            options={[{ value: 'gi' as GiNoGi, label: 'Gi' }, { value: 'no_gi' as GiNoGi, label: 'No-Gi' }]}
            value={form.gi_nogi}
            onChange={v => v && setForm(prev => ({ ...prev, gi_nogi: v }))}
          />

          {/* Session Type */}
          <SegmentedToggle
            options={SESSION_TYPES}
            value={form.session_type}
            onChange={v => v && setForm(prev => ({ ...prev, session_type: v }))}
          />

          {/* Duration — preset pills + stepper */}
          <div className="space-y-2">
            <div className="flex gap-1.5">
              {DURATION_PRESETS.map(m => {
                const active = durationMinutes === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { vibrate(8); setDurationMinutes(m); }}
                    className="flex-1 h-9 rounded-[10px] text-xs font-medium transition-all touch-manipulation"
                    style={{
                      backgroundColor: active ? COPPER : SURFACE_3,
                      color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                      transition: 'background-color 200ms ease, color 200ms ease',
                    }}
                  >
                    {fmtDuration(m)}
                  </button>
                );
              })}
            </div>
            <div
              className="flex items-center justify-center gap-3 rounded-xl py-2"
              style={{ backgroundColor: SURFACE_3 }}
            >
              <button
                type="button"
                onClick={() => { vibrate(8); setDurationMinutes(m => Math.max(DUR_MIN, (m ?? 60) - DUR_STEP)); }}
                className="w-11 h-11 rounded-lg text-lg font-semibold transition-colors touch-manipulation"
                style={{ backgroundColor: SURFACE_2, color: 'rgba(255,255,255,0.55)' }}
                disabled={!!durationMinutes && durationMinutes <= DUR_MIN}
              >
                −
              </button>
              <span
                className="text-xl font-bold w-28 text-center"
                style={{ color: durationMinutes ? PALE_YELLOW : 'rgba(255,255,255,0.22)' }}
              >
                {durationMinutes ? fmtDuration(durationMinutes) : 'tap above'}
              </span>
              <button
                type="button"
                onClick={() => { vibrate(8); setDurationMinutes(m => Math.min(DUR_MAX, (m ?? 0) + DUR_STEP)); }}
                className="w-11 h-11 rounded-lg text-lg font-semibold transition-colors touch-manipulation"
                style={{ backgroundColor: SURFACE_2, color: 'rgba(255,255,255,0.55)' }}
                disabled={!!durationMinutes && durationMinutes >= DUR_MAX}
              >
                +
              </button>
            </div>
          </div>

          {/* Intensity — color-gradient segmented bar */}
          <div className="space-y-1.5">
            <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
              {[1, 2, 3, 4, 5].map(n => {
                const active = form.intensity === n;
                const color = INTENSITY_COLOR[n] ?? '#A8CB72';
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { vibrate(10); setForm(prev => ({ ...prev, intensity: n })); }}
                    className="flex-1 flex items-center justify-center font-semibold transition-all touch-manipulation"
                    style={{
                      height: active ? 44 : 40,
                      backgroundColor: active ? color : `${color}33`,
                      color: active ? '#152E22' : `${color}88`,
                      fontSize: active ? 16 : 14,
                      transition: 'height 200ms ease, background-color 200ms ease, color 200ms ease, font-size 200ms ease',
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="flex">
              {INTENSITY_LABELS.map((label, i) => (
                <span
                  key={label}
                  className="flex-1 text-center"
                  style={{
                    fontSize: 9,
                    color: form.intensity === i + 1 ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.22)',
                    fontWeight: form.intensity === i + 1 ? 600 : 400,
                    transition: 'color 200ms ease',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 2: Your Focus
            ══════════════════════════════════════════════════════════════ */}
        <div className="rounded-xl px-4 py-4 space-y-4" style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
              What did you work on?
            </h3>
            {currentIntention && (
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
                This week's focus: <span style={{ color: COPPER }}>{currentIntention.intent_label}</span>
              </p>
            )}
          </div>

          {/* Pillar Prism — tap/drag to mark focus and alignment */}
          <PillarPrism
            heading={heading}
            resonance={resonance}
            defaultHeading={defaultHeading}
            onSelect={(h, r, w) => { setHeading(h); setResonance(r); setPillarWeights(w); setPolarity(null); }}
          />

          {/* Polarity — only for guard and pins */}
          {(heading === 'guard' || heading === 'pins') && (
            <div>
              <SegmentedToggle
                options={[
                  { value: 'defense' as Polarity, label: 'Defense' },
                  { value: 'neutral' as Polarity, label: 'Neutral' },
                  { value: 'offense' as Polarity, label: 'Offense' },
                ]}
                value={polarity}
                onChange={setPolarity}
                deselectable
              />
              <p className="text-[10px] mt-1.5 text-center" style={{ color: 'rgba(255,255,255,0.22)' }}>
                What side of the exchange were you primarily on?
              </p>
            </div>
          )}

          {/* Source */}
          <div>
            <SegmentedToggle
              options={[
                { value: 'directed' as ScriptSource, label: 'Coach-led' },
                { value: 'organic' as ScriptSource, label: 'Open Mat' },
              ]}
              value={scriptSource}
              onChange={setScriptSource}
              deselectable
            />
            <p className="text-[10px] mt-1.5 text-center" style={{ color: 'rgba(255,255,255,0.22)' }}>
              Was this instructor-led or self-directed?
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 3: Details (optional)
            ══════════════════════════════════════════════════════════════ */}
        <div className="rounded-xl px-4 py-4 space-y-3" style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Details
          </span>

          {/* Sub-skill tag */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.40)' }}>
              Sub-skill <span style={{ color: 'rgba(255,255,255,0.20)' }}>(optional)</span>
            </label>
            <input
              type="text"
              maxLength={50}
              value={subSkillTag}
              onChange={e => setSubSkillTag(e.target.value)}
              placeholder="e.g. K-Guard, Single Leg, Guillotine"
              className="w-full border rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors"
              style={{
                backgroundColor: SURFACE_3,
                borderColor: 'rgba(255,255,255,0.08)',
                ...(subSkillTag ? {} : {}),
              }}
            />
            {/* Recent tag chips */}
            {recentTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {recentTags.map(tag => {
                  const active = subSkillTag === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        vibrate(6);
                        setSubSkillTag(prev => prev === tag ? '' : tag);
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all touch-manipulation"
                      style={{
                        backgroundColor: active ? COPPER : SURFACE_3,
                        color: active ? '#fff' : 'rgba(255,255,255,0.40)',
                        transition: 'background-color 200ms ease, color 200ms ease',
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>
              Notes <span style={{ color: 'rgba(255,255,255,0.20)' }}>(optional)</span>
            </label>
            <textarea
              name="notes"
              rows={2}
              value={form.notes}
              onChange={handleChange}
              placeholder="What stood out today?"
              className="w-full rounded-xl px-4 py-2.5 text-sm text-white/90 placeholder-white/25 outline-none resize-none transition-colors"
              style={{
                backgroundColor: SURFACE_3,
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            />
          </div>
        </div>

        {/* ── Error + CTA ─────────────────────────────────────────── */}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div
          className="flex items-center gap-3 pt-2"
          style={{ borderTop: '1px solid rgba(196,145,95,0.12)' }}
        >
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-3 text-sm font-medium transition-colors touch-manipulation"
              style={{ color: 'rgba(255,255,255,0.40)' }}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex-1 text-white font-semibold rounded-xl transition-all touch-manipulation disabled:opacity-50"
            style={{
              height: 52,
              backgroundColor: '#DA7422',
              boxShadow: '0 2px 12px rgba(218,116,34,0.25)',
              fontSize: 16,
            }}
          >
            {loading ? 'Saving...' : 'Log Session'}
          </button>
        </div>

        </div>{/* end content wrapper */}
      </form>
    </div>
  );
}
