import { useState } from 'react';
import { api } from '../lib/api.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import type { SessionSummary } from './TrainingHeatmap.tsx';

const INTENSITY_COLOR: Record<number, string> = {
  1: '#CDDFA0',
  2: '#CDDFA0',
  3: '#6FD08C',
  4: '#DA7422',
  5: '#DA7422',
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  class:                'Class',
  drilling:             'Drilling',
  competition_training: 'Competition',
};

const DURATION_PRESETS = [
  { label: '1h',      minutes: 60  },
  { label: '1h 30m', minutes: 90  },
  { label: '2h',      minutes: 120 },
  { label: '2h 30m', minutes: 150 },
  { label: '3h',      minutes: 180 },
];

const PRESET_MINUTES = new Set(DURATION_PRESETS.map(p => p.minutes));

// Particles for the modal intention effect — fixed organic spread across modal width
const MODAL_PARTICLES = [
  { left: '7%',  bottom: 3, size: 2, drift: '-4px', duration: 4.1, delay: 0.0 },
  { left: '22%', bottom: 2, size: 2, drift: '5px',  duration: 3.7, delay: 0.9 },
  { left: '40%', bottom: 4, size: 2, drift: '-3px', duration: 4.8, delay: 1.6 },
  { left: '57%', bottom: 2, size: 2, drift: '4px',  duration: 3.4, delay: 0.4 },
  { left: '74%', bottom: 3, size: 2, drift: '-5px', duration: 4.5, delay: 1.2 },
  { left: '89%', bottom: 2, size: 2, drift: '3px',  duration: 3.9, delay: 2.1 },
] as const;

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface IntentionSummary {
  intent_label: string;
  intent_category: string | null;
}

interface Props {
  session: SessionSummary;
  date: Date;
  intention?: IntentionSummary | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function SessionDetailModal({ session, date, intention, onClose, onSaved }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    duration:     session.duration,
    gi_nogi:      session.gi_nogi,
    intensity:    session.intensity,
    session_type: session.session_type,
    notes:        session.notes ?? '',
    tags:         session.tags ?? [],
  });

  // Duration edit state — initialise to matching preset or 'custom'
  const initialPreset = PRESET_MINUTES.has(session.duration) ? session.duration : 'custom' as const;
  const [durationPreset, setDurationPreset] = useState<number | 'custom'>(initialPreset);
  const [customH, setCustomH] = useState(
    initialPreset === 'custom' ? String(Math.floor(session.duration / 60)) : ''
  );
  const [customM, setCustomM] = useState(
    initialPreset === 'custom' ? String(session.duration % 60) : ''
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const intensityColor = INTENSITY_COLOR[session.intensity] ?? '#CDDFA0';

  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const selectPreset = (minutes: number) => {
    setDurationPreset(minutes);
    setForm(f => ({ ...f, duration: minutes }));
  };

  const selectCustom = () => {
    setDurationPreset('custom');
  };

  const applyCustom = (h: string, m: string) => {
    const total = Number(h || 0) * 60 + Number(m || 0);
    setForm(f => ({ ...f, duration: total }));
  };

  const toggleTag = (tag: string) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      await api.put(`/api/sessions/${session.id}`, form);
      onSaved();
      onClose();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const chipBase = 'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer';
  const chipActive = 'bg-brand-orange text-white';
  const chipInactive = 'bg-white/8 text-white/55 hover:bg-white/15';

  return (
    <>
      {/* Keyframes — same as PathAheadPage, duplicated here for portability */}
      <style>{`
        @keyframes j2IntentParticleRise {
          0%   { transform: translateY(0) translateX(0);               opacity: 0;   }
          8%   { opacity: 1; }
          85%  { opacity: 0.7; }
          100% { transform: translateY(-52px) translateX(var(--drift)); opacity: 0;  }
        }
        @keyframes j2IntentYellowPulse {
          0%   { opacity: 0.4; transform: scaleX(1);    }
          50%  { opacity: 0.7; transform: scaleX(1.03); }
          100% { opacity: 0.4; transform: scaleX(1);    }
        }
        @keyframes j2IntentPurplePulse {
          0%   { opacity: 0.35; transform: scale(1);    }
          50%  { opacity: 0.65; transform: scale(1.08); }
          100% { opacity: 0.35; transform: scale(1);    }
        }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4"
        style={{ backgroundColor: 'rgba(17, 30, 43, 0.92)' }}
        onClick={onClose}
      >
        <div
          className="w-full max-w-md rounded-2xl p-6"
          style={{
            position: 'relative',
            backgroundColor: '#1a2c38',
            border: '1px solid rgba(184,122,85,0.45)',
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Intention particle layer — rendered inside the modal box when intention is active */}
          {intention && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden', borderRadius: 16 }}>
              {/* Purple glow from bottom */}
              <div style={{
                position: 'absolute',
                bottom: -12, left: '50%',
                transform: 'translateX(-50%)',
                width: '55%', height: 56,
                borderRadius: '50%',
                background: 'radial-gradient(ellipse at center bottom, rgba(167,139,250,0.18) 0%, transparent 80%)',
                animation: 'j2IntentPurplePulse 4.2s ease-in-out infinite',
              }} />
              {/* Yellow lowlight */}
              <div style={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0, height: 36,
                background: 'linear-gradient(to top, rgba(240,223,160,0.07) 0%, transparent 100%)',
                animation: 'j2IntentYellowPulse 3.1s ease-in-out infinite',
                transformOrigin: 'center bottom',
              }} />
              {/* Rising particles */}
              {MODAL_PARTICLES.map((p, i) => (
                <span key={i} style={{
                  position: 'absolute',
                  left: p.left, bottom: p.bottom,
                  width: p.size, height: p.size,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(240,223,160,0.85)',
                  boxShadow: '0 0 4px 1px rgba(240,223,160,0.5)',
                  filter: 'brightness(1.2)',
                  ['--drift' as string]: p.drift,
                  animation: `j2IntentParticleRise ${p.duration}s ease-in-out infinite ${p.delay}s`,
                  userSelect: 'none',
                } as React.CSSProperties} />
              ))}
            </div>
          )}

          {/* All content sits above the particle layer */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Date — colored by intensity */}
            <p className="text-2xl font-bold mb-3" style={{ color: intensityColor }}>
              {dateLabel}
            </p>

            {/* Intention banner — below date, above stat tiles */}
            {intention && (
              <div
                className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
                style={{
                  backgroundColor: 'rgba(240,223,160,0.07)',
                  border: '1px solid rgba(240,223,160,0.14)',
                }}
              >
                <span style={{ color: 'rgba(240,223,160,0.5)', fontSize: 12 }}>◈</span>
                <span className="text-sm font-semibold" style={{ color: '#F0DFA0' }}>
                  {intention.intent_label}
                </span>
                {intention.intent_category && (
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full capitalize"
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}
                  >
                    {intention.intent_category}
                  </span>
                )}
              </div>
            )}

            {/* Stat tiles */}
            <div className="grid grid-cols-2 gap-3 mb-4">

              {/* Style */}
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-white/40 mb-1">Style</p>
                {isEditing ? (
                  <select
                    className="bg-transparent text-sm font-semibold text-white w-full outline-none"
                    value={form.gi_nogi}
                    onChange={e => setForm(f => ({ ...f, gi_nogi: e.target.value as 'gi' | 'no_gi' }))}
                  >
                    <option value="gi"    style={{ backgroundColor: '#1a2c38' }}>Gi</option>
                    <option value="no_gi" style={{ backgroundColor: '#1a2c38' }}>No-Gi</option>
                  </select>
                ) : (
                  <p className="text-sm font-semibold text-white">
                    {session.gi_nogi === 'gi' ? 'Gi' : 'No-Gi'}
                  </p>
                )}
              </div>

              {/* Type */}
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-white/40 mb-1">Type</p>
                {isEditing ? (
                  <select
                    className="bg-transparent text-sm font-semibold text-white w-full outline-none"
                    value={form.session_type}
                    onChange={e => setForm(f => ({ ...f, session_type: e.target.value as SessionSummary['session_type'] }))}
                  >
                    <option value="class"                style={{ backgroundColor: '#1a2c38' }}>Class</option>
                    <option value="drilling"             style={{ backgroundColor: '#1a2c38' }}>Drilling</option>
                    <option value="competition_training" style={{ backgroundColor: '#1a2c38' }}>Competition</option>
                  </select>
                ) : (
                  <p className="text-sm font-semibold text-white">
                    {SESSION_TYPE_LABELS[session.session_type] ?? session.session_type}
                  </p>
                )}
              </div>

              {/* Intensity */}
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-white/40 mb-1">Intensity</p>
                {isEditing ? (
                  <div className="flex gap-1 mt-0.5">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setForm(f => ({ ...f, intensity: n }))}
                        className="w-6 h-6 rounded text-xs font-bold transition-colors"
                        style={
                          form.intensity === n
                            ? { backgroundColor: INTENSITY_COLOR[n], color: '#1a2c38' }
                            : { backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }
                        }
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-semibold" style={{ color: intensityColor }}>
                    {session.intensity} / 5
                  </p>
                )}
              </div>

              {/* Duration */}
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-white/40 mb-1">Duration</p>
                {isEditing ? (
                  <div>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {DURATION_PRESETS.map(({ label, minutes }) => (
                        <button
                          key={minutes}
                          onClick={() => selectPreset(minutes)}
                          className={`${chipBase} ${durationPreset === minutes ? chipActive : chipInactive}`}
                          style={durationPreset !== minutes ? { backgroundColor: 'rgba(255,255,255,0.08)' } : {}}
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        onClick={selectCustom}
                        className={`${chipBase} ${durationPreset === 'custom' ? chipActive : chipInactive}`}
                        style={durationPreset !== 'custom' ? { backgroundColor: 'rgba(255,255,255,0.08)' } : {}}
                      >
                        Custom
                      </button>
                    </div>
                    {durationPreset === 'custom' && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <input
                          type="number"
                          min={0}
                          max={12}
                          value={customH}
                          onChange={e => { setCustomH(e.target.value); applyCustom(e.target.value, customM); }}
                          className="w-10 bg-white/10 rounded text-xs text-white text-center outline-none px-1 py-1"
                          placeholder="0"
                        />
                        <span className="text-xs text-white/40">h</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={customM}
                          onChange={e => { setCustomM(e.target.value); applyCustom(customH, e.target.value); }}
                          className="w-10 bg-white/10 rounded text-xs text-white text-center outline-none px-1 py-1"
                          placeholder="0"
                        />
                        <span className="text-xs text-white/40">m</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-white">{formatDuration(session.duration)}</p>
                )}
              </div>
            </div>

            {/* Skills */}
            <div className="mb-4">
              <p className="text-xs text-white/40 mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {isEditing ? (
                  SKILL_TAGS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => toggleTag(value)}
                      className={`${chipBase} ${form.tags.includes(value) ? chipActive : chipInactive}`}
                      style={!form.tags.includes(value) ? { backgroundColor: 'rgba(255,255,255,0.08)' } : {}}
                    >
                      {label}
                    </button>
                  ))
                ) : (
                  session.tags.length > 0
                    ? SKILL_TAGS.filter(({ value }) => session.tags.includes(value)).map(({ value, label }) => (
                        <span
                          key={value}
                          className={`${chipBase} text-white/55`}
                          style={{ backgroundColor: 'rgba(255,255,255,0.08)', cursor: 'default' }}
                        >
                          {label}
                        </span>
                      ))
                    : <span className="text-xs text-white/20 italic">None logged</span>
                )}
              </div>
            </div>

            {/* Journal notes */}
            <div className="mb-5">
              <p className="text-xs text-white/40 mb-2">Journal</p>
              <textarea
                readOnly={!isEditing}
                rows={4}
                placeholder={isEditing ? 'Add a note…' : 'No notes for this session.'}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 resize-none outline-none transition-colors border"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderColor: isEditing ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)',
                  color: isEditing ? '#fff' : 'rgba(255,255,255,0.65)',
                }}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              {saveError && (
                <p className="text-xs text-red-400 self-center mr-auto">Save failed. Please try again.</p>
              )}
              <button
                onClick={onClose}
                className="text-sm text-white/40 hover:text-white transition-colors px-4 py-2"
              >
                Close
              </button>
              {isEditing ? (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-brand-orange hover:bg-brand-orange/90 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm font-semibold text-white/60 hover:text-white bg-white/8 hover:bg-white/15 px-5 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
