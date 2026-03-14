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

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface Props {
  session: SessionSummary;
  date: Date;
  onClose: () => void;
  onSaved: () => void;
}

export default function SessionDetailModal({ session, date, onClose, onSaved }: Props) {
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
    try {
      await api.put(`/api/sessions/${session.id}`, form);
      onSaved();
      onClose();
    } catch {
      // surface error in future iteration
    } finally {
      setSaving(false);
    }
  };

  const chipBase = 'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer';
  const chipActive = 'bg-brand-orange text-white';
  const chipInactive = 'bg-white/8 text-white/55 hover:bg-white/15';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4"
      style={{ backgroundColor: 'rgba(38, 70, 83, 0.85)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 border border-white/10"
        style={{ backgroundColor: '#1a2c38' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Date — colored by intensity */}
        <p className="text-2xl font-bold mb-5" style={{ color: intensityColor }}>
          {dateLabel}
        </p>

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
  );
}
