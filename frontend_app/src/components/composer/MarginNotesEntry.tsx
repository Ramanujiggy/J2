// MarginNotesEntry — the entry-first capture screen (the Margin Notes redesign).
//
// Layout, top → bottom (per the handoff mockup):
//   • editable date (serif, tap to reveal a ◄ day ► + Today stepper)
//   • the raw entry prose (serif textarea) + a Boa keepsake button
//   • the "margin notes" band — a visibly-secondary annotation with the
//     structured fields: the basics (gi/type), time on the mat (dial + effort),
//     what you worked on (the prism), and techniques (library picker)
//   • Save
//
// The band never blocks saving: every field defaults from the class-schedule
// kernel, so a user can talk, glance, and hit save. Focus is set by dragging
// the prism (untouched → touched → drilled; deepest = the study), which reads
// and writes the same ChipSelection[] the rest of the app uses.

import { useMemo, useState } from 'react';
import { PALE_YELLOW, COPPER, FONT_EDITORIAL, CARD_BG } from '../../lib/theme.ts';
import { SKILL_TAGS } from '../../lib/constants.ts';
import SegmentedToggle from '../SegmentedToggle.tsx';
import TagPicker from '../TagPicker.tsx';
import PrismFocusInput, { type PrismSkin } from '../PrismFocusInput.tsx';
import DurationDial from '../DurationDial.tsx';
import EffortMeter from '../EffortMeter.tsx';
import type { Kernel } from '../../lib/composerKernel.ts';
import type { ChipSelection } from '../../lib/selectionsToDistribution.ts';
import type { SessionDraft } from '../../lib/sessionPayload.ts';
import type { GiNoGi, SessionType } from '../LogSessionFundamentals.tsx';
import type { Pillar } from '../../types/api.ts';

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

interface Props {
  kernel: Kernel;
  entryText: string;
  onTextChange: (t: string) => void;
  onSave: (draft: SessionDraft) => void;
  saving: boolean;
  onBoa?: () => void;
  skin?: PrismSkin;
}

export default function MarginNotesEntry({ kernel, entryText, onTextChange, onSave, saving, onBoa, skin = 'etched' }: Props) {
  const [date, setDate] = useState(kernel.date);
  const [dateEditing, setDateEditing] = useState(false);
  const [giNogi, setGiNogi] = useState<GiNoGi>(kernel.gi_nogi);
  const [sessionType, setSessionType] = useState<SessionType>(
    kernel.session_type === 'competition_training' ? 'class' : kernel.session_type,
  );
  const [duration, setDuration] = useState(kernel.duration);
  const [intensity, setIntensity] = useState(3);
  const [selections, setSelections] = useState<ChipSelection[]>([]);
  const [userTagIds, setUserTagIds] = useState<string[]>([]);
  const [canonicalIds, setCanonicalIds] = useState<string[]>([]);

  const heading = useMemo<Pillar | null>(() => selections.find(s => s.primary)?.pillar ?? null, [selections]);
  const studyLabel = heading ? (SKILL_TAGS.find(t => t.value === heading)?.label ?? heading) : null;

  const stepDate = (delta: number) => {
    const d = parseDate(date); d.setDate(d.getDate() + delta); setDate(toISO(d));
  };

  const handleSave = () => {
    if (saving) return;
    onSave({
      date,
      duration,
      notes: entryText.trim(),
      gi_nogi: giNogi,
      intensity,
      session_type: sessionType,
      selections,
      user_tag_ids: userTagIds,
      canonical_position_ids: canonicalIds,
    });
  };

  const SubLabel = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.44)', margin: '22px 0 10px' }}>
      {children}
    </p>
  );

  return (
    <div>
      {/* ── The entry ─────────────────────────────────────────── */}
      <button
        onClick={() => setDateEditing(v => !v)}
        style={{ fontFamily: FONT_EDITORIAL, fontSize: 32, fontWeight: 600, color: '#8FB56A', letterSpacing: '-0.01em', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
      >
        {longLabel(date)} <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.44)', fontFamily: 'inherit' }}>⌄</span>
      </button>
      {dateEditing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <button onClick={() => stepDate(-1)} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.66)', cursor: 'pointer' }}>‹</button>
          <div style={{ fontSize: 13, fontWeight: 700, color: PALE_YELLOW, minWidth: 92, textAlign: 'center' }}>{longLabel(date)}</div>
          <button onClick={() => stepDate(1)} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.66)', cursor: 'pointer' }}>›</button>
          <button onClick={() => { setDate(kernel.date); setDateEditing(false); }} style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: COPPER, padding: '8px 10px', borderRadius: 9, border: '1px dashed rgba(196,145,95,0.5)', background: 'none', cursor: 'pointer' }}>Today</button>
        </div>
      )}

      <textarea
        value={entryText}
        onChange={e => onTextChange(e.target.value)}
        placeholder="What would you like to remember about this session?"
        rows={4}
        style={{ width: '100%', marginTop: 12, minHeight: 120, background: 'none', border: 'none', outline: 'none', resize: 'none', fontFamily: FONT_EDITORIAL, fontSize: 20, lineHeight: 1.5, color: 'rgba(255,255,255,0.92)' }}
      />

      {onBoa && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={onBoa}
            aria-label="Mark this as a mat moment"
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: PALE_YELLOW, borderColor: 'rgba(196,145,95,0.5)', border: '1px solid rgba(196,145,95,0.5)', background: 'rgba(196,145,95,0.14)', padding: '8px 12px', borderRadius: 10, cursor: 'pointer' }}
          >
            ◈ Boa
          </button>
        </div>
      )}

      {/* ── Margin notes band ─────────────────────────────────── */}
      <div style={{ marginTop: 14, background: 'linear-gradient(180deg,rgba(196,145,95,0.05),rgba(255,255,255,0.015))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '18px 16px 20px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: COPPER }}>◈ Margin notes</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.44)' }}>· the shape of the session</span>
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
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.44)', textAlign: 'center', marginTop: 4 }}>
          {studyLabel
            ? <>The study ✦&nbsp; <b style={{ color: PALE_YELLOW }}>{studyLabel}</b></>
            : 'Pull a point out — or tap it.'}
        </p>

        <SubLabel>Techniques <span style={{ letterSpacing: 0, textTransform: 'none', color: 'rgba(255,255,255,0.26)', fontWeight: 500 }}>· from your library, max 5</span></SubLabel>
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
        style={{ width: '100%', marginTop: 20, height: 52, borderRadius: 14, background: '#DA7422', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', boxShadow: '0 12px 28px -10px rgba(218,116,34,0.7)' }}
      >
        {saving ? 'Saving…' : '◈ Save entry'}
      </button>
      <div style={{ height: 8, background: CARD_BG }} aria-hidden />
    </div>
  );
}
