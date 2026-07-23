// LogSessionForm — the compose form for new training sessions.
//
// Orchestrator only. The render is split into five extracted sub-components
// (see the 2026-05-08 refactor for context):
//   • LogSessionMobileHeader — mobile editorial header (desktop uses the
//     pre-existing BeltDateBanner)
//   • LogSessionFundamentals — gi/no-gi, session-type, duration, intensity
//   • LogSessionPositionalFocus — focus chips, constraint, techniques,
//     polarity (conditional), source (conditional)
//   • LogSessionResonance — voice notes + partner chips
//   • LogSessionActions — error + Cancel/Save buttons
//
// What stays here: every piece of state, the handleSubmit payload assembly,
// the two useEffects (polarity-reset + current-intention fetch), the
// derivedHeading IIFE, the resetForm helper, and the desktop/mobile grid
// layout that places each sub-section into its slot.

import { useState, useEffect } from 'react';
import { api, ApiError } from '../lib/api.ts';
import { toast } from '../hooks/use-toast.ts';
import { CARD_BG, PALE_YELLOW, COPPER } from '../lib/theme.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import BeltDateBanner from './BeltDateBanner.tsx';
import PrismReceipt from './PrismReceipt.tsx';
import LogSessionMobileHeader from './LogSessionMobileHeader.tsx';
import LogSessionFundamentals, { type GiNoGi, type SessionType } from './LogSessionFundamentals.tsx';
import LogSessionPositionalFocus, { type Polarity, type ScriptSource } from './LogSessionPositionalFocus.tsx';
import LogSessionResonance from './LogSessionResonance.tsx';
import LogSessionActions from './LogSessionActions.tsx';
import { selectionsToDistribution, type ChipSelection } from '../lib/selectionsToDistribution.ts';
import type { Intention, Pillar } from '../types/api.ts';

interface LogSessionResponse {
  message: string;
  session_count?: number;
}

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

// Duration constants — also enforced inside LogSessionFundamentals' stepper.
// Kept here as defense-in-depth for the submit-time sanity check.
const DUR_MIN = 30;
const DUR_MAX = 240;

export default function LogSessionForm({
  onSuccess,
  onCancel,
  defaultDate,
  defaultHeading,
  defaultSessionType,
  defaultSubSkillTag,
  defaultConstraintName,
}: {
  onSuccess?: (sessionCount?: number) => void;
  onCancel?: () => void;
  defaultDate?: string;
  defaultHeading?: string;
  defaultSessionType?: SessionType;
  defaultSubSkillTag?: string;
  defaultConstraintName?: string;
}) {
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
          <LogSessionMobileHeader
            date={form.date}
            onChange={date => setForm(prev => ({ ...prev, date }))}
          />
        )}

        {/* ── Journal-first: freeform notes lead the form ────────────────
            Matches the edit modal's layout — the entry text is the primary
            content, structured controls are "margin notes" below. */}
        {!isDesktop && (
          <div className="px-5 pt-2 pb-0">
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="What happened on the mat today?"
              rows={4}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontSize: 17,
                lineHeight: 1.55,
                color: 'rgba(255,255,255,0.88)',
                padding: 0,
              }}
            />
            <div style={{ height: 1, backgroundColor: 'rgba(196,145,95,0.20)', marginTop: 12 }} />
          </div>
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
        {/* H2 stays on desktop only — on mobile the LogSessionMobileHeader's
            serif title above is the page's primary heading. */}
        {isDesktop && (
          <h2
            className="text-2xl font-display font-semibold"
            style={{ color: PALE_YELLOW, gridColumn: '1 / -1', marginBottom: 0 }}
          >
            Log a Training Session
          </h2>
        )}

        {/* Mobile margin notes label — mirrors the edit modal's "MARGIN NOTES" section */}
        {!isDesktop && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'rgba(196,145,95,0.5)' }}>◇</span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: COPPER }}>
              Margin Notes
            </span>
          </div>
        )}

        {/* ── Section 1: Fundamentals ─────────────────────────────────────
            Desktop keeps its boxed SURFACE_2 card; mobile lives directly on
            the canvas — implicit containment via eyebrow + whitespace, per
            the editorial-register research (Day One / Bear / Apple Notes
            pattern). The visual weight drops without losing the structure.
            ────────────────────────────────────────────────────────────── */}
        <div
          className="space-y-4"
          style={isDesktop ? { gridColumn: '1', gridRow: '2' } : undefined}
        >
          <LogSessionFundamentals
            giNogi={form.gi_nogi}
            onGiNogiChange={v => setForm(prev => ({ ...prev, gi_nogi: v }))}
            sessionType={form.session_type}
            onSessionTypeChange={v => setForm(prev => ({ ...prev, session_type: v }))}
            durationMinutes={durationMinutes}
            onDurationChange={setDurationMinutes}
            intensity={form.intensity}
            onIntensityChange={i => setForm(prev => ({ ...prev, intensity: i }))}
          />
        </div>

        {/* Hairline divider between sections — mobile only. The hairline +
            its surrounding 28px margins replace the visual weight of the
            old card borders without re-introducing chrome. */}
        {!isDesktop && (
          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 28, marginBottom: 28 }} />
        )}

        {/* ── Section 2: Your Focus ───────────────────────────────────────
            On desktop this sits in the right column, spanning rows 2-3 so
            it stays alongside both Basics and Details. On mobile the
            section eyebrow flattens the H3 into the same "FOCUS" rhythm
            as the other sections — consistency over emphasis.
            ────────────────────────────────────────────────────────────── */}
        <div
          className="space-y-4"
          style={isDesktop ? { gridColumn: '2', gridRow: '2 / span 2' } : undefined}
        >
          <LogSessionPositionalFocus
            selections={selections}
            onSelectionsChange={setSelections}
            defaultPrimaryPillar={defaultHeading as Pillar | undefined}
            derivedHeading={derivedHeading}
            currentIntention={currentIntention}
            sessionType={form.session_type}
            userTagIds={userTagIds}
            canonicalPositionIds={canonicalPositionIds}
            onTagsChange={(u, c) => { setUserTagIds(u); setCanonicalPositionIds(c); }}
            userConstraintIds={userConstraintIds}
            canonicalConstraintIds={canonicalConstraintIds}
            onConstraintsChange={(u, c) => { setUserConstraintIds(u); setCanonicalConstraintIds(c); }}
            defaultConstraintName={defaultConstraintName}
            polarity={polarity}
            onPolarityChange={setPolarity}
            scriptSource={scriptSource}
            onScriptSourceChange={setScriptSource}
          />
        </div>

        {/* Hairline divider — mobile only, between Positional Focus and Resonance. */}
        {!isDesktop && (
          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 28, marginBottom: 28 }} />
        )}

        {/* ── Section 3: Resonance ──────────────────────────────────────── */}
        <div
          className="space-y-3"
          style={isDesktop ? { gridColumn: '1', gridRow: '3' } : undefined}
        >
          <LogSessionResonance
            notes={form.notes}
            onNotesChange={next => setForm(prev => ({ ...prev, notes: next }))}
            sessionType={form.session_type}
            partners={partners}
            onPartnersChange={setPartners}
          />
        </div>

        {/* Hairline divider — mobile only, before the CTA. Desktop uses
            the action row's own borderTop instead. */}
        {!isDesktop && (
          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 28, marginBottom: 16 }} />
        )}

        <LogSessionActions
          loading={loading}
          error={error}
          onCancel={onCancel}
          isDesktop={isDesktop}
        />

        </div>{/* end content wrapper */}
      </form>
    </div>
    </>
  );
}
