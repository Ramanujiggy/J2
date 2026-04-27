import { useState, useEffect, useRef } from 'react';
import { api, ApiError } from '../lib/api.ts';
import { toast } from '../hooks/use-toast.ts';
import { CARD_BG, COPPER, SURFACE_2, SURFACE_3, PALE_YELLOW, GLOW_SOFT, FONT_EDITORIAL } from '../lib/theme.ts';
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
import VoiceReflectionInput from './VoiceReflectionInput.tsx';
import { selectionsToDistribution, type ChipSelection } from '../lib/selectionsToDistribution.ts';
import type { Intention, Pillar } from '../types/api.ts';

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

// ── Intensity labels ──────────────────────────────────────────────────────
const INTENSITY_LABELS = ['Light', 'Easy', 'Moderate', 'Hard', 'Max'];

export default function LogSessionForm({ onSuccess, onCancel, defaultDate, defaultHeading, defaultSessionType, defaultSubSkillTag }: { onSuccess?: (sessionCount?: number) => void; onCancel?: () => void; defaultDate?: string; defaultHeading?: string; defaultSessionType?: SessionType; defaultSubSkillTag?: string }) {
  const isDesktop = useIsDesktop();
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
    setDurationMinutes(null);
    setSelections([]);
    setPolarity(null);
    setSubSkillTag('');
    setUserTagIds([]);
    setCanonicalPositionIds([]);
    setScriptSource(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!durationMinutes || durationMinutes < DUR_MIN) {
      setError('Please select a duration.');
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

      const sessionSnapshot = {
        date:         form.date,
        duration:     durationMinutes!,
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
            columnGap: 24,
            rowGap: 20,
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
            SECTION 1: The Basics
            Desktop keeps its boxed SURFACE_2 card; mobile lives directly on
            the canvas — implicit containment via eyebrow + whitespace, per
            the editorial-register research (Day One / Bear / Apple Notes
            pattern). The visual weight drops without losing the structure.
            ══════════════════════════════════════════════════════════════ */}
        <div
          className={isDesktop ? 'rounded-xl px-4 py-4 space-y-4' : 'space-y-4'}
          style={isDesktop ? {
            backgroundColor: SURFACE_2,
            border: '1px solid rgba(255,255,255,0.05)',
            gridColumn: '1', gridRow: '2',
          } : undefined}
        >
          {isDesktop ? (
            <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.40)' }}>
              The Basics
            </span>
          ) : (
            <div className="j2-label-copper">The Basics</div>
          )}

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

          {/* Duration — stepper (±30-min increments) */}
          <div className="space-y-2">
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

          {/* Intensity — color-gradient segmented bar, active shows label */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map(n => {
              const active = form.intensity === n;
              const color = INTENSITY_COLOR[n] ?? '#A8CB72';
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => { vibrate(10); setForm(prev => ({ ...prev, intensity: n })); }}
                  className="flex-1 flex items-center justify-center font-semibold touch-manipulation"
                  style={{
                    height: active ? 44 : 36,
                    borderRadius: 10,
                    backgroundColor: active ? color : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
                    color: active ? 'rgba(13,26,20,0.9)' : 'rgba(255,255,255,0.55)',
                    fontSize: 12,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    transition: 'all 280ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                    boxShadow: active ? `0 0 0 1px ${color}40, 0 8px 20px -8px ${color}80` : 'none',
                  }}
                >
                  {active ? INTENSITY_LABELS[n - 1] : ''}
                </button>
              );
            })}
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
          className={isDesktop ? 'rounded-xl px-4 py-4 space-y-4' : 'space-y-4'}
          style={isDesktop ? {
            backgroundColor: SURFACE_2,
            border: '1px solid rgba(255,255,255,0.05)',
            gridColumn: '2', gridRow: '2 / span 2',
          } : undefined}
        >
          <div>
            {isDesktop ? (
              <h3 className="text-sm font-semibold" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
                What did you work on?
              </h3>
            ) : (
              <div className="j2-label-copper">Focus</div>
            )}
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

        {/* Hairline divider — mobile only, between Focus and Details. */}
        {!isDesktop && (
          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 28, marginBottom: 28 }} />
        )}

        {/* ══════════════════════════════════════════════════════════════
            SECTION 3: Details (optional)
            ══════════════════════════════════════════════════════════════ */}
        <div
          className={isDesktop ? 'rounded-xl px-4 py-4 space-y-3' : 'space-y-3'}
          style={isDesktop ? {
            backgroundColor: SURFACE_2,
            border: '1px solid rgba(255,255,255,0.05)',
            gridColumn: '1', gridRow: '3',
          } : undefined}
        >
          {isDesktop ? (
            <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.40)' }}>
              Details
            </span>
          ) : (
            <div className="j2-label-copper">Details</div>
          )}

          {/* Tags — user's personal vocabulary, each linked to a pillar */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.40)' }}>
              Tags <span style={{ color: 'rgba(255,255,255,0.20)' }}>(optional, max 5)</span>
            </label>
            <TagPicker
              selectedUserTagIds={userTagIds}
              selectedCanonicalIds={canonicalPositionIds}
              onChange={(u, c) => { setUserTagIds(u); setCanonicalPositionIds(c); }}
              currentPillar={derivedHeading}
              maxSelected={5}
            />
          </div>

          {/* Notes — now with voice-to-text mic. Encourages post-training use
              (sweaty hands, tired, don't-make-them-type). Falls back to a
              plain textarea when Web Speech API isn't available. */}
          <div>
            <label className="block text-xs mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>
              Notes <span style={{ color: 'rgba(255,255,255,0.20)' }}>(optional)</span>
            </label>
            <VoiceReflectionInput
              value={form.notes}
              onChange={next => setForm(prev => ({ ...prev, notes: next }))}
              placeholder="What stood out today?"
              rows={2}
              textareaName="notes"
              textareaStyle={{ backgroundColor: SURFACE_3 }}
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
