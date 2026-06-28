import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import { COPPER, PALE_YELLOW, GLOW_SOFT, SURFACE_2, SURFACE_3, CARD_GLOW, CARD_GLOW_BORDER, FONT_EDITORIAL, INT_LABELS } from '../lib/theme.ts';
import { INTENSITY_COLOR, formatGiNogi } from '../lib/sessionUtils.ts';
import { vibrate } from '../lib/haptics.ts';
import SegmentedToggle from './SegmentedToggle.tsx';
import FocusAreaChips from './FocusAreaChips.tsx';
import PrismShape from './PrismShape.tsx';
import TagPicker from './TagPicker.tsx';
import { selectionsToDistribution, sessionToSelections, type ChipSelection } from '../lib/selectionsToDistribution.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { useUserTags } from '../hooks/useUserTags.ts';
import { useCanonicalPositions } from '../hooks/useCanonicalPositions.ts';
import { useUserConstraints } from '../hooks/useUserConstraints.ts';
import { useCanonicalConstraints } from '../hooks/useCanonicalConstraints.ts';
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
  // Optional pillar heading. Drives the editorial banner's serif title
  // (resolved through SKILL_TAGS to a pretty label, with intent_label
  // falling back when no heading is set). Optional so existing narrowed
  // call-sites continue to type-check without forcing every caller to
  // supply it; the banner gracefully degrades to intent_label.
  heading?: string | null;
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
  const navigate = useNavigate();
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

  // Resolve constraint / tag IDs to display names. Hooks fire once per modal
  // mount; the by-id maps cache reactively. When a session has no tag /
  // constraint / partner data, the resolved arrays are empty and the
  // corresponding chip rows simply don't render.
  const { byId: userTagById } = useUserTags();
  const { byId: canonicalPositionById } = useCanonicalPositions();
  const { byId: userConstraintById } = useUserConstraints();
  const { byId: canonicalConstraintById } = useCanonicalConstraints();

  const resolvedTechTags = useMemo<Array<{ id: string; name: string; isUserTag: boolean }>>(() => {
    const tags: Array<{ id: string; name: string; isUserTag: boolean }> = [];
    for (const id of session.canonical_position_ids ?? []) {
      const p = canonicalPositionById.get(id);
      if (p) tags.push({ id, name: p.name, isUserTag: false });
    }
    for (const id of session.user_tag_ids ?? []) {
      const t = userTagById.get(id);
      if (t) tags.push({ id, name: t.name, isUserTag: true });
    }
    return tags;
  }, [session.canonical_position_ids, session.user_tag_ids, canonicalPositionById, userTagById]);

  const resolvedConstraints = useMemo<string[]>(() => {
    const names: string[] = [];
    for (const id of session.canonical_constraint_ids ?? []) {
      const c = canonicalConstraintById.get(id);
      if (c) names.push(c.name);
    }
    for (const id of session.user_constraint_ids ?? []) {
      const c = userConstraintById.get(id);
      if (c) names.push(c.name);
    }
    return names;
  }, [session.canonical_constraint_ids, session.user_constraint_ids, canonicalConstraintById, userConstraintById]);

  const resolvedPartners = session.partners ?? [];

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

  // Intention focus label — same derivation as IntentionHeroCard. Title shows
  // the pretty pillar label when the intention has a heading set, falling
  // back to intent_label otherwise. Italic dek below shows intent_label when
  // it adds info beyond the title (i.e. user typed flavor copy distinct
  // from the auto-derived pillar name).
  const intentionFocusLabel = intention
    ? (intention.heading
        ? (SKILL_TAGS.find(s => s.value === intention.heading)?.label ?? intention.heading)
        : intention.intent_label)
    : null;
  const showIntentionDek = !!intention?.intent_label
    && !!intentionFocusLabel
    && intention.intent_label.trim().toLowerCase() !== intentionFocusLabel.toLowerCase();

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
            className="flex-1 flex items-center justify-center touch-manipulation"
            style={{
              height: 36,
              borderRadius: 8,
              backgroundColor: active ? color : 'transparent',
              border: 'none',
              color: active ? 'rgba(13,26,20,0.9)' : 'rgba(255,255,255,0.30)',
              fontSize: 11,
              fontWeight: active ? 700 : 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: interactive ? 'pointer' : 'default',
              transition: 'all 200ms ease',
            }}
          >
            {label}
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
            backgroundColor: isDesktop ? '#152E22' : 'transparent',
            border: isDesktop ? `1px solid ${CARD_GLOW_BORDER}` : 'none',
            borderRadius: isDesktop ? 20 : 0,
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
                  resolvedConstraints={resolvedConstraints}
                  resolvedTechTags={resolvedTechTags}
                  resolvedPartners={resolvedPartners}
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
              <div className="flex items-start justify-between mb-3">
                <p style={{ fontFamily: FONT_EDITORIAL, fontWeight: 500, fontSize: 32, lineHeight: 1.1, color: intensityColor, margin: 0 }}>
                  {dateLabel}
                </p>
                <button onClick={onClose}
                  className="ml-3 mt-1 shrink-0 transition-colors"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'rgba(255,255,255,0.25)' }}
                  aria-label="Close">
                  ×
                </button>
              </div>

              {/* Metadata line — duration · intensity · gi · type · source */}
              <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 7, marginBottom: 24 }}>
                <span style={{ fontFamily: FONT_EDITORIAL, fontWeight: 500, fontSize: 28, color: PALE_YELLOW }}>{fmtDuration(session.duration)}</span>
                <span style={{ color: 'rgba(196,145,95,0.25)', fontSize: 14 }}>·</span>
                <span style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 17, color: COPPER }}>
                  {INT_LABELS[session.intensity] ?? `Intensity ${session.intensity}`}
                </span>
                <span style={{ color: 'rgba(196,145,95,0.25)', fontSize: 14 }}>·</span>
                <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)' }}>{formatGiNogi(session.gi_nogi)}</span>
                <span style={{ color: 'rgba(196,145,95,0.25)', fontSize: 14 }}>·</span>
                <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)' }}>{SESSION_TYPE_LABELS[session.session_type] ?? session.session_type}</span>
                {session.script_source && (
                  <>
                    <span style={{ color: 'rgba(196,145,95,0.25)', fontSize: 14 }}>·</span>
                    <span style={{ fontSize: 15, color: COPPER }}>{session.script_source === 'directed' ? 'Coach-led' : 'Open Mat'}</span>
                  </>
                )}
                {session.polarity && (
                  <>
                    <span style={{ color: 'rgba(196,145,95,0.25)', fontSize: 14 }}>·</span>
                    <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', textTransform: 'capitalize' }}>{session.polarity}</span>
                  </>
                )}
              </div>

              {/* Intention banner — editorial chrome matching IntentionHeroCard.
                  Copper-tinted bg + border, radial champagne highlight from
                  top-right, ◇ kicker + serif title + italic dek. Mobile size. */}
              {intention && (
                <div
                  className="mb-4"
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    padding: '14px 16px',
                    borderRadius: 14,
                    background: 'rgba(196,145,95,0.04)',
                    border: '1px solid rgba(196,145,95,0.22)',
                  }}
                >
                  {/* Radial champagne highlight from the top-right */}
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute', inset: 0,
                      background: 'radial-gradient(circle at 100% 0%, rgba(242,228,168,0.08), transparent 60%)',
                      pointerEvents: 'none',
                    }}
                  />
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div className="j2-label-copper" style={{ marginBottom: 6 }}>
                      ◇ This week's focus
                    </div>
                    <div
                      className="j2-serif-display"
                      style={{
                        fontSize: 20,
                        lineHeight: 1.15,
                        color: PALE_YELLOW,
                        letterSpacing: '-0.005em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {intentionFocusLabel}
                    </div>
                    {showIntentionDek && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 13,
                          color: 'rgba(255,255,255,0.55)',
                          fontStyle: 'italic',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {intention.intent_label}
                      </div>
                    )}
                    {intention.intent_category && (
                      <div style={{ marginTop: 8 }}>
                        <span
                          className="capitalize"
                          style={{
                            fontSize: 11,
                            padding: '3px 10px',
                            borderRadius: 999,
                            background: 'rgba(196,145,95,0.14)',
                            color: COPPER,
                            letterSpacing: '0.06em',
                            fontWeight: 600,
                          }}
                        >
                          {intention.intent_category}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-0">

                {/* ── Focus ───────────────────────────── */}
                {headingLabel && (
                  <div className="pb-5" style={{ borderBottom: '1px solid rgba(196,145,95,0.08)' }}>
                    <p style={{ fontFamily: FONT_EDITORIAL, fontWeight: 500, fontSize: 28, color: PALE_YELLOW, textShadow: GLOW_SOFT, margin: 0 }}>
                      {headingLabel}
                    </p>
                    {(session.sub_skill_tag || session.resonance != null) && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                        {session.sub_skill_tag && (
                          <span style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 16, color: 'rgba(255,255,255,0.45)' }}>
                            {session.sub_skill_tag}
                          </span>
                        )}
                        {session.resonance != null && (
                          <span style={{ fontSize: 12, color: 'rgba(196,145,95,0.50)' }}>
                            {session.resonance >= 10 ? 'Focused' : session.resonance >= 8 ? 'Targeted' : session.resonance >= 6 ? 'Solid' : session.resonance >= 4 ? 'Mixed' : 'Exploratory'}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Constraint row — CLA / any session with a constraint logged */}
                    {resolvedConstraints.length > 0 && (
                      <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <div className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: PALE_YELLOW, letterSpacing: '0.16em' }}>
                          Constraint
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {resolvedConstraints.map(name => (
                            <span
                              key={name}
                              className="px-2.5 py-1 rounded-md text-xs font-medium"
                              style={{ backgroundColor: 'rgba(196,145,95,0.18)', color: COPPER }}
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tech Tags row — canonical positions + user customs combined */}
                    {resolvedTechTags.length > 0 && (
                      <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                        <div className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: PALE_YELLOW, letterSpacing: '0.16em' }}>
                          Tech Tags
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {resolvedTechTags.map(tag => (
                            <button
                              key={tag.id}
                              onClick={e => { e.stopPropagation(); onClose(); navigate(tag.isUserTag ? `/techniques/${tag.id}` : `/library`); }}
                              className="px-2.5 py-1 rounded-md text-xs font-medium touch-manipulation"
                              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(196,145,95,0.70)', border: 'none', cursor: 'pointer' }}
                            >
                              {tag.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Distribution — inline text */}
                    {(() => {
                      const dist = session.pillar_distribution;
                      if (!dist) return null;
                      const entries = Object.entries(dist).filter(([, v]) => typeof v === 'number' && v > 0.05);
                      if (entries.length < 2) return null;
                      const sorted = entries.sort((a, b) => (b[1] as number) - (a[1] as number));
                      return (
                        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.40)', marginTop: 10 }}>
                          {sorted.map(([pillar, weight], i) => {
                            const label = SKILL_TAGS.find(s => s.value === pillar)?.label ?? pillar;
                            const pct = Math.round((weight as number) * 100);
                            const isPrimary = pillar === session.heading;
                            return (
                              <span key={pillar}>
                                {i > 0 && <span style={{ color: 'rgba(196,145,95,0.25)', margin: '0 4px' }}>·</span>}
                                <span style={{ color: isPrimary ? COPPER : 'rgba(255,255,255,0.45)' }}>{label} {pct}%</span>
                              </span>
                            );
                          })}
                        </p>
                      );
                    })()}
                  </div>
                )}

                {/* ── Resonance card ─────────────────────────
                    Holds embodied/reflective prose AND social layer (partners).
                    Renamed from "Journal" to mirror the log form's section eyebrow. */}
                <div className="pt-5 pb-4">
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
                    Resonance
                  </span>
                  {session.notes?.trim() ? (
                    <p style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.55)', whiteSpace: 'pre-wrap', marginTop: 8 }}>
                      {session.notes.trim()}
                    </p>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="touch-manipulation"
                      style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 17, color: COPPER, opacity: 0.6, background: 'none', border: 'none', borderBottom: '1px solid rgba(196,145,95,0.25)', cursor: 'pointer', padding: 0, marginTop: 10, display: 'block' }}
                    >
                      What stood out today? →
                    </button>
                  )}

                  {/* Partners chip strip — social-as-data layer */}
                  {resolvedPartners.length > 0 && (
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: PALE_YELLOW, letterSpacing: '0.16em' }}>
                        Partners
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {resolvedPartners.map((name, i) => (
                          <span
                            key={`${name}-${i}`}
                            className="px-2.5 py-1 rounded-md text-xs font-medium"
                            style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)' }}
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Action row ─────────────────────────────── */}
              <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: '1px solid rgba(196,145,95,0.08)' }}>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="touch-manipulation"
                    style={{ fontSize: 15, color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Delete
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <span style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 13, color: 'rgba(255,255,255,0.40)' }}>Delete this session?</span>
                    <button onClick={() => setConfirmDelete(false)} style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleDelete} disabled={deleting}
                      style={{ fontSize: 12, fontWeight: 600, color: 'rgba(239,68,68,0.85)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      {deleting ? 'Deleting...' : 'Confirm'}
                    </button>
                  </div>
                )}
                {!confirmDelete && (
                  <button onClick={() => setIsEditing(true)}
                    className="touch-manipulation"
                    style={{ fontFamily: FONT_EDITORIAL, fontWeight: 700, fontStyle: 'normal', fontSize: 18, color: PALE_YELLOW, textShadow: GLOW_SOFT, background: 'none', border: 'none', cursor: 'pointer' }}>
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
              <p style={{ fontFamily: FONT_EDITORIAL, fontWeight: 500, fontSize: 32, lineHeight: 1.1, color: intensityColor, margin: '0 0 16px' }}>{dateLabel}</p>

              <div className="space-y-5">
                {/* ── Basics ───────────────────────────── */}
                <div className="space-y-4 pb-5" style={{ borderBottom: '1px solid rgba(196,145,95,0.08)' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
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
                    <div className="flex items-center justify-center gap-3 py-2">
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

                {/* ── Focus ────────────────────────────── */}
                <div className="space-y-4 pb-5" style={{ borderBottom: '1px solid rgba(196,145,95,0.08)' }}>
                  <h3 style={{ fontFamily: FONT_EDITORIAL, fontWeight: 500, fontSize: 18, color: PALE_YELLOW, textShadow: GLOW_SOFT, margin: 0 }}>
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

                {/* ── Details ──────────────────────────── */}
                <div className="space-y-3">
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
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

              <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: '1px solid rgba(196,145,95,0.08)' }}>
                <button
                  onClick={() => { setSaveError(false); setIsEditing(false); }}
                  className="touch-manipulation"
                  style={{ fontSize: 15, color: 'rgba(255,255,255,0.30)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Cancel
                </button>
                <button
                  onClick={handleSave} disabled={saving}
                  className="touch-manipulation disabled:opacity-50"
                  style={{ fontFamily: FONT_EDITORIAL, fontWeight: 700, fontStyle: 'normal', fontSize: 18, color: PALE_YELLOW, textShadow: GLOW_SOFT, background: 'none', border: 'none', cursor: 'pointer' }}>
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
  // Resolved display arrays from canonical/user lookups (parent computes via hooks)
  resolvedConstraints: string[];
  resolvedTechTags: Array<{ id: string; name: string; isUserTag: boolean }>;
  resolvedPartners: string[];
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
  resolvedConstraints, resolvedTechTags, resolvedPartners,
  sessionCount, sessionIndex, onNavigate, onClose, onEdit,
  confirmDelete, setConfirmDelete, handleDelete, deleting,
}: DesktopViewContentProps) {
  const eyebrow = date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase();

  // Intention focus label — same derivation as the mobile branch + IntentionHeroCard.
  // Title shows the pretty pillar label when the intention has a heading set,
  // falling back to intent_label otherwise. Italic dek shows intent_label when
  // it adds info beyond the title.
  const intentionFocusLabel = intention
    ? (intention.heading
        ? (SKILL_TAGS.find(s => s.value === intention.heading)?.label ?? intention.heading)
        : intention.intent_label)
    : null;
  const showIntentionDek = !!intention?.intent_label
    && !!intentionFocusLabel
    && intention.intent_label.trim().toLowerCase() !== intentionFocusLabel.toLowerCase();

  const formatLine = [
    formatGiNogi(session.gi_nogi),
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

      {/* ── Intention banner — editorial chrome matching IntentionHeroCard.
          Copper-tinted bg + border, radial champagne highlight from
          top-right, ◇ kicker + serif title + italic dek. Desktop size. */}
      {intention && (
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            padding: '18px 22px',
            marginBottom: 24,
            borderRadius: 14,
            background: 'rgba(196,145,95,0.04)',
            border: '1px solid rgba(196,145,95,0.22)',
          }}
        >
          {/* Radial champagne highlight from the top-right */}
          <div
            aria-hidden
            style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(circle at 100% 0%, rgba(242,228,168,0.08), transparent 60%)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="j2-label-copper" style={{ marginBottom: 8 }}>
              ◇ This week's focus
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
              <div
                className="j2-serif-display"
                style={{
                  fontSize: 24,
                  lineHeight: 1.15,
                  color: PALE_YELLOW,
                  letterSpacing: '-0.005em',
                }}
              >
                {intentionFocusLabel}
              </div>
              {intention.intent_category && (
                <span
                  className="capitalize"
                  style={{
                    fontSize: 11,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: 'rgba(196,145,95,0.14)',
                    color: COPPER,
                    letterSpacing: '0.06em',
                    fontWeight: 600,
                  }}
                >
                  {intention.intent_category}
                </span>
              )}
            </div>
            {showIntentionDek && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 14,
                  color: 'rgba(255,255,255,0.55)',
                  fontStyle: 'italic',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {intention.intent_label}
              </div>
            )}
          </div>
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

              {/* Constraint row — CLA / any session with a constraint logged */}
              {resolvedConstraints.length > 0 && (
                <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{
                    fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em',
                    color: PALE_YELLOW, fontWeight: 600, marginBottom: 10, opacity: 0.85,
                  }}>
                    Constraint
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {resolvedConstraints.map(name => (
                      <span key={name} style={{
                        padding: '6px 12px', borderRadius: 8,
                        background: 'rgba(196,145,95,0.18)',
                        border: '1px solid rgba(196,145,95,0.30)',
                        color: COPPER, fontSize: 13, fontWeight: 500, letterSpacing: '0.01em',
                      }}>
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tech Tags row — canonical positions + user customs combined */}
              {resolvedTechTags.length > 0 && (
                <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{
                    fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em',
                    color: PALE_YELLOW, fontWeight: 600, marginBottom: 10, opacity: 0.85,
                  }}>
                    Tech Tags
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {resolvedTechTags.map(tag => (
                      <span key={tag.id} style={{
                        padding: '6px 12px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.70)', fontSize: 13, fontWeight: 500, letterSpacing: '0.01em',
                      }}>
                        {tag.name}
                      </span>
                    ))}
                  </div>
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

      {/* ── Resonance ─────────────────────────────────────────────────
          Renamed from "Journal" to mirror the log form's section eyebrow.
          Carries embodied/reflective prose AND the social layer (partners). */}
      <div style={{ marginBottom: 32 }}>
        <div className="j2-label-copper" style={{ marginBottom: 14 }}>◇ Resonance</div>
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

        {/* Partners chip strip — social-as-data layer */}
        {resolvedPartners.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{
              fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em',
              color: PALE_YELLOW, fontWeight: 600, marginBottom: 10, opacity: 0.85,
            }}>
              Partners
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {resolvedPartners.map((name, i) => (
                <span key={`${name}-${i}`} style={{
                  padding: '6px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.70)', fontSize: 13, fontWeight: 500, letterSpacing: '0.01em',
                }}>
                  {name}
                </span>
              ))}
            </div>
          </div>
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
