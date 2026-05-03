import { useState, useEffect, useRef } from 'react';
import { api, ApiError } from '../lib/api.ts';
import { toast } from '../hooks/use-toast.ts';
import { CARD_BG, COPPER, SURFACE_2, SURFACE_3, PALE_YELLOW, FONT_EDITORIAL } from '../lib/theme.ts';
import { vibrate } from '../lib/haptics.ts';
import { INTENSITY_COLOR } from '../lib/sessionUtils.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import { BELT_COLORS, type BeltRank } from '../lib/belt.ts';
import BeltDateBanner from './BeltDateBanner.tsx';
import FocusAreaChips from './FocusAreaChips.tsx';
import PrismReceipt from './PrismReceipt.tsx';
import SegmentedToggle from './SegmentedToggle.tsx';
import TagPicker from './TagPicker.tsx';
import ConstraintPicker from './ConstraintPicker.tsx';
import PartnerInput from './PartnerInput.tsx';
import VoiceReflectionInput from './VoiceReflectionInput.tsx';
import { selectionsToDistribution, type ChipSelection } from '../lib/selectionsToDistribution.ts';
import type { Intention, Pillar } from '../types/api.ts';

interface LogSessionResponse {
  message: string;
  session_count?: number;
}

type GiNoGi = 'gi' | 'no_gi' | 'both';
// `competition_training` is preserved as a valid value for legacy data; new
// sessions use `class | drilling | cla`. The form picker only surfaces the new
// three-way taxonomy. CLA = Constraints-Led Approach.
type SessionType = 'drilling' | 'class' | 'competition_training' | 'cla';
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

// Three-way session taxonomy: structured class, self-directed drilling,
// constraints-led approach (live training under a rule modification). Each
// type slightly modifies what the form asks for (Source toggle hides on
// drilling + CLA; Constraint picker appears on CLA only).
const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: 'class',    label: 'Class' },
  { value: 'drilling', label: 'Free Drilling' },
  { value: 'cla',      label: 'CLA' },
];

// ── Intensity labels ──────────────────────────────────────────────────────
// BJJ-themed scale (matches `INT_LABELS` in theme.ts). Less fitness-app, more
// dojo. Drill = no resistance / partner work; Light = relaxed flow; Steady =
// honest pace; Intense = tournament-prep round; Hard roll = full send.
const INTENSITY_LABELS = ['Drill', 'Light', 'Steady', 'Intense', 'Hard roll'];

export default function LogSessionForm({ onSuccess, onCancel, defaultDate, defaultHeading, defaultSessionType, defaultSubSkillTag, defaultConstraintName }: { onSuccess?: (sessionCount?: number) => void; onCancel?: () => void; defaultDate?: string; defaultHeading?: string; defaultSessionType?: SessionType; defaultSubSkillTag?: string; defaultConstraintName?: string }) {
  const isDesktop = useIsDesktop();
  const [form, setForm] = useState<SessionFormData>({
    date:         defaultDate ?? today,
    notes:        '',
    gi_nogi:      'gi',
    intensity:    3,
    session_type: defaultSessionType ?? 'class',
  });

  // Duration stepper — 30-min increments. Defaults to 60 (typical class
  // length). The user adjusts via +/- buttons; no null state because the
  // form opens "70% complete" per the editorial-form research.
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
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

  // Chip-input state — selections drive heading/tags/distribution at submit time.
  const initialSelections: ChipSelection[] = defaultHeading
    ? [{ pillar: defaultHeading as Pillar, primary: true, deep_work: false }]
    : [];
  const [selections, setSelections] = useState<ChipSelection[]>(initialSelections);
  const [polarity,     setPolarity]     = useState<Polarity | null>(null);
  const [subSkillTag,  setSubSkillTag]  = useState(defaultSubSkillTag ?? '');
  const [userTagIds,           setUserTagIds]           = useState<string[]>([]);
  const [canonicalPositionIds, setCanonicalPositionIds] = useState<string[]>([]);
  const [scriptSource, setScriptSource] = useState<ScriptSource | null>(null);

  // Constraints — only collected for CLA sessions, but state lives at the form
  // level so values are preserved if the user flips session-type away and back
  // (per the Wise / PayPal pattern from the Refero research). Empty arrays are
  // sent on save when session_type !== 'cla'.
  const [userConstraintIds, setUserConstraintIds] = useState<string[]>([]);
  const [canonicalConstraintIds, setCanonicalConstraintIds] = useState<string[]>([]);

  // Partners — freetext names of who the user trained with. Lives in the
  // Resonance section as the social-as-data layer. Migration 016. Caps at 5
  // server-side; client mirrors the cap via PartnerInput.
  const [partners, setPartners] = useState<string[]>([]);

  // Post-save receipt — shows the resulting Prism shape and auto-dismisses.
  const [receiptSelections, setReceiptSelections] = useState<ChipSelection[] | null>(null);
  const [pendingSuccessCount, setPendingSuccessCount] = useState<number | undefined>(undefined);

  // Derive heading at render-time so polarity gating + submit payload stay in sync.
  // Primary chip wins; otherwise highest-weight pillar (ties broken by selection order).
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

  // Wipe polarity when the derived heading leaves guard/pins (where it's relevant).
  useEffect(() => {
    if (derivedHeading !== 'guard' && derivedHeading !== 'pins' && polarity !== null) {
      setPolarity(null);
    }
  }, [derivedHeading, polarity]);

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

  const resetForm = () => {
    setForm({ date: today, notes: '', gi_nogi: 'gi', intensity: 3, session_type: 'class' });
    setDurationMinutes(60);
    setSelections([]);
    setPolarity(null);
    setSubSkillTag('');
    setUserTagIds([]);
    setCanonicalPositionIds([]);
    setScriptSource(null);
    setUserConstraintIds([]);
    setCanonicalConstraintIds([]);
    setPartners([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Duration is always set (default 60, clamped between DUR_MIN and DUR_MAX
    // by the +/- stepper); this is a defense-in-depth sanity check.
    if (durationMinutes < DUR_MIN || durationMinutes > DUR_MAX) {
      setError('Duration must be between 30 and 240 minutes.');
      return;
    }

    if (selections.length === 0 || !derivedHeading) {
      setError('Tap at least one focus area.');
      return;
    }

    setLoading(true);
    try {
      const distribution = selectionsToDistribution(selections);
      const tags = Array.from(new Set(selections.map(s => s.pillar)));

      // Migration 013 telemetry — adoption signal for primary + deep-work mechanics.
      const had_primary     = selections.some(s => s.primary);
      const had_deep_work   = selections.some(s => s.deep_work);
      const selection_count = selections.length;
      // Migration 014 — per-pillar deep_work set so the saved Prism shape can
      // be rehydrated with halo rings when the user reopens this session.
      const deep_work_pillars = selections.filter(s => s.deep_work).map(s => s.pillar);

      // Constraint linkage is only sent for CLA sessions; held form-state
      // is preserved if the user flips back, but never persisted to a non-CLA
      // session record (the picker was hidden, so the user never confirmed).
      // Constraints are now auxiliary metadata that attaches to any session
      // type — a traditional class with constraint-game segments, a drilling
      // block under no-grips, etc. session_type still defines the dominant
      // mode; constraints just record what rules were in play.
      const sentCanonicalConstraintIds = canonicalConstraintIds.length > 0 ? canonicalConstraintIds : undefined;
      const sentUserConstraintIds = userConstraintIds.length > 0 ? userConstraintIds : undefined;

      const sessionSnapshot = {
        date:         form.date,
        duration:     durationMinutes,
        intensity:    form.intensity,
        gi_nogi:      form.gi_nogi,
        session_type: form.session_type,
        notes:        form.notes || undefined,
        tags,
        heading:      derivedHeading,
        polarity:      polarity      ?? undefined,
        sub_skill_tag: subSkillTag   || undefined,
        script_source: scriptSource  ?? undefined,
        user_tag_ids:  userTagIds.length > 0 ? userTagIds : undefined,
        canonical_position_ids: canonicalPositionIds.length > 0 ? canonicalPositionIds : undefined,
        pillar_distribution: distribution ?? undefined,
        had_primary,
        had_deep_work,
        selection_count,
        deep_work_pillars,
        canonical_constraint_ids: sentCanonicalConstraintIds,
        user_constraint_ids: sentUserConstraintIds,
        partners: partners.length > 0 ? partners : undefined,
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
        user_tag_ids: sessionSnapshot.user_tag_ids,
        canonical_position_ids: sessionSnapshot.canonical_position_ids,
        pillar_distribution: sessionSnapshot.pillar_distribution,
        had_primary:     sessionSnapshot.had_primary,
        had_deep_work:   sessionSnapshot.had_deep_work,
        selection_count: sessionSnapshot.selection_count,
        deep_work_pillars: sessionSnapshot.deep_work_pillars,
        canonical_constraint_ids: sessionSnapshot.canonical_constraint_ids,
        user_constraint_ids: sessionSnapshot.user_constraint_ids,
        partners: sessionSnapshot.partners,
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

      // Capture selections for the receipt before reset clears them.
      setReceiptSelections(selections);
      setPendingSuccessCount(dataAny._offline ? undefined : data.session_count);
      resetForm();

      if (dataAny._offline) {
        toast({ title: 'Session saved offline — will sync when connected.' });
      }
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
    <>
    {receiptSelections && (
      <PrismReceipt
        selections={receiptSelections}
        onDismiss={() => {
          const count = pendingSuccessCount;
          setReceiptSelections(null);
          setPendingSuccessCount(undefined);
          onSuccess?.(count);
        }}
      />
    )}
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: CARD_BG, border: '1px solid rgba(255,255,255,0.10)', isolation: 'isolate' }}>
      <form onSubmit={handleSubmit}>
        {/* Header — animated belt banner on desktop, editorial header on mobile.
            The mobile variant collapses the banner to a 4pt belt-color hairline
            and surfaces the date as a copper eyebrow + Cormorant title, freeing
            ~150pt of vertical real estate the banner was eating on phone. */}
        {isDesktop ? (
          <BeltDateBanner
            value={form.date}
            required
            onChange={date => setForm(prev => ({ ...prev, date }))}
          />
        ) : (
          <MobileLogHeader
            date={form.date}
            onChange={date => setForm(prev => ({ ...prev, date }))}
          />
        )}

        <div
          className={isDesktop ? 'px-8 pb-8 pt-6' : 'px-5 pb-5 pt-4'}
          style={isDesktop ? {
            display: 'grid',
            gridTemplateColumns: '1fr 420px',
            gridTemplateRows: 'auto auto auto',
            columnGap: 32,
            rowGap: 32,
            alignItems: 'start',
          } : undefined}
        >
        {/* H2 stays on desktop only — on mobile the MobileLogHeader's serif
            title above is the page's primary heading. */}
        {isDesktop && (
          <h2
            className="text-2xl font-display font-semibold"
            style={{ color: PALE_YELLOW, gridColumn: '1 / -1', marginBottom: 0 }}
          >
            Log a Training Session
          </h2>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SECTION 1: Fundamentals
            Desktop keeps its boxed SURFACE_2 card; mobile lives directly on
            the canvas — implicit containment via eyebrow + whitespace, per
            the editorial-register research (Day One / Bear / Apple Notes
            pattern). The visual weight drops without losing the structure.
            ══════════════════════════════════════════════════════════════ */}
        <div
          className="space-y-4"
          style={isDesktop ? { gridColumn: '1', gridRow: '2' } : undefined}
        >
          <div className="j2-label-copper">Fundamentals</div>

          {/* Gi / No-Gi / Both — 'both' (mig 025) for sessions that mixed
              gi and no-gi work in one block (e.g. gi for warmup + drilling,
              no-gi for live rolls). Analytics weight 'both' as 0.5/0.5. */}
          <SegmentedToggle
            options={[
              { value: 'gi'    as GiNoGi, label: 'Gi'    },
              { value: 'no_gi' as GiNoGi, label: 'No-Gi' },
              { value: 'both'  as GiNoGi, label: 'Both'  },
            ]}
            value={form.gi_nogi}
            onChange={v => v && setForm(prev => ({ ...prev, gi_nogi: v }))}
          />

          {/* Session Type */}
          <SegmentedToggle
            options={SESSION_TYPES}
            value={form.session_type}
            onChange={v => v && setForm(prev => ({ ...prev, session_type: v }))}
          />

          {/* Duration + Intensity — side-by-side steppers. Both share the
              same SURFACE_3 stepper shell so they read as a paired control.
              Saves ~80pt of vertical real estate vs the old stacked
              5-bar gradient. Intensity value tints in the level's color. */}
          <div className="grid grid-cols-2 gap-3">
            {/* Duration */}
            <div>
              <p className="text-[10px] mb-1.5 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.40)', letterSpacing: '0.14em' }}>
                Duration
              </p>
              <div
                className="flex items-center justify-center gap-1 rounded-xl py-2"
                style={{ backgroundColor: SURFACE_3 }}
              >
                <button
                  type="button"
                  onClick={() => { vibrate(8); setDurationMinutes(m => Math.max(DUR_MIN, m - DUR_STEP)); }}
                  className="w-9 h-9 rounded-lg text-base font-semibold transition-colors touch-manipulation"
                  style={{ backgroundColor: SURFACE_2, color: 'rgba(255,255,255,0.55)' }}
                  disabled={durationMinutes <= DUR_MIN}
                  aria-label="Decrease duration"
                >
                  −
                </button>
                <span
                  className="font-bold flex-1 text-center"
                  style={{ color: PALE_YELLOW, fontSize: 17 }}
                >
                  {fmtDuration(durationMinutes)}
                </span>
                <button
                  type="button"
                  onClick={() => { vibrate(8); setDurationMinutes(m => Math.min(DUR_MAX, m + DUR_STEP)); }}
                  className="w-9 h-9 rounded-lg text-base font-semibold transition-colors touch-manipulation"
                  style={{ backgroundColor: SURFACE_2, color: 'rgba(255,255,255,0.55)' }}
                  disabled={durationMinutes >= DUR_MAX}
                  aria-label="Increase duration"
                >
                  +
                </button>
              </div>
            </div>

            {/* Intensity */}
            <div>
              <p className="text-[10px] mb-1.5 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.40)', letterSpacing: '0.14em' }}>
                Intensity
              </p>
              <div
                className="flex items-center justify-center gap-1 rounded-xl py-2"
                style={{ backgroundColor: SURFACE_3 }}
              >
                <button
                  type="button"
                  onClick={() => { vibrate(8); setForm(prev => ({ ...prev, intensity: Math.max(1, prev.intensity - 1) })); }}
                  className="w-9 h-9 rounded-lg text-base font-semibold transition-colors touch-manipulation"
                  style={{ backgroundColor: SURFACE_2, color: 'rgba(255,255,255,0.55)' }}
                  disabled={form.intensity <= 1}
                  aria-label="Decrease intensity"
                >
                  −
                </button>
                <span
                  className="font-bold flex-1 text-center"
                  style={{
                    color: INTENSITY_COLOR[form.intensity] ?? PALE_YELLOW,
                    fontSize: 14,
                    letterSpacing: '0.02em',
                    textShadow: `0 0 12px ${INTENSITY_COLOR[form.intensity] ?? '#A8CB72'}40`,
                  }}
                >
                  {INTENSITY_LABELS[form.intensity - 1]}
                </span>
                <button
                  type="button"
                  onClick={() => { vibrate(8); setForm(prev => ({ ...prev, intensity: Math.min(5, prev.intensity + 1) })); }}
                  className="w-9 h-9 rounded-lg text-base font-semibold transition-colors touch-manipulation"
                  style={{ backgroundColor: SURFACE_2, color: 'rgba(255,255,255,0.55)' }}
                  disabled={form.intensity >= 5}
                  aria-label="Increase intensity"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Hairline divider between sections — mobile only. The hairline +
            its surrounding 28px margins replace the visual weight of the
            old card borders without re-introducing chrome. */}
        {!isDesktop && (
          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 28, marginBottom: 28 }} />
        )}

        {/* ══════════════════════════════════════════════════════════════
            SECTION 2: Your Focus — on desktop this sits in the right column,
            spanning rows 2-3 so it stays alongside both Basics and Details.
            On mobile the section eyebrow flattens the H3 into the same
            "FOCUS" rhythm as the other sections — consistency over emphasis.
            ══════════════════════════════════════════════════════════════ */}
        <div
          className="space-y-4"
          style={isDesktop ? { gridColumn: '2', gridRow: '2 / span 2' } : undefined}
        >
          <div>
            <div className="j2-label-copper">Positional Focus</div>
            {currentIntention && (
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
                This week's focus: <span style={{ color: COPPER }}>{currentIntention.intent_label}</span>
              </p>
            )}
          </div>

          {/* Focus-area chips — tap to add, double-tap for primary, hold for deep work */}
          <FocusAreaChips
            selections={selections}
            onChange={setSelections}
            defaultPrimaryPillar={defaultHeading as Pillar | undefined}
          />

          {/* Constraint picker — available on any session type. CLA sessions
              are constraint-driven by definition; class / drilling / comp
              sessions can also carry constraint metadata when a portion of
              the session ran under one (e.g. "class with positional sparring
              from closed guard"). session_type still defines the dominant
              mode — this is auxiliary, not a parallel axis. Form state lives
              at this level so values persist if the user flips session-type. */}
          <div>
            <p className="text-[10px] mt-0.5 mb-2 uppercase tracking-widest font-semibold" style={{ color: PALE_YELLOW, letterSpacing: '0.16em' }}>
              Constraint
              {form.session_type !== 'cla' && (
                <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 8, fontWeight: 500 }}>
                  · optional
                </span>
              )}
            </p>
            <ConstraintPicker
              selectedUserConstraintIds={userConstraintIds}
              selectedCanonicalConstraintIds={canonicalConstraintIds}
              onChange={(u, c) => { setUserConstraintIds(u); setCanonicalConstraintIds(c); }}
              currentPillar={derivedHeading}
              maxSelected={1}
              defaultQuery={defaultConstraintName}
            />
            <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.40)', fontStyle: 'italic', fontFamily: FONT_EDITORIAL, fontSize: 13 }}>
              {form.session_type === 'cla'
                ? 'What rule did you train under tonight?'
                : 'Did any portion of the session run under a constraint?'}
            </p>
          </div>

          {/* Tech Tags — moved up from the old Details section. These are the
              technical layer of the session and the bridge to the future
              Technique Library (each tag opens a journal page for that move).
              Always visible, regardless of session type. */}
          <div>
            <p className="text-[10px] mt-0.5 mb-2 uppercase tracking-widest font-semibold" style={{ color: PALE_YELLOW, letterSpacing: '0.16em' }}>
              Tech Tags
            </p>
            <TagPicker
              selectedUserTagIds={userTagIds}
              selectedCanonicalIds={canonicalPositionIds}
              onChange={(u, c) => { setUserTagIds(u); setCanonicalPositionIds(c); }}
              currentPillar={derivedHeading}
              maxSelected={5}
            />
            <p className="mt-2" style={{ color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', fontFamily: FONT_EDITORIAL, fontSize: 13 }}>
              Each tag opens a page in your technique library.
            </p>
          </div>

          {/* Polarity — only for guard and pins */}
          {(derivedHeading === 'guard' || derivedHeading === 'pins') && (
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
              <p className="mt-2 text-center" style={{ color: 'rgba(255,255,255,0.40)', fontStyle: 'italic', fontFamily: FONT_EDITORIAL, fontSize: 13 }}>
                What side of the exchange were you primarily on?
              </p>
            </div>
          )}

          {/* Source — only for traditional Class. Free Drilling is self-directed
              by definition; CLA is coach-set by the constraint itself. Hiding
              the toggle removes a meaningless decision from those flows. */}
          {form.session_type === 'class' && (
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
              <p className="mt-2 text-center" style={{ color: 'rgba(255,255,255,0.40)', fontStyle: 'italic', fontFamily: FONT_EDITORIAL, fontSize: 13 }}>
                Was this instructor-led or self-directed?
              </p>
            </div>
          )}
        </div>

        {/* Hairline divider — mobile only, between Positional Focus and Resonance. */}
        {!isDesktop && (
          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 28, marginBottom: 28 }} />
        )}

        {/* ══════════════════════════════════════════════════════════════
            SECTION 3: Resonance — the emotional layer of the session.
            Two distinct dimensions:
              - embodied / reflective prose (the existing notes textarea,
                with per-type placeholder copy)
              - social-as-data (partner chip-input below the textarea)
            No mood scale anywhere — capture is freeform on both axes.
            ══════════════════════════════════════════════════════════════ */}
        <div
          className="space-y-3"
          style={isDesktop ? { gridColumn: '1', gridRow: '3' } : undefined}
        >
          <div className="j2-label-copper">Resonance</div>

          {/* Embodied / reflective prose — voice-to-text mic + textarea. Per-type
              placeholder copy orients the user without dictating what they should
              feel. The section eyebrow + placeholder do the labelling work; no
              redundant "Notes" inline label. */}
          <VoiceReflectionInput
            value={form.notes}
            onChange={next => setForm(prev => ({ ...prev, notes: next }))}
            placeholder={
              form.session_type === 'drilling' ? 'What did you choose to drill?'
                : form.session_type === 'cla'  ? 'What did the constraint reveal?'
                :                                'What stayed with you?'
            }
            rows={2}
            textareaName="notes"
            textareaStyle={{ backgroundColor: SURFACE_3 }}
          />

          {/* Social layer — freetext partner chips, max 5. Captures who you
              trained with as structured data without forcing a second textarea
              or a mood scale. Will graduate to user_partners refs in 2.0. */}
          <div>
            <p className="text-[10px] mt-0.5 mb-2 uppercase tracking-widest font-semibold" style={{ color: PALE_YELLOW, letterSpacing: '0.16em' }}>
              Partners
            </p>
            <PartnerInput
              partners={partners}
              onChange={setPartners}
              maxSelected={5}
            />
          </div>
        </div>

        {/* Hairline divider — mobile only, before the CTA. Desktop uses
            the action row's own borderTop instead. */}
        {!isDesktop && (
          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 28, marginBottom: 16 }} />
        )}

        {/* ── Error + CTA — full-width on desktop ─────────────────── */}
        {error && (
          <p
            className="text-red-400 text-sm"
            style={isDesktop ? { gridColumn: '1 / -1', margin: 0 } : undefined}
          >
            {error}
          </p>
        )}

        <div
          className={isDesktop ? 'flex items-center gap-3 pt-2' : 'flex items-center gap-3'}
          style={isDesktop
            ? { borderTop: '1px solid rgba(196,145,95,0.12)', gridColumn: '1 / -1', marginTop: 4 }
            : undefined}
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
            {loading ? 'Saving...' : 'Save Session'}
          </button>
        </div>

        </div>{/* end content wrapper */}
      </form>
    </div>
    </>
  );
}

// ── MobileLogHeader ──────────────────────────────────────────────────────
//
// The mobile-only editorial header that replaces the full-bleed BeltDateBanner.
// Top-to-bottom:
//   1. 4pt belt-color hairline (full-bleed, ambient brand thread)
//   2. Copper eyebrow date (TUE · APR 27) — tappable, opens date picker
//   3. Cormorant Garamond italic title — "Today's session" / "Yesterday's
//      session" / long-form date
//
// Total vertical cost ~80pt, vs ~150pt for the full belt-banner. The banner
// stays on the home and session-detail surfaces where it has narrative
// weight; here on the compose form it was costing real estate without
// earning the editorial register the desktop has achieved.

function beltHairlineColor(rank: BeltRank): string {
  // White and blue belts use their own color — light enough to read against forest.
  // Purple/brown/black fall back to COPPER so the strip stays warm against the
  // dark canvas (a black hairline on near-black would be invisible).
  if (rank === 'white' || rank === 'blue') return BELT_COLORS[rank];
  return COPPER;
}

function todayLocalString(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function yesterdayLocalString(): string {
  const t = new Date(Date.now() - 86_400_000);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function formatEyebrowDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const wkday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${wkday} · ${month} ${d.getDate()}`.toUpperCase();
}

function formatTitleForDate(dateStr: string): string {
  if (dateStr === todayLocalString()) return "Today's session";
  if (dateStr === yesterdayLocalString()) return "Yesterday's session";
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function MobileLogHeader({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const { beltRank } = useProfile();
  const rank: BeltRank = (beltRank as BeltRank) ?? 'white';
  const hairlineColor = beltHairlineColor(rank);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const openDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    // showPicker() is the modern API; fall back to click() for older browsers.
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); return; } catch { /* fall through */ }
    }
    el.click();
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* 4pt belt-color hairline — full-bleed at the top of the form */}
      <div
        aria-hidden
        style={{
          height: 4,
          background: hairlineColor,
          boxShadow: `0 0 12px ${hairlineColor}40`,
        }}
      />

      <div style={{ padding: '20px 20px 0 20px' }}>
        {/* Date control — eyebrow + serif title are wrapped in a single
            full-width button so the whole block is one tap target. Visually
            still an editorial header (no border, no fill); hit area meets
            the 44pt iOS HIG minimum because the inner content stacks to
            ~52pt total height. The chevron sits next to the title so the
            larger, more visible element carries the "tappable" cue. */}
        <button
          type="button"
          onClick={openDatePicker}
          aria-label={`Session date: ${formatTitleForDate(date)}. Tap to change.`}
          className="touch-manipulation"
          style={{
            background: 'none',
            border: 'none',
            padding: '4px 0',
            margin: 0,
            cursor: 'pointer',
            textAlign: 'left',
            display: 'block',
            width: '100%',
            color: 'inherit',
          }}
        >
          <div className="j2-label-copper">{formatEyebrowDate(date)}</div>
          <div
            style={{
              fontFamily: FONT_EDITORIAL,
              fontStyle: 'italic',
              fontSize: 24,
              lineHeight: 1.15,
              color: PALE_YELLOW,
              opacity: 0.9,
              marginTop: 8,
              letterSpacing: '-0.005em',
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
            }}
          >
            <span>{formatTitleForDate(date)}</span>
            <span
              aria-hidden
              style={{ fontSize: 14, opacity: 0.45, fontStyle: 'normal', fontFamily: 'inherit' }}
            >
              ▾
            </span>
          </div>
        </button>

        {/* Hidden native date input — anchors the picker. Sits visually
            inside the button area so iOS Safari opens the picker near the
            tap target, not at the page corner. */}
        <input
          ref={dateInputRef}
          type="date"
          value={date}
          onChange={e => onChange(e.target.value)}
          aria-hidden
          tabIndex={-1}
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            width: 1, height: 1,
            left: 20, top: 32,
          }}
        />
      </div>
    </div>
  );
}
