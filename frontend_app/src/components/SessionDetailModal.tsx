import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import { COPPER, PALE_YELLOW, GLOW_SOFT, SURFACE_2, SURFACE_3, CARD_GLOW, CARD_GLOW_BORDER, FONT_EDITORIAL } from '../lib/theme.ts';
import { INTENSITY_COLOR } from '../lib/sessionUtils.ts';
import { vibrate } from '../lib/haptics.ts';
import SegmentedToggle from './SegmentedToggle.tsx';
import FocusAreaChips from './FocusAreaChips.tsx';
import PrismShape from './PrismShape.tsx';
import TagPicker from './TagPicker.tsx';
import { selectionsToDistribution, sessionToSelections, type ChipSelection } from '../lib/selectionsToDistribution.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import type { SessionSummary } from './TrainingHeatmap.tsx';
import type { Pillar } from '../types/api.ts';

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
  const isDesktop = useIsDesktop();

  // ── Form state (includes Pillar Engine fields) ──────────────────────────
  const [form, setForm] = useState({
    duration:      session.duration,
    gi_nogi:       session.gi_nogi as GiNoGi,
    intensity:     session.intensity,
    session_type:  session.session_type as SessionType,
    notes:         session.notes ?? '',
    polarity:      (session.polarity ?? null) as Polarity | null,
    sub_skill_tag: session.sub_skill_tag ?? '',
    script_source: (session.script_source ?? null) as ScriptSource | null,
  });

  // Reconstruct chip selections from the existing session record.
  const [selections, setSelections] = useState<ChipSelection[]>(() => sessionToSelections(session));

  // Heading is derived from selections — primary chip wins, else top-weighted
  // (ties broken by selection order).
  const derivedHeading: Pillar | null = (() => {
    if (selections.length === 0) return null;
    const primary = selections.find(s => s.primary);
    if (primary) return primary.pillar;
    const dist = selectionsToDistribution(selections);
    if (!dist) return null;
    let best: Pillar | null = null;
    let bestW = -1;
    for (const s of selections) {
      const w = dist[s.pillar] ?? 0;
      if (w > bestW) { bestW = w; best = s.pillar; }
    }
    return best;
  })();

  // Wipe polarity when the derived heading leaves guard/pins.
  useEffect(() => {
    if (derivedHeading !== 'guard' && derivedHeading !== 'pins' && form.polarity !== null) {
      setForm(f => ({ ...f, polarity: null }));
    }
  }, [derivedHeading, form.polarity]);

  // Tag selections — mirror the LogSessionForm contract so edits don't wipe them
  const [userTagIds, setUserTagIds] = useState<string[]>(session.user_tag_ids ?? []);
  const [canonicalPositionIds, setCanonicalPositionIds] = useState<string[]>(session.canonical_position_ids ?? []);

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
      const distribution = selectionsToDistribution(selections);
      const tagsArr = Array.from(new Set(selections.map(s => s.pillar)));
      // Migration 013 telemetry — recompute on edit so a session originally logged
      // without telemetry (legacy) gains it on first save.
      const had_primary     = selections.some(s => s.primary);
      const had_deep_work   = selections.some(s => s.deep_work);
      const selection_count = selections.length;
      // Migration 014 — per-pillar deep_work set so the saved Prism shape can
      // be rehydrated with halo rings when the user reopens this session.
      const deep_work_pillars = selections.filter(s => s.deep_work).map(s => s.pillar);
      await api.put(`/api/sessions/${session.id}`, {
        duration:      form.duration,
        gi_nogi:       form.gi_nogi,
        intensity:     form.intensity,
        session_type:  form.session_type,
        notes:         form.notes,
        tags:          tagsArr,
        heading:       derivedHeading,
        polarity:      form.polarity,
        sub_skill_tag: form.sub_skill_tag || undefined,
        script_source: form.script_source,
        user_tag_ids:  userTagIds,
        canonical_position_ids: canonicalPositionIds,
        pillar_distribution: distribution ?? undefined,
        had_primary,
        had_deep_work,
        selection_count,
        deep_work_pillars,
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
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map(n => {
        const active = value === n;
        const color = INTENSITY_COLOR[n] ?? '#A8CB72';
        const label = INTENSITY_LABEL[n] ?? '';
        return (
          <button
            key={n}
            type="button"
            disabled={!interactive}
            onClick={interactive ? () => { vibrate(10); setForm(f => ({ ...f, intensity: n })); } : undefined}
            className="flex-1 flex items-center justify-center font-semibold"
            style={{
              height: active ? 44 : 36,
              borderRadius: 10,
              backgroundColor: active ? color : 'rgba(255,255,255,0.05)',
              border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
              color: active ? 'rgba(13,26,20,0.9)' : 'rgba(255,255,255,0.55)',
              fontSize: 12,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: interactive ? 'pointer' : 'default',
              transition: 'all 280ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              boxShadow: active ? `0 0 0 1px ${color}40, 0 8px 20px -8px ${color}80` : 'none',
            }}
          >
            {active ? label : ''}
          </button>
        );
      })}
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
          backgroundColor: 'rgba(13, 26, 20, 1)',
          backdropFilter: 'blur(16px)',
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
        onClick={onClose}
      >
        <div
          className="w-full sm:max-w-md md:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl animate-j2-modal-in"
          onClick={e => e.stopPropagation()}
          style={{
            position: 'relative',
            backgroundColor: '#152E22',
            border: `1px solid ${isDesktop ? CARD_GLOW_BORDER : 'rgba(255,255,255,0.10)'}`,
            borderRadius: isDesktop ? 20 : '1rem',
            boxShadow: isDesktop ? CARD_GLOW : undefined,
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
              padding: isDesktop ? '40px 48px 32px' : '1.25rem',
            }}>
              {isDesktop ? (
                <DesktopViewContent
                  session={session}
                  date={date}
                  dateLabel={dateLabel}
                  intention={intention}
                  intensityColor={intensityColor}
                  headingLabel={headingLabel}
                  selections={selections}
                  sessionCount={sessionCount}
                  sessionIndex={sessionIndex}
                  onNavigate={onNavigate}
                  onClose={onClose}
                  onEdit={() => setIsEditing(true)}
                  confirmDelete={confirmDelete}
                  setConfirmDelete={setConfirmDelete}
                  handleDelete={handleDelete}
                  deleting={deleting}
                />
              ) : (
              <>
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
                <p className="text-2xl font-display font-bold leading-tight" style={{ color: intensityColor }}>
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
                    {/* Pokedex layout: text on the left, static Prism shape on the right.
                        Mirrors the edit-mode layout so the saved shape is visible on read-only reopen. */}
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
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
                      {selections.length > 0 && (
                        <div style={{ flex: '0 0 auto', opacity: 0.95 }}>
                          <PrismShape selections={selections} size={isDesktop ? 160 : 130} showLabels={false} />
                        </div>
                      )}
                    </div>

                    {/* Distribution chips — only shown when session has multi-pillar IDW data */}
                    {(() => {
                      const dist = session.pillar_distribution;
                      if (!dist) return null;
                      const entries = Object.entries(dist).filter(([, v]) => typeof v === 'number' && v > 0.05);
                      if (entries.length < 2) return null; // skip pure-snap sessions
                      const sorted = entries.sort((a, b) => (b[1] as number) - (a[1] as number));
                      return (
                        <div className="mt-3 pt-3 flex flex-wrap items-center gap-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <span className="text-[10px] uppercase tracking-wider mr-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
                            Distribution
                          </span>
                          {sorted.map(([pillar, weight]) => {
                            const label = SKILL_TAGS.find(s => s.value === pillar)?.label ?? pillar;
                            const pct = Math.round((weight as number) * 100);
                            const isPrimary = pillar === session.heading;
                            return (
                              <span
                                key={pillar}
                                className="px-2 py-0.5 rounded-md text-[10px] font-medium"
                                style={{
                                  backgroundColor: isPrimary ? 'rgba(196,145,95,0.20)' : 'rgba(255,255,255,0.06)',
                                  color: isPrimary ? COPPER : 'rgba(255,255,255,0.45)',
                                }}
                              >
                                {label} {pct}%
                              </span>
                            );
                          })}
                        </div>
                      );
                    })()}
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
              </>
              )}
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
              <p className="text-2xl font-display font-bold mb-4" style={{ color: intensityColor }}>{dateLabel}</p>

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

                  {/* Pokedex layout: chips on the left, live Prism shape on the right. */}
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                      <FocusAreaChips selections={selections} onChange={setSelections} />
                    </div>
                    <div style={{ flex: '0 0 auto', opacity: 0.95 }}>
                      <PrismShape selections={selections} size={isDesktop ? 160 : 130} showLabels={false} />
                    </div>
                  </div>

                  {(derivedHeading === 'guard' || derivedHeading === 'pins') && (
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

                  {/* Position tags — canonical + user vocabulary */}
                  <div>
                    <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.40)' }}>
                      Positions <span style={{ color: 'rgba(255,255,255,0.20)' }}>(optional, max 5)</span>
                    </label>
                    <TagPicker
                      selectedUserTagIds={userTagIds}
                      selectedCanonicalIds={canonicalPositionIds}
                      onChange={(u, c) => { setUserTagIds(u); setCanonicalPositionIds(c); }}
                      currentPillar={derivedHeading}
                      maxSelected={5}
                    />
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

// ── Desktop view (editorial layout) ───────────────────────────────────────
//
// Renders the read-only review of a saved session at desktop sizes only.
// The mobile branch above stays untouched. This variant pulls the design
// language from PathAheadPage / AtlasPage / JournalEntryPage: serif display
// heading, copper micro-labels, italic subtitle, CARD_GLOW shell, Pokedex
// hero + stat strip rhythm, generous spacing.

interface DesktopViewContentProps {
  session: SessionSummary;
  date: Date;
  dateLabel: string;
  intention?: IntentionSummary | null;
  intensityColor: string;
  headingLabel: string | null;
  selections: ChipSelection[];
  sessionCount?: number;
  sessionIndex?: number;
  onNavigate?: (index: number) => void;
  onClose: () => void;
  onEdit: () => void;
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  handleDelete: () => Promise<void>;
  deleting: boolean;
}

function resonanceLabel(r: number): string {
  if (r >= 10) return 'Focused';
  if (r >= 8)  return 'Targeted';
  if (r >= 6)  return 'Solid';
  if (r >= 4)  return 'Mixed';
  return 'Exploratory';
}

function DesktopViewContent({
  session, date, dateLabel, intention, intensityColor, headingLabel, selections,
  sessionCount, sessionIndex, onNavigate, onClose, onEdit,
  confirmDelete, setConfirmDelete, handleDelete, deleting,
}: DesktopViewContentProps) {
  const eyebrow = date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase();

  const formatLine = [
    session.gi_nogi === 'gi' ? 'Gi' : 'No-Gi',
    SESSION_TYPE_LABELS[session.session_type] ?? session.session_type,
  ].filter(Boolean).join(' · ');

  const subFacts: string[] = [];
  if (session.script_source) subFacts.push(session.script_source === 'directed' ? 'Coach-led' : 'Open Mat');
  if (session.polarity) subFacts.push(session.polarity);

  const dist = session.pillar_distribution;
  const distEntries = dist
    ? Object.entries(dist).filter(([, v]) => typeof v === 'number' && v > 0.05)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
    : [];
  const showDistribution = distEntries.length >= 2;

  return (
    <div>
      {/* ── Top bar — nav + close ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        {(sessionCount ?? 1) > 1 && onNavigate ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={() => onNavigate(sessionIndex! - 1)}
              disabled={sessionIndex === 0}
              style={{
                fontSize: 18, lineHeight: 1, background: 'none', border: 'none',
                color: sessionIndex === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.50)',
                cursor: sessionIndex === 0 ? 'default' : 'pointer',
                padding: 4,
              }}
            >←</button>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 500 }}>
              Session {sessionIndex! + 1} of {sessionCount}
            </span>
            <button
              onClick={() => onNavigate(sessionIndex! + 1)}
              disabled={sessionIndex === sessionCount! - 1}
              style={{
                fontSize: 18, lineHeight: 1, background: 'none', border: 'none',
                color: sessionIndex === sessionCount! - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.50)',
                cursor: sessionIndex === sessionCount! - 1 ? 'default' : 'pointer',
                padding: 4,
              }}
            >→</button>
          </div>
        ) : <div />}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 36, height: 36, borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.55)',
            fontSize: 18, lineHeight: 1, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 160ms ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.95)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.10)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
          }}
        >×</button>
      </div>

      {/* ── Editorial header ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div className="j2-label-copper" style={{ marginBottom: 12 }}>
          ◇ {eyebrow}
        </div>
        <h2
          className="j2-serif-display j2-heading-glow"
          style={{
            fontSize: 56, lineHeight: 1.05, margin: 0,
            letterSpacing: '-0.015em', color: PALE_YELLOW,
          }}
        >
          {headingLabel ?? 'Session'}
        </h2>
        <p
          className="j2-serif-italic"
          style={{
            marginTop: 12, marginBottom: 0,
            fontSize: 18, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5,
          }}
        >
          {dateLabel}
        </p>
      </div>

      {/* ── Intention banner ─────────────────────────────────────────── */}
      {intention && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 18px', marginBottom: 24,
            background: 'rgba(242,228,168,0.06)',
            border: '1px solid rgba(242,228,168,0.14)',
            borderRadius: 12,
          }}
        >
          <span style={{ color: 'rgba(242,228,168,0.55)', fontSize: 13 }}>◈</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: PALE_YELLOW, letterSpacing: '0.01em' }}>
            {intention.intent_label}
          </span>
          {intention.intent_category && (
            <span
              style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 999,
                background: SURFACE_3, color: 'rgba(255,255,255,0.50)',
                textTransform: 'capitalize', letterSpacing: '0.04em',
              }}
            >
              {intention.intent_category}
            </span>
          )}
        </div>
      )}

      {/* ── Pokedex hero card ────────────────────────────────────────── */}
      {(headingLabel || selections.length > 0) && (
        <div
          style={{
            background: SURFACE_2,
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16,
            padding: 32,
            marginBottom: 22,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: selections.length > 0 ? '1fr auto' : '1fr',
              gap: 36,
              alignItems: 'center',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div className="j2-label-micro" style={{ marginBottom: 12 }}>What you worked on</div>
              <div
                style={{
                  fontFamily: FONT_EDITORIAL, fontWeight: 600,
                  fontSize: 30, lineHeight: 1.1, color: PALE_YELLOW,
                  textShadow: GLOW_SOFT, letterSpacing: '-0.005em',
                }}
              >
                {headingLabel ?? 'Untitled session'}
              </div>

              {(session.sub_skill_tag || session.resonance != null) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
                  {session.sub_skill_tag && (
                    <span
                      style={{
                        padding: '6px 14px', borderRadius: 10,
                        background: SURFACE_3, color: 'rgba(255,255,255,0.65)',
                        fontSize: 13, fontWeight: 500,
                      }}
                    >
                      {session.sub_skill_tag}
                    </span>
                  )}
                  {session.resonance != null && (
                    <span
                      className="j2-serif-italic"
                      style={{ fontSize: 14, color: COPPER, fontStyle: 'italic' }}
                    >
                      {resonanceLabel(session.resonance)}
                    </span>
                  )}
                </div>
              )}

              {showDistribution && (
                <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div
                    style={{
                      fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em',
                      color: 'rgba(255,255,255,0.35)', fontWeight: 600, marginBottom: 10,
                    }}
                  >
                    Distribution
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {distEntries.map(([pillar, weight]) => {
                      const label = SKILL_TAGS.find(s => s.value === pillar)?.label ?? pillar;
                      const pct = Math.round((weight as number) * 100);
                      const isPrimary = pillar === session.heading;
                      return (
                        <span
                          key={pillar}
                          style={{
                            padding: '5px 11px', borderRadius: 8,
                            background: isPrimary ? 'rgba(196,145,95,0.18)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${isPrimary ? 'rgba(196,145,95,0.30)' : 'rgba(255,255,255,0.08)'}`,
                            color: isPrimary ? COPPER : 'rgba(255,255,255,0.55)',
                            fontSize: 12, fontWeight: 500, letterSpacing: '0.01em',
                          }}
                        >
                          {label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{pct}%</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {selections.length > 0 && (
              <div style={{ flex: '0 0 auto' }}>
                <PrismShape selections={selections} size={220} showLabels={true} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Stat strip — Duration / Intensity / Format ────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard label="Duration" value={fmtDuration(session.duration)} valueColor={PALE_YELLOW} />
        <StatCard
          label="Intensity"
          value={INTENSITY_LABEL[session.intensity] ?? '—'}
          valueColor={intensityColor}
          accent={
            <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <div
                  key={n}
                  style={{
                    flex: 1, height: 3, borderRadius: 1.5,
                    background: n <= session.intensity ? intensityColor : 'rgba(255,255,255,0.08)',
                    transition: 'background 200ms ease',
                  }}
                />
              ))}
            </div>
          }
        />
        <StatCard
          label="Format"
          value={formatLine}
          valueColor={PALE_YELLOW}
          valueSize={22}
          accent={subFacts.length > 0 ? (
            <div
              style={{
                marginTop: 10, fontSize: 11, color: COPPER, letterSpacing: '0.14em',
                textTransform: 'uppercase', fontWeight: 500,
              }}
            >
              {subFacts.join(' · ')}
            </div>
          ) : null}
        />
      </div>

      {/* ── Journal ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div className="j2-label-copper" style={{ marginBottom: 14 }}>◇ Journal</div>
        {session.notes?.trim() ? (
          <p
            style={{
              margin: 0, fontFamily: FONT_EDITORIAL, fontSize: 17, lineHeight: 1.7,
              color: 'rgba(255,255,255,0.78)', whiteSpace: 'pre-wrap',
            }}
          >
            {session.notes.trim()}
          </p>
        ) : (
          <p
            className="j2-serif-italic"
            style={{ margin: 0, fontSize: 16, color: 'rgba(255,255,255,0.30)' }}
          >
            No notes recorded.
          </p>
        )}
      </div>

      {/* ── Action row ────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 22, borderTop: '1px solid rgba(196,145,95,0.14)',
        }}
      >
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              fontSize: 13, fontWeight: 500, padding: '10px 18px', borderRadius: 10,
              color: 'rgba(255,255,255,0.50)', background: 'transparent',
              border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer',
              transition: 'all 160ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'rgba(239,68,68,0.90)';
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.30)';
              e.currentTarget.style.background = 'rgba(239,68,68,0.06)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.50)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Delete session
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Delete this session?</span>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{ fontSize: 13, color: 'rgba(255,255,255,0.50)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 8,
                background: 'rgba(239,68,68,0.15)', color: 'rgba(239,68,68,0.95)',
                border: '1px solid rgba(239,68,68,0.30)', cursor: 'pointer',
                opacity: deleting ? 0.5 : 1,
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        )}
        {!confirmDelete && (
          <button
            onClick={onEdit}
            style={{
              height: 50, padding: '0 26px',
              background: '#DA7422', color: '#fff',
              fontWeight: 600, fontSize: 15,
              borderRadius: 12, border: 'none', cursor: 'pointer',
              boxShadow: '0 0 0 1px rgba(218,116,34,0.30), 0 10px 24px -12px rgba(218,116,34,0.60)',
              transition: 'background 180ms ease',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E8823A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#DA7422'; }}
          >
            Edit session →
          </button>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label, value, valueColor, valueSize = 32, accent,
}: {
  label: string;
  value: string;
  valueColor: string;
  valueSize?: number;
  accent?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: SURFACE_2,
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 14,
        padding: '20px 22px',
      }}
    >
      <div className="j2-label-micro" style={{ marginBottom: 10 }}>{label}</div>
      <div
        style={{
          fontFamily: FONT_EDITORIAL, fontWeight: 600,
          fontSize: valueSize, lineHeight: 1.05, color: valueColor,
          letterSpacing: '-0.005em',
        }}
      >
        {value}
      </div>
      {accent}
    </div>
  );
}
