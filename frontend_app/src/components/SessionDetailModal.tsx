import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import { COPPER, PALE_YELLOW, GLOW_SOFT, SURFACE_2, SURFACE_3 } from '../lib/theme.ts';
import { INTENSITY_COLOR } from '../lib/sessionUtils.ts';
import { vibrate } from '../lib/haptics.ts';
import SegmentedToggle from './SegmentedToggle.tsx';
import PillarPrism from './PillarPrism.tsx';
import type { SessionSummary } from './TrainingHeatmap.tsx';

// ── Constants ─────────────────────────────────────────────────────────────

const INTENSITY_LABEL: Record<number, string> = {
  1: 'Light', 2: 'Easy', 3: 'Moderate', 4: 'Hard', 5: 'Max',
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  class: 'Class', drilling: 'Drilling', competition_training: 'Competition',
};

const DURATION_PRESETS = [30, 60, 90, 120];
const DUR_STEP = 30;
const DUR_MIN  = 30;
const DUR_MAX  = 240;

const MODAL_PARTICLES = [
  { left: '7%',  bottom: 3, size: 2, drift: '-4px', duration: 4.1, delay: 0.0 },
  { left: '22%', bottom: 2, size: 2, drift: '5px',  duration: 3.7, delay: 0.9 },
  { left: '40%', bottom: 4, size: 2, drift: '-3px', duration: 4.8, delay: 1.6 },
  { left: '57%', bottom: 2, size: 2, drift: '4px',  duration: 3.4, delay: 0.4 },
  { left: '74%', bottom: 3, size: 2, drift: '-5px', duration: 4.5, delay: 1.2 },
  { left: '89%', bottom: 2, size: 2, drift: '3px',  duration: 3.9, delay: 2.1 },
] as const;

type GiNoGi = 'gi' | 'no_gi';
type SessionType = 'class' | 'drilling' | 'competition_training';
type Polarity = 'offense' | 'defense' | 'neutral';
type ScriptSource = 'directed' | 'organic';

function fmtDuration(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

// ── Component ─────────────────────────────────────────────────────────────

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

  // ── Form state (includes Pillar Engine fields) ──────────────────────────
  const [form, setForm] = useState({
    duration:      session.duration,
    gi_nogi:       session.gi_nogi as GiNoGi,
    intensity:     session.intensity,
    session_type:  session.session_type as SessionType,
    notes:         session.notes ?? '',
    heading:       session.heading ?? null as string | null,
    polarity:      (session.polarity ?? null) as Polarity | null,
    sub_skill_tag: session.sub_skill_tag ?? '',
    script_source: (session.script_source ?? null) as ScriptSource | null,
    resonance:     session.resonance ?? null as number | null,
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Recent sub-skill tags for chip suggestions
  const [recentTags, setRecentTags] = useState<string[]>([]);
  useEffect(() => {
    if (!isEditing) return;
    const from = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    api.get<{ sessions: SessionSummary[] }>(`/api/sessions?from=${from}`)
      .then(r => {
        const tags = (r.sessions ?? [])
          .map(s => s.sub_skill_tag)
          .filter((t): t is string => !!t && t.trim().length > 0);
        setRecentTags([...new Set(tags)].slice(0, 6));
      })
      .catch(() => {});
  }, [isEditing]);

  const intensityColor = INTENSITY_COLOR[session.intensity] ?? '#A8CB72';

  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const headingLabel = session.heading
    ? (SKILL_TAGS.find(s => s.value === session.heading)?.label ?? session.heading)
    : null;

  // ── Handlers ────────────────────────────────────────────────────────────

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
      await api.put(`/api/sessions/${session.id}`, {
        duration:      form.duration,
        gi_nogi:       form.gi_nogi,
        intensity:     form.intensity,
        session_type:  form.session_type,
        notes:         form.notes,
        tags:          form.heading ? [form.heading] : [],
        heading:       form.heading,
        polarity:      form.polarity,
        sub_skill_tag: form.sub_skill_tag || undefined,
        script_source: form.script_source,
        resonance:     form.resonance,
      });
      onSaved();
      onClose();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  // ── Shared intensity bar (used in both view & edit) ─────────────────────
  const IntensityBar = ({ value, interactive }: { value: number; interactive?: boolean }) => (
    <div className="space-y-1.5">
      <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
        {[1, 2, 3, 4, 5].map(n => {
          const active = value === n;
          const color = INTENSITY_COLOR[n] ?? '#A8CB72';
          return (
            <button
              key={n}
              type="button"
              disabled={!interactive}
              onClick={interactive ? () => { vibrate(10); setForm(f => ({ ...f, intensity: n })); } : undefined}
              className="flex-1 flex items-center justify-center font-semibold transition-all"
              style={{
                height: active ? 44 : 40,
                backgroundColor: active ? color : `${color}33`,
                color: active ? '#152E22' : `${color}88`,
                fontSize: active ? 16 : 14,
                cursor: interactive ? 'pointer' : 'default',
                transition: 'height 200ms ease, background-color 200ms ease, color 200ms ease',
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex">
        {Object.values(INTENSITY_LABEL).map((label, i) => (
          <span
            key={label}
            className="flex-1 text-center"
            style={{
              fontSize: 9,
              color: value === i + 1 ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.22)',
              fontWeight: value === i + 1 ? 600 : 400,
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return createPortal(
    <>
      <div
        data-no-page-swipe=""
        role="dialog"
        aria-modal="true"
        aria-label={`Session details for ${dateLabel}`}
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 animate-j2-backdrop-in"
        style={{
          backgroundColor: 'rgba(13, 26, 20, 0.97)',
          backdropFilter: 'blur(16px)',
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
        onClick={onClose}
      >
        <div
          className="w-full sm:max-w-md animate-j2-modal-in"
          onClick={e => e.stopPropagation()}
          style={{
            position: 'relative',
            backgroundColor: '#152E22',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '1rem',
            overflow: 'hidden',
          }}
        >

          {/* ════════════════════════════════════════════════════════════
              VIEW PANEL
              ════════════════════════════════════════════════════════════ */}
          <div
            style={{
              position: isEditing ? 'absolute' : 'relative',
              inset: 0,
              transition: 'opacity 280ms ease, transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
              opacity: isEditing ? 0 : 1,
              transform: isEditing ? 'translateX(-16px)' : 'translateX(0)',
              pointerEvents: isEditing ? 'none' : 'auto',
            }}
          >
            {/* Intention particle layer */}
            {intention && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden', borderRadius: 16 }}>
                <div style={{
                  position: 'absolute', bottom: -12, left: '50%', transform: 'translateX(-50%)',
                  width: '55%', height: 56, borderRadius: '50%',
                  background: 'radial-gradient(ellipse at center bottom, rgba(167,139,250,0.18) 0%, transparent 80%)',
                  animation: 'j2IntentPurplePulse 4.2s ease-in-out infinite',
                }} />
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
                  background: 'linear-gradient(to top, rgba(242,228,168,0.07) 0%, transparent 100%)',
                  animation: 'j2IntentYellowPulse 3.1s ease-in-out infinite', transformOrigin: 'center bottom',
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

            <div style={{
              position: 'relative', zIndex: 1,
              overflowY: 'auto',
              maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
              padding: '1.25rem',
            }}>
              {/* Session navigator */}
              {(sessionCount ?? 1) > 1 && onNavigate && (
                <div className="flex items-center gap-2 mb-3">
                  <button onClick={() => onNavigate(sessionIndex! - 1)} disabled={sessionIndex === 0}
                    className="text-sm transition-colors" style={{ color: sessionIndex === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)' }}>
                    ←
                  </button>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>
                    session {sessionIndex! + 1} of {sessionCount}
                  </span>
                  <button onClick={() => onNavigate(sessionIndex! + 1)} disabled={sessionIndex === sessionCount! - 1}
                    className="text-sm transition-colors" style={{ color: sessionIndex === sessionCount! - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)' }}>
                    →
                  </button>
                </div>
              )}

              {/* Date + close */}
              <div className="flex items-start justify-between mb-4">
                <p className="text-2xl font-bold leading-tight" style={{ color: intensityColor }}>
                  {dateLabel}
                </p>
                <button onClick={onClose}
                  className="ml-3 mt-0.5 shrink-0 text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
                  aria-label="Close">
                  ×
                </button>
              </div>

              {/* Intention banner */}
              {intention && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
                  style={{ backgroundColor: 'rgba(242,228,168,0.07)', border: '1px solid rgba(242,228,168,0.14)' }}>
                  <span style={{ color: 'rgba(242,228,168,0.5)', fontSize: 12 }}>◈</span>
                  <span className="text-sm font-semibold" style={{ color: PALE_YELLOW }}>{intention.intent_label}</span>
                  {intention.intent_category && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full capitalize"
                      style={{ backgroundColor: SURFACE_3, color: 'rgba(255,255,255,0.45)' }}>
                      {intention.intent_category}
                    </span>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {/* ── Stats card ───────────────────────────── */}
                <div className="rounded-xl px-4 py-4 space-y-3" style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}>
                  {/* Style + Type pills */}
                  <div className="flex gap-2">
                    <span className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: SURFACE_3, color: 'rgba(255,255,255,0.65)' }}>
                      {session.gi_nogi === 'gi' ? 'Gi' : 'No-Gi'}
                    </span>
                    <span className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: SURFACE_3, color: 'rgba(255,255,255,0.65)' }}>
                      {SESSION_TYPE_LABELS[session.session_type] ?? session.session_type}
                    </span>
                    {session.script_source && (
                      <span className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: SURFACE_3, color: COPPER }}>
                        {session.script_source === 'directed' ? 'Coach-led' : 'Open Mat'}
                      </span>
                    )}
                  </div>

                  {/* Duration — large */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold" style={{ color: PALE_YELLOW }}>{fmtDuration(session.duration)}</span>
                    {session.polarity && (
                      <span className="text-xs font-medium capitalize" style={{ color: COPPER }}>
                        {session.polarity}
                      </span>
                    )}
                  </div>

                  {/* Intensity bar (read-only) */}
                  <IntensityBar value={session.intensity} />
                </div>

                {/* ── Focus card ───────────────────────────── */}
                {headingLabel && (
                  <div className="rounded-xl px-4 py-4" style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      Focus
                    </span>
                    <p className="text-base font-semibold mt-1" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
                      {headingLabel}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {session.sub_skill_tag && (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: SURFACE_3, color: 'rgba(255,255,255,0.50)' }}>
                          {session.sub_skill_tag}
                        </span>
                      )}
                      {session.resonance != null && (
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>
                          {session.resonance >= 10 ? 'Focused' : session.resonance >= 8 ? 'Targeted' : session.resonance >= 6 ? 'Solid' : session.resonance >= 4 ? 'Mixed' : 'Exploratory'}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Journal card ─────────────────────────── */}
                <div className="rounded-xl px-4 py-4" style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Journal
                  </span>
                  {session.notes?.trim() ? (
                    <p className="text-sm leading-relaxed mt-2" style={{ color: 'rgba(255,255,255,0.6)', whiteSpace: 'pre-wrap' }}>
                      {session.notes.trim()}
                    </p>
                  ) : (
                    <p className="text-xs italic mt-2" style={{ color: 'rgba(255,255,255,0.20)' }}>No notes recorded.</p>
                  )}
                </div>
              </div>

              {/* ── Action row ─────────────────────────────── */}
              <div className="flex items-center justify-between mt-5 pt-3" style={{ borderTop: '1px solid rgba(196,145,95,0.12)' }}>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: 'rgba(196,145,95,0.6)', backgroundColor: SURFACE_2 }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'rgba(239,68,68,0.85)'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(196,145,95,0.6)'; e.currentTarget.style.backgroundColor = SURFACE_2; }}
                  >
                    Delete session
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Delete?</span>
                    <button onClick={() => setConfirmDelete(false)} className="text-xs text-white/40 hover:text-white transition-colors">Cancel</button>
                    <button onClick={handleDelete} disabled={deleting}
                      className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                      style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: 'rgba(239,68,68,0.9)' }}>
                      {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                )}
                {!confirmDelete && (
                  <button onClick={() => setIsEditing(true)}
                    className="text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors touch-manipulation"
                    style={{ backgroundColor: COPPER, color: '#fff' }}>
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════
              EDIT PANEL
              ════════════════════════════════════════════════════════════ */}
          <div
            style={{
              position: isEditing ? 'relative' : 'absolute',
              inset: 0,
              transition: 'opacity 280ms ease, transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
              opacity: isEditing ? 1 : 0,
              transform: isEditing ? 'translateX(0)' : 'translateX(16px)',
              pointerEvents: isEditing ? 'auto' : 'none',
            }}
          >
            <div style={{
              overflowY: 'auto',
              maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
              padding: '1.25rem',
            }}>
              {/* Date header */}
              <p className="text-2xl font-bold mb-4" style={{ color: intensityColor }}>{dateLabel}</p>

              <div className="space-y-4">
                {/* ── Basics card ───────────────────────────── */}
                <div className="rounded-xl px-4 py-4 space-y-4" style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    The Basics
                  </span>

                  <SegmentedToggle
                    options={[{ value: 'gi' as GiNoGi, label: 'Gi' }, { value: 'no_gi' as GiNoGi, label: 'No-Gi' }]}
                    value={form.gi_nogi}
                    onChange={v => v && setForm(f => ({ ...f, gi_nogi: v }))}
                  />

                  <SegmentedToggle
                    options={[
                      { value: 'class' as SessionType, label: 'Class' },
                      { value: 'drilling' as SessionType, label: 'Drilling' },
                      { value: 'competition_training' as SessionType, label: 'Competition' },
                    ]}
                    value={form.session_type}
                    onChange={v => v && setForm(f => ({ ...f, session_type: v }))}
                  />

                  {/* Duration presets + stepper */}
                  <div className="space-y-2">
                    <div className="flex gap-1.5">
                      {DURATION_PRESETS.map(m => {
                        const active = form.duration === m;
                        return (
                          <button key={m} type="button"
                            onClick={() => { vibrate(8); setForm(f => ({ ...f, duration: m })); }}
                            className="flex-1 h-9 rounded-[10px] text-xs font-medium transition-all touch-manipulation"
                            style={{
                              backgroundColor: active ? COPPER : SURFACE_3,
                              color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                            }}>
                            {fmtDuration(m)}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-center gap-3 rounded-xl py-2" style={{ backgroundColor: SURFACE_3 }}>
                      <button type="button"
                        onClick={() => { vibrate(8); setForm(f => ({ ...f, duration: Math.max(DUR_MIN, f.duration - DUR_STEP) })); }}
                        className="w-11 h-11 rounded-lg text-lg font-semibold transition-colors touch-manipulation"
                        style={{ backgroundColor: SURFACE_2, color: 'rgba(255,255,255,0.55)' }}
                        disabled={form.duration <= DUR_MIN}>
                        −
                      </button>
                      <span className="text-xl font-bold w-28 text-center" style={{ color: PALE_YELLOW }}>
                        {fmtDuration(form.duration)}
                      </span>
                      <button type="button"
                        onClick={() => { vibrate(8); setForm(f => ({ ...f, duration: Math.min(DUR_MAX, f.duration + DUR_STEP) })); }}
                        className="w-11 h-11 rounded-lg text-lg font-semibold transition-colors touch-manipulation"
                        style={{ backgroundColor: SURFACE_2, color: 'rgba(255,255,255,0.55)' }}
                        disabled={form.duration >= DUR_MAX}>
                        +
                      </button>
                    </div>
                  </div>

                  {/* Intensity color bar */}
                  <IntensityBar value={form.intensity} interactive />
                </div>

                {/* ── Focus card ────────────────────────────── */}
                <div className="rounded-xl px-4 py-4 space-y-4" style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 className="text-sm font-semibold" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
                    What did you work on?
                  </h3>

                  <PillarPrism
                    heading={form.heading}
                    resonance={form.resonance}
                    defaultHeading={form.heading ?? undefined}
                    onSelect={(h, r) => { setForm(f => ({ ...f, heading: h, resonance: r, polarity: f.heading !== h ? null : f.polarity })); }}
                  />

                  {(form.heading === 'guard' || form.heading === 'pins') && (
                    <div>
                      <SegmentedToggle
                        options={[
                          { value: 'defense' as Polarity, label: 'Defense' },
                          { value: 'neutral' as Polarity, label: 'Neutral' },
                          { value: 'offense' as Polarity, label: 'Offense' },
                        ]}
                        value={form.polarity}
                        onChange={v => setForm(f => ({ ...f, polarity: v }))}
                        deselectable
                      />
                      <p className="text-[10px] mt-1.5 text-center" style={{ color: 'rgba(255,255,255,0.22)' }}>
                        What side of the exchange were you primarily on?
                      </p>
                    </div>
                  )}

                  <div>
                    <SegmentedToggle
                      options={[
                        { value: 'directed' as ScriptSource, label: 'Coach-led' },
                        { value: 'organic' as ScriptSource, label: 'Open Mat' },
                      ]}
                      value={form.script_source}
                      onChange={v => setForm(f => ({ ...f, script_source: v }))}
                      deselectable
                    />
                    <p className="text-[10px] mt-1.5 text-center" style={{ color: 'rgba(255,255,255,0.22)' }}>
                      Was this instructor-led or self-directed?
                    </p>
                  </div>
                </div>

                {/* ── Details card ──────────────────────────── */}
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
                      type="text" maxLength={50}
                      value={form.sub_skill_tag}
                      onChange={e => setForm(f => ({ ...f, sub_skill_tag: e.target.value }))}
                      placeholder="e.g. K-Guard, Single Leg, Guillotine"
                      className="w-full border rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors"
                      style={{ backgroundColor: SURFACE_3, borderColor: 'rgba(255,255,255,0.08)' }}
                    />
                    {recentTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {recentTags.map(tag => {
                          const active = form.sub_skill_tag === tag;
                          return (
                            <button key={tag} type="button"
                              onClick={() => { vibrate(6); setForm(f => ({ ...f, sub_skill_tag: f.sub_skill_tag === tag ? '' : tag })); }}
                              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all touch-manipulation"
                              style={{
                                backgroundColor: active ? COPPER : SURFACE_3,
                                color: active ? '#fff' : 'rgba(255,255,255,0.40)',
                              }}>
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
                      rows={3} value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="What stood out today?"
                      className="w-full rounded-xl px-4 py-2.5 text-sm text-white/90 placeholder-white/25 outline-none resize-none transition-colors"
                      style={{ backgroundColor: SURFACE_3, border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                  </div>
                </div>
              </div>

              {/* ── Action row ─────────────────────────────── */}
              {saveError && <p className="text-red-400 text-xs mt-3">Save failed — please try again.</p>}

              <div className="flex items-center gap-3 mt-5 pt-3" style={{ borderTop: '1px solid rgba(196,145,95,0.12)' }}>
                <button
                  onClick={() => { setSaveError(false); setIsEditing(false); }}
                  className="px-4 py-3 text-sm font-medium transition-colors touch-manipulation"
                  style={{ color: 'rgba(255,255,255,0.40)' }}>
                  Cancel
                </button>
                <button
                  onClick={handleSave} disabled={saving}
                  className="flex-1 text-white font-semibold rounded-xl transition-all touch-manipulation disabled:opacity-50"
                  style={{ height: 52, backgroundColor: '#DA7422', boxShadow: '0 2px 12px rgba(218,116,34,0.25)', fontSize: 16 }}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>,
    document.body
  );
}
