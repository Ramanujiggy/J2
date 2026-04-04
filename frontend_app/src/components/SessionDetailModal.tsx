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

const INTENSITY_LABEL: Record<number, string> = {
  1: 'Very Light',
  2: 'Light',
  3: 'Moderate',
  4: 'Hard',
  5: 'Max Effort',
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

// Particles for the modal intention effect
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
  sessionCount?: number;
  sessionIndex?: number;
  onNavigate?: (index: number) => void;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}

export default function SessionDetailModal({ session, date, intention, sessionCount, sessionIndex, onNavigate, onClose, onSaved, onDeleted }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    duration:     session.duration,
    gi_nogi:      session.gi_nogi,
    intensity:    session.intensity,
    session_type: session.session_type,
    notes:        session.notes ?? '',
    tags:         session.tags ?? [],
  });

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const intensityColor = INTENSITY_COLOR[session.intensity] ?? '#CDDFA0';

  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const selectPreset = (minutes: number) => {
    setDurationPreset(minutes);
    setForm(f => ({ ...f, duration: minutes }));
  };

  const selectCustom = () => setDurationPreset('custom');

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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/sessions/${session.id}`);
      onDeleted?.();
      onClose();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
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

  // Displayed session tags in order
  const sessionTagObjects = SKILL_TAGS.filter(({ value }) => session.tags.includes(value));

  return (
    <>
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

      {/* Backdrop — perspective origin for the 3D card flip */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4"
        style={{ backgroundColor: 'rgba(13, 26, 20, 0.85)', backdropFilter: 'blur(12px) saturate(1.2)', perspective: '1200px' }}
        onClick={onClose}
      >
        {/* Outer wrapper: entrance animation only — must not own transform so flip works */}
        <div
          className="w-full sm:max-w-md animate-j2-modal-in"
          onClick={e => e.stopPropagation()}
        >
        {/* Inner flipper: 3D flip only — no animation class here */}
        <div
          style={{
            position: 'relative',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isEditing ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* ── FRONT FACE — view summary ── */}
          <div
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              pointerEvents: isEditing ? 'none' : 'auto',
              position: 'relative',
              backgroundColor: '#152E22',
              border: '1px solid rgba(196,145,95,0.45)',
              borderRadius: '1rem',
              overflow: 'hidden',
              maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
              overflowY: 'auto',
              padding: '1.5rem',
            }}
          >
            {/* Intention particle layer */}
            {intention && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden', borderRadius: 16 }}>
                <div style={{
                  position: 'absolute', bottom: -12, left: '50%',
                  transform: 'translateX(-50%)',
                  width: '55%', height: 56, borderRadius: '50%',
                  background: 'radial-gradient(ellipse at center bottom, rgba(167,139,250,0.18) 0%, transparent 80%)',
                  animation: 'j2IntentPurplePulse 4.2s ease-in-out infinite',
                }} />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
                  background: 'linear-gradient(to top, rgba(242,228,168,0.07) 0%, transparent 100%)',
                  animation: 'j2IntentYellowPulse 3.1s ease-in-out infinite',
                  transformOrigin: 'center bottom',
                }} />
                {MODAL_PARTICLES.map((p, i) => (
                  <span key={i} style={{
                    position: 'absolute', left: p.left, bottom: p.bottom,
                    width: p.size, height: p.size, borderRadius: '50%',
                    backgroundColor: 'rgba(242,228,168,0.85)',
                    boxShadow: '0 0 4px 1px rgba(242,228,168,0.5)',
                    filter: 'brightness(1.2)',
                    ['--drift' as string]: p.drift,
                    animation: `j2IntentParticleRise ${p.duration}s ease-in-out infinite ${p.delay}s`,
                    userSelect: 'none',
                  } as React.CSSProperties} />
                ))}
              </div>
            )}

            {/* Content above particle layer */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Session navigator */}
              {(sessionCount ?? 1) > 1 && onNavigate && (
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => onNavigate(sessionIndex! - 1)}
                    disabled={sessionIndex === 0}
                    className="text-sm transition-colors"
                    style={{ color: sessionIndex === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)' }}
                  >←</button>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>
                    session {sessionIndex! + 1} of {sessionCount}
                  </span>
                  <button
                    onClick={() => onNavigate(sessionIndex! + 1)}
                    disabled={sessionIndex === sessionCount! - 1}
                    className="text-sm transition-colors"
                    style={{ color: sessionIndex === sessionCount! - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)' }}
                  >→</button>
                </div>
              )}

              {/* Date + close */}
              <div className="flex items-start justify-between mb-4">
                <p className="text-2xl font-bold leading-tight" style={{ color: intensityColor }}>
                  {dateLabel}
                </p>
                <button
                  onClick={onClose}
                  className="ml-3 mt-0.5 shrink-0 text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
                  aria-label="Close"
                >×</button>
              </div>

              {/* Intention banner */}
              {intention && (
                <div
                  className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
                  style={{ backgroundColor: 'rgba(242,228,168,0.07)', border: '1px solid rgba(242,228,168,0.14)' }}
                >
                  <span style={{ color: 'rgba(242,228,168,0.5)', fontSize: 12 }}>◈</span>
                  <span className="text-sm font-semibold" style={{ color: '#F2E4A8' }}>{intention.intent_label}</span>
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

              {/* Stat strip */}
              <div
                className="flex gap-0 mb-5 rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.03)' }}
              >
                {[
                  { label: 'Style',     value: session.gi_nogi === 'gi' ? 'Gi' : 'No-Gi' },
                  { label: 'Type',      value: SESSION_TYPE_LABELS[session.session_type] ?? session.session_type },
                  { label: 'Duration',  value: formatDuration(session.duration) },
                  { label: 'Intensity', value: `${session.intensity} / 5`, color: intensityColor },
                ].map(({ label, value, color }, i, arr) => (
                  <div
                    key={label}
                    className="flex-1 px-3 py-3"
                    style={{ borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}
                  >
                    <p className="text-[10px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
                    <p className="text-sm font-semibold leading-tight" style={{ color: color ?? 'rgba(255,255,255,0.85)' }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Intensity description */}
              <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.30)' }}>
                {INTENSITY_LABEL[session.intensity] ?? ''} effort
              </p>

              {/* Skills */}
              {sessionTagObjects.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-medium mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>SKILLS</p>
                  <div className="flex flex-wrap gap-1.5">
                    {sessionTagObjects.map(({ value, label }) => (
                      <span
                        key={value}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)' }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {session.notes?.trim() ? (
                <div className="mb-5">
                  <p className="text-[10px] font-medium mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>JOURNAL</p>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: 'rgba(255,255,255,0.6)', whiteSpace: 'pre-wrap' }}
                  >
                    {session.notes.trim()}
                  </p>
                </div>
              ) : (
                <p className="text-xs italic mb-5" style={{ color: 'rgba(255,255,255,0.20)' }}>No notes for this session.</p>
              )}

              {/* View actions */}
              <div className="flex items-center justify-between">
                {/* Delete — left side */}
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: 'rgba(196,145,95,0.6)', backgroundColor: 'rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'rgba(239,68,68,0.85)'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(196,145,95,0.6)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                  >
                    Delete session
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Delete this session?</span>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs text-white/40 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                      style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'rgba(239,68,68,0.9)' }}
                    >
                      {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                )}

                {/* Edit — right side */}
                {!confirmDelete && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-brand-orange hover:bg-brand-orange/90 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── BACK FACE — edit form ── */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              pointerEvents: isEditing ? 'auto' : 'none',
              transform: 'rotateY(180deg)',
              backgroundColor: '#152E22',
              border: '1px solid rgba(196,145,95,0.45)',
              borderRadius: '1rem',
              overflowY: 'auto',
              padding: '1.5rem',
            }}
          >
            {/* Date header */}
            <p className="text-2xl font-bold mb-4" style={{ color: intensityColor }}>
              {dateLabel}
            </p>

            {/* Stat tiles — 2×2 grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">

              {/* Style */}
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-white/40 mb-1">Style</p>
                <select
                  className="bg-transparent text-sm font-semibold text-white w-full outline-none"
                  value={form.gi_nogi}
                  onChange={e => setForm(f => ({ ...f, gi_nogi: e.target.value as 'gi' | 'no_gi' }))}
                >
                  <option value="gi"    style={{ backgroundColor: '#152E22' }}>Gi</option>
                  <option value="no_gi" style={{ backgroundColor: '#152E22' }}>No-Gi</option>
                </select>
              </div>

              {/* Type */}
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-white/40 mb-1">Type</p>
                <select
                  className="bg-transparent text-sm font-semibold text-white w-full outline-none"
                  value={form.session_type}
                  onChange={e => setForm(f => ({ ...f, session_type: e.target.value as SessionSummary['session_type'] }))}
                >
                  <option value="class"                style={{ backgroundColor: '#152E22' }}>Class</option>
                  <option value="drilling"             style={{ backgroundColor: '#152E22' }}>Drilling</option>
                  <option value="competition_training" style={{ backgroundColor: '#152E22' }}>Competition</option>
                </select>
              </div>

              {/* Intensity */}
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-white/40 mb-1">Intensity</p>
                <div className="flex gap-1 mt-0.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setForm(f => ({ ...f, intensity: n }))}
                      className="w-8 h-8 rounded text-xs font-bold transition-colors"
                      style={
                        form.intensity === n
                          ? { backgroundColor: INTENSITY_COLOR[n], color: '#152E22' }
                          : { backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }
                      }
                    >{n}</button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-xs text-white/40 mb-1">Duration</p>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {DURATION_PRESETS.map(({ label, minutes }) => (
                    <button
                      key={minutes}
                      onClick={() => selectPreset(minutes)}
                      className={`${chipBase} ${durationPreset === minutes ? chipActive : chipInactive}`}
                      style={durationPreset !== minutes ? { backgroundColor: 'rgba(255,255,255,0.08)' } : {}}
                    >{label}</button>
                  ))}
                  <button
                    onClick={selectCustom}
                    className={`${chipBase} ${durationPreset === 'custom' ? chipActive : chipInactive}`}
                    style={durationPreset !== 'custom' ? { backgroundColor: 'rgba(255,255,255,0.08)' } : {}}
                  >Custom</button>
                </div>
                {durationPreset === 'custom' && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      type="number" min={0} max={12} value={customH}
                      onChange={e => { setCustomH(e.target.value); applyCustom(e.target.value, customM); }}
                      className="w-10 bg-white/10 rounded text-xs text-white text-center outline-none px-1 py-1"
                      placeholder="0"
                    />
                    <span className="text-xs text-white/40">h</span>
                    <input
                      type="number" min={0} max={59} value={customM}
                      onChange={e => { setCustomM(e.target.value); applyCustom(customH, e.target.value); }}
                      className="w-10 bg-white/10 rounded text-xs text-white text-center outline-none px-1 py-1"
                      placeholder="0"
                    />
                    <span className="text-xs text-white/40">m</span>
                  </div>
                )}
              </div>
            </div>

            {/* Skills */}
            <div className="mb-4">
              <p className="text-xs text-white/40 mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {SKILL_TAGS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => toggleTag(value)}
                    className={`${chipBase} ${form.tags.includes(value) ? chipActive : chipInactive}`}
                    style={!form.tags.includes(value) ? { backgroundColor: 'rgba(255,255,255,0.08)' } : {}}
                  >{label}</button>
                ))}
              </div>
            </div>

            {/* Journal */}
            <div className="mb-5">
              <p className="text-xs text-white/40 mb-2">Journal</p>
              <textarea
                rows={4}
                placeholder="Add a note…"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 resize-none outline-none transition-colors border"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderColor: 'rgba(255,255,255,0.18)',
                }}
              />
            </div>

            {/* Edit actions */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => { setSaveError(false); setIsEditing(false); }}
                className="text-sm text-white/40 hover:text-white transition-colors px-4 py-2"
              >
                Cancel
              </button>
              <div className="flex items-center gap-3">
                {saveError && (
                  <p className="text-xs text-red-400">Save failed.</p>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-brand-orange hover:bg-brand-orange/90 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>

        </div>{/* end inner flipper */}
        </div>{/* end outer entrance-animation wrapper */}
      </div>
    </>
  );
}
