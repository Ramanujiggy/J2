// MarginNotesEntry — the entry-first capture/edit screen (the Margin Notes design).
//
// Layout, top → bottom:
//   • editable date (serif, tap to reveal a ◄ day ► + Today stepper)
//   • the raw entry prose (serif textarea) with inline @mention partner tagging
//     + a Boa keepsake button
//   • the "margin notes" band: the basics (gi/type) · time on the mat (dial +
//     effort) · what you worked on (the prism) · the exchange (polarity +
//     coach-led/open-mat) · techniques (library picker)
//   • Save
//
// One component serves BOTH create and edit. Create seeds from the class-schedule
// kernel; edit seeds from `initial` (an existing session) and stashes the fields
// the band doesn't surface (sub_skill_tag / resonance / constraint ids) so the
// full-row PUT never nulls them. Partners are derived from @mentions in the prose.

import { useEffect, useMemo, useRef, useState } from 'react';
import { PALE_YELLOW, COPPER, FONT_EDITORIAL, CARD_BG, SURFACE_2, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY, TEXT_HINT } from '../../lib/theme.ts';
import { vibrate } from '../../lib/haptics.ts';
import { SKILL_TAGS } from '../../lib/constants.ts';
import SegmentedToggle from '../SegmentedToggle.tsx';
import TagPicker from '../TagPicker.tsx';
import PrismFocusInput, { type PrismSkin } from '../PrismFocusInput.tsx';
import DurationDial from '../DurationDial.tsx';
import EffortMeter from '../EffortMeter.tsx';
import EntryStamp from '../seal/EntryStamp.tsx';
import { STAMP_DIES, bandDate } from '../../lib/stampDies.ts';
import type { Kernel } from '../../lib/composerKernel.ts';
import { sessionToSelections, type ChipSelection } from '../../lib/selectionsToDistribution.ts';
import type { SessionDraft } from '../../lib/sessionPayload.ts';
import type { GiNoGi, SessionType, Pillar, PillarDistribution } from '../../types/api.ts';

type Polarity = 'defense' | 'neutral' | 'offense';
type ScriptSource = 'directed' | 'organic';

// Enough of an existing session to seed the edit form + preserve hidden fields.
export interface EditSeed {
  date: string;
  duration: number;
  gi_nogi: GiNoGi;
  session_type: string;
  intensity: number;
  notes?: string | null;
  polarity?: string | null;
  script_source?: string | null;
  sub_skill_tag?: string | null;
  resonance?: number | null;
  user_tag_ids?: string[] | null;
  canonical_position_ids?: string[] | null;
  canonical_constraint_ids?: string[] | null;
  user_constraint_ids?: string[] | null;
  partners?: string[] | null;
  tags?: string[] | null;
  heading?: string | null;
  pillar_distribution?: PillarDistribution | null;
  deep_work_pillars?: Pillar[] | null;
  stamps?: { die_key: string; struck_at: string }[];
}

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function parseDate(iso: string): Date { return new Date(iso + 'T00:00:00'); }
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function longLabel(iso: string): string {
  const d = parseDate(iso);
  return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
}

// Partner @mentions — a single token after '@' (stops at whitespace/punctuation).
const MENTION_RE = /@([^\s@.,!?;:]+)/g;
function parseMentions(text: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(text)) !== null) {
    const name = m[1]!;
    if (!out.includes(name)) out.push(name);
  }
  return out;
}
// The @token immediately before the caret (or null). '' means bare '@' just typed.
function activeToken(text: string, caret: number): string | null {
  const before = text.slice(0, caret);
  const m = before.match(/@([^\s@.,!?;:]*)$/);
  return m ? m[1]! : null;
}

interface Props {
  kernel: Kernel;
  entryText: string;
  onTextChange: (t: string) => void;
  onSave: (draft: SessionDraft) => void;
  saving: boolean;
  /** Called when the user strikes Boa on this entry — parent persists it
   *  (immediately with session_id in edit; deferred to save in create). */
  onBoaStruck?: () => void;
  /** Tap a landed stamp — parent opens the reveal sheet. */
  onOpenStamp?: (dieKey: string, struckAt: string) => void;
  skin?: PrismSkin;
  /** Distinct partner names from past sessions, for the @mention dropdown. */
  pastPartners?: string[];
  /** Present in edit mode — seeds the form from an existing session. */
  initial?: EditSeed;
  headerLabel?: string;
}

export default function MarginNotesEntry({
  kernel, entryText, onTextChange, onSave, saving, onBoaStruck, onOpenStamp, skin = 'etched',
  pastPartners = [], initial, headerLabel,
}: Props) {
  const kernelType = kernel.session_type === 'competition_training' ? 'class' : kernel.session_type;

  // Stamps struck on this entry (Boa now; future dies). Seeded from the session
  // on edit; a fresh Boa strike appends + animates via EntryStamp `justStruck`.
  const [stamps, setStamps] = useState<{ die_key: string; struck_at: string }[]>(initial?.stamps ?? []);
  const [justStruckBoa, setJustStruckBoa] = useState(false);
  const boaStamp = stamps.find(s => s.die_key === 'boa');

  const strikeBoa = () => {
    if (boaStamp) return; // one Boa per session
    vibrate(14);
    setStamps(prev => [...prev, { die_key: 'boa', struck_at: new Date().toISOString() }]);
    setJustStruckBoa(true);
    onBoaStruck?.();
  };

  const [date, setDate] = useState(initial?.date ?? kernel.date);
  const [dateEditing, setDateEditing] = useState(false);
  const [giNogi, setGiNogi] = useState<GiNoGi>(initial?.gi_nogi ?? kernel.gi_nogi);
  const [sessionType, setSessionType] = useState<SessionType>((initial?.session_type as SessionType) ?? kernelType);
  const [duration, setDuration] = useState(initial?.duration ?? kernel.duration);
  const [intensity, setIntensity] = useState(initial?.intensity ?? 3);
  const [selections, setSelections] = useState<ChipSelection[]>(() => (initial ? sessionToSelections({
    heading: initial.heading,
    tags: initial.tags ?? undefined,
    pillar_distribution: initial.pillar_distribution,
    deep_work_pillars: initial.deep_work_pillars,
  }) : []));
  const [userTagIds, setUserTagIds] = useState<string[]>(initial?.user_tag_ids ?? []);
  const [canonicalIds, setCanonicalIds] = useState<string[]>(initial?.canonical_position_ids ?? []);
  const [polarity, setPolarity] = useState<Polarity | null>((initial?.polarity as Polarity) ?? null);
  const [scriptSource, setScriptSource] = useState<ScriptSource | null>((initial?.script_source as ScriptSource) ?? null);

  // Fields the band doesn't surface — preserved verbatim so the full-row PUT
  // doesn't null them. Legacy partners (array, no @text) are unioned with
  // @mentions on save so old data is never lost.
  const passthrough = useRef({
    sub_skill_tag: initial?.sub_skill_tag ?? undefined,
    resonance: initial?.resonance ?? undefined,
    canonical_constraint_ids: initial?.canonical_constraint_ids ?? undefined,
    user_constraint_ids: initial?.user_constraint_ids ?? undefined,
    legacyPartners: initial?.partners ?? [],
  });

  // @mention dropdown state
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [mentionToken, setMentionToken] = useState<string | null>(null);

  // Auto-size the prose textarea to its content (min ~2 lines) so a short entry
  // doesn't leave a tall empty void — especially in edit.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(56, el.scrollHeight)}px`;
  }, [entryText]);

  const heading = useMemo<Pillar | null>(() => selections.find(s => s.primary)?.pillar ?? null, [selections]);
  const studyLabel = heading ? (SKILL_TAGS.find(t => t.value === heading)?.label ?? heading) : null;

  const stepDate = (delta: number) => {
    const d = parseDate(date); d.setDate(d.getDate() + delta); setDate(toISO(d));
  };

  const mentionMatches = useMemo(() => {
    if (mentionToken == null) return [];
    const q = mentionToken.toLowerCase();
    const already = new Set(parseMentions(entryText).map(n => n.toLowerCase()));
    return pastPartners
      .filter(p => p.toLowerCase().includes(q) && !already.has(p.toLowerCase()))
      .slice(0, 5);
  }, [mentionToken, pastPartners, entryText]);

  const syncToken = () => {
    const el = textRef.current;
    if (!el) return;
    setMentionToken(activeToken(el.value, el.selectionStart ?? el.value.length));
  };

  const completeMention = (name: string) => {
    const el = textRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? el.value.length;
    const before = el.value.slice(0, caret).replace(/@([^\s@.,!?;:]*)$/, '@' + name + ' ');
    const next = before + el.value.slice(caret);
    onTextChange(next);
    setMentionToken(null);
    requestAnimationFrame(() => { el.focus(); const pos = before.length; el.setSelectionRange(pos, pos); });
  };

  const handleSave = () => {
    if (saving) return;
    const notes = entryText.trim();
    const partners = Array.from(new Set([...passthrough.current.legacyPartners, ...parseMentions(notes)]));
    onSave({
      date,
      duration,
      notes,
      gi_nogi: giNogi,
      intensity,
      session_type: sessionType,
      selections,
      user_tag_ids: userTagIds,
      canonical_position_ids: canonicalIds,
      polarity,
      script_source: scriptSource,
      sub_skill_tag: passthrough.current.sub_skill_tag,
      resonance: passthrough.current.resonance,
      canonical_constraint_ids: passthrough.current.canonical_constraint_ids,
      user_constraint_ids: passthrough.current.user_constraint_ids,
      partners,
    });
  };

  const SubLabel = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: TEXT_TERTIARY, margin: '22px 0 10px' }}>
      {children}
    </p>
  );

  return (
    <div>
      {headerLabel && (
        <p style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: COPPER, marginBottom: 14 }}>
          {headerLabel}
        </p>
      )}

      {/* ── The entry ─────────────────────────────────────────── */}
      <button
        onClick={() => setDateEditing(v => !v)}
        style={{ fontFamily: FONT_EDITORIAL, fontSize: 32, fontWeight: 600, color: '#8FB56A', letterSpacing: '-0.01em', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
      >
        {longLabel(date)} <span style={{ fontSize: 15, color: TEXT_TERTIARY, fontFamily: 'inherit' }}>⌄</span>
      </button>
      {dateEditing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <button onClick={() => stepDate(-1)} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.1)', color: TEXT_SECONDARY, cursor: 'pointer' }}>‹</button>
          <div style={{ fontSize: 13, fontWeight: 700, color: PALE_YELLOW, minWidth: 92, textAlign: 'center' }}>{longLabel(date)}</div>
          <button onClick={() => stepDate(1)} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.1)', color: TEXT_SECONDARY, cursor: 'pointer' }}>›</button>
          <button onClick={() => { setDate(initial?.date ?? kernel.date); setDateEditing(false); }} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: COPPER, padding: '8px 10px', borderRadius: 10, border: '1px dashed rgba(196,145,95,0.5)', background: 'none', cursor: 'pointer' }}>Today</button>
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <textarea
          ref={textRef}
          value={entryText}
          onChange={e => { onTextChange(e.target.value); requestAnimationFrame(syncToken); }}
          onKeyUp={syncToken}
          onClick={syncToken}
          onBlur={() => requestAnimationFrame(() => setMentionToken(null))}
          placeholder="What would you like to remember about this session? Type @ to tag a partner."
          rows={2}
          style={{ width: '100%', marginTop: 12, minHeight: 56, overflow: 'hidden', background: 'none', border: 'none', outline: 'none', resize: 'none', fontFamily: FONT_EDITORIAL, fontSize: 20, lineHeight: 1.5, color: TEXT_PRIMARY }}
        />
        {mentionToken != null && (mentionMatches.length > 0 || mentionToken.length > 0) && (
          <div
            style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 10, background: CARD_BG, border: '1px solid rgba(196,145,95,0.3)', borderRadius: 12, padding: 6, boxShadow: '0 12px 30px -12px rgba(0,0,0,0.6)' }}
          >
            <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: TEXT_HINT, padding: '4px 8px' }}>Tag a partner</p>
            {mentionMatches.map(name => (
              <button
                key={name}
                onMouseDown={e => { e.preventDefault(); completeMention(name); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 10, background: 'none', border: 'none', color: PALE_YELLOW, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {name}
              </button>
            ))}
            {mentionToken.length > 0 && !pastPartners.some(p => p.toLowerCase() === mentionToken.toLowerCase()) && (
              <button
                onMouseDown={e => { e.preventDefault(); completeMention(mentionToken); }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 10, background: 'none', border: 'none', color: COPPER, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                + Tag “{mentionToken}”
              </button>
            )}
          </div>
        )}
      </div>

      {/* On-entry stamps — landed stamps sit crooked on the page; a Boa strike
          presses one down. Tapping a stamp opens its certificate sheet. */}
      {(stamps.length > 0 || onBoaStruck) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 10, paddingTop: 14, minHeight: 60, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {stamps.map(s => {
            const die = STAMP_DIES[s.die_key];
            if (!die) return null;
            return (
              <EntryStamp
                key={s.die_key}
                die={die}
                top={bandDate(s.struck_at)}
                justStruck={s.die_key === 'boa' && justStruckBoa}
                onTap={onOpenStamp ? () => onOpenStamp(s.die_key, s.struck_at) : undefined}
              />
            );
          })}
          {!boaStamp && onBoaStruck && (
            <button
              onClick={strikeBoa}
              aria-label="Strike a Boa on this entry"
              className="j2-press"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: PALE_YELLOW, border: '1px solid rgba(196,145,95,0.5)', background: 'rgba(196,145,95,0.14)', padding: '8px 12px', borderRadius: 10, cursor: 'pointer' }}
            >
              ◈ Boa
            </button>
          )}
        </div>
      )}

      {/* ── Margin notes band ─────────────────────────────────── */}
      <div style={{ marginTop: 14, background: 'linear-gradient(180deg,rgba(196,145,95,0.05),rgba(255,255,255,0.015))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '18px 16px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: COPPER }}>◈ Margin notes</span>
          <span style={{ fontSize: 11, color: TEXT_TERTIARY }}>· the shape of the session</span>
        </div>

        <SubLabel>The basics</SubLabel>
        <SegmentedToggle<GiNoGi>
          options={[{ value: 'gi', label: 'Gi' }, { value: 'no_gi', label: 'No-Gi' }, { value: 'both', label: 'Both' }]}
          value={giNogi}
          onChange={v => v && setGiNogi(v)}
        />
        <div style={{ height: 8 }} />
        <SegmentedToggle<SessionType>
          options={[{ value: 'class', label: 'Class' }, { value: 'drilling', label: 'Free Drilling' }, { value: 'cla', label: 'CLA' }]}
          value={sessionType}
          onChange={v => v && setSessionType(v)}
        />

        <SubLabel>Time on the mat</SubLabel>
        <DurationDial value={duration} onChange={setDuration} />
        <div style={{ marginTop: 8 }}>
          <EffortMeter value={intensity} onChange={setIntensity} />
        </div>

        <SubLabel>What did you work on?</SubLabel>
        <PrismFocusInput selections={selections} onChange={setSelections} skin={skin} />
        <p style={{ fontSize: 12, color: TEXT_TERTIARY, textAlign: 'center', marginTop: 4 }}>
          {studyLabel
            ? <>The study ✦&nbsp; <b style={{ color: PALE_YELLOW }}>{studyLabel}</b></>
            : 'Pull a point out — or tap it.'}
        </p>

        <SubLabel>The exchange</SubLabel>
        <SegmentedToggle<Polarity>
          options={[{ value: 'defense', label: 'Defense' }, { value: 'neutral', label: 'Neutral' }, { value: 'offense', label: 'Offense' }]}
          value={polarity}
          onChange={setPolarity}
          deselectable
        />
        <div style={{ height: 8 }} />
        <SegmentedToggle<ScriptSource>
          options={[{ value: 'directed', label: 'Coach-led' }, { value: 'organic', label: 'Open Mat' }]}
          value={scriptSource}
          onChange={setScriptSource}
          deselectable
        />

        <SubLabel>Techniques <span style={{ letterSpacing: 0, textTransform: 'none', color: TEXT_HINT, fontWeight: 500 }}>· from your library, max 5</span></SubLabel>
        <TagPicker
          selectedUserTagIds={userTagIds}
          selectedCanonicalIds={canonicalIds}
          onChange={(u, c) => { setUserTagIds(u); setCanonicalIds(c); }}
          currentPillar={heading}
          maxSelected={5}
        />
      </div>

      {/* ── Save ──────────────────────────────────────────────── */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="j2-press disabled:opacity-60"
        style={{ width: '100%', marginTop: 20, height: 52, borderRadius: 10, background: '#DA7422', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', boxShadow: '0 12px 28px -10px rgba(218,116,34,0.7)' }}
      >
        {saving ? 'Saving…' : '◈ Save entry'}
      </button>
      <div style={{ height: 8, background: SURFACE_2 }} aria-hidden />
    </div>
  );
}
