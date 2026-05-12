// LogSessionPositionalFocus — Section 2 of LogSessionForm.
//
// The "what did you actually train" half of the form. Five controls:
//   • Focus-area chips (FocusAreaChips) — primary/deep-work mechanics
//   • Constraint picker — auxiliary metadata; required register on CLA
//   • Techniques picker — bridge into the Technique Library
//   • Polarity (conditional, only when heading is guard or pins)
//   • Source (conditional, only on session_type === 'class')
//
// Pure presentation — all state lives in the parent LogSessionForm.
// Extracted from LogSessionForm.tsx during the 2026-05-08 refactor.

import { COPPER, PALE_YELLOW, FONT_EDITORIAL } from '../lib/theme.ts';
import FocusAreaChips from './FocusAreaChips.tsx';
import TagPicker from './TagPicker.tsx';
import ConstraintPicker from './ConstraintPicker.tsx';
import SegmentedToggle from './SegmentedToggle.tsx';
import type { ChipSelection } from '../lib/selectionsToDistribution.ts';
import type { Intention, Pillar } from '../types/api.ts';
import type { SessionType } from './LogSessionFundamentals.tsx';

export type Polarity = 'offense' | 'defense' | 'neutral';
export type ScriptSource = 'directed' | 'organic';

interface PositionalFocusProps {
  selections: ChipSelection[];
  onSelectionsChange: (s: ChipSelection[]) => void;
  defaultPrimaryPillar?: Pillar;
  derivedHeading: Pillar | null;
  currentIntention: Intention | null;
  sessionType: SessionType;
  userTagIds: string[];
  canonicalPositionIds: string[];
  onTagsChange: (u: string[], c: string[]) => void;
  userConstraintIds: string[];
  canonicalConstraintIds: string[];
  onConstraintsChange: (u: string[], c: string[]) => void;
  defaultConstraintName?: string;
  polarity: Polarity | null;
  onPolarityChange: (p: Polarity | null) => void;
  scriptSource: ScriptSource | null;
  onScriptSourceChange: (s: ScriptSource | null) => void;
}

export default function LogSessionPositionalFocus({
  selections,
  onSelectionsChange,
  defaultPrimaryPillar,
  derivedHeading,
  currentIntention,
  sessionType,
  userTagIds,
  canonicalPositionIds,
  onTagsChange,
  userConstraintIds,
  canonicalConstraintIds,
  onConstraintsChange,
  defaultConstraintName,
  polarity,
  onPolarityChange,
  scriptSource,
  onScriptSourceChange,
}: PositionalFocusProps) {
  return (
    <>
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
        onChange={onSelectionsChange}
        defaultPrimaryPillar={defaultPrimaryPillar}
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
          {sessionType !== 'cla' && (
            <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 8, fontWeight: 500 }}>
              · optional
            </span>
          )}
        </p>
        <ConstraintPicker
          selectedUserConstraintIds={userConstraintIds}
          selectedCanonicalConstraintIds={canonicalConstraintIds}
          onChange={onConstraintsChange}
          currentPillar={derivedHeading}
          maxSelected={1}
          defaultQuery={defaultConstraintName}
        />
        <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.40)', fontStyle: 'italic', fontFamily: FONT_EDITORIAL, fontSize: 13 }}>
          {sessionType === 'cla'
            ? 'What rule did you train under tonight?'
            : 'Did any portion of the session run under a constraint?'}
        </p>
      </div>

      {/* Techniques — the technical layer of the session and the bridge
          into the Technique Library. Each chip opens a per-technique
          page (the Pokedex) where affinity and resonance accumulate
          over time. Always visible, regardless of session type. */}
      <div>
        <p className="text-[10px] mt-0.5 mb-2 uppercase tracking-widest font-semibold" style={{ color: PALE_YELLOW, letterSpacing: '0.16em' }}>
          Techniques
        </p>
        <TagPicker
          selectedUserTagIds={userTagIds}
          selectedCanonicalIds={canonicalPositionIds}
          onChange={onTagsChange}
          currentPillar={derivedHeading}
          maxSelected={5}
        />
        <p className="mt-2" style={{ color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', fontFamily: FONT_EDITORIAL, fontSize: 13 }}>
          Each technique opens a page in your library — affinity, resonance, history.
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
            onChange={onPolarityChange}
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
      {sessionType === 'class' && (
        <div>
          <SegmentedToggle
            options={[
              { value: 'directed' as ScriptSource, label: 'Coach-led' },
              { value: 'organic' as ScriptSource, label: 'Open Mat' },
            ]}
            value={scriptSource}
            onChange={onScriptSourceChange}
            deselectable
          />
          <p className="mt-2 text-center" style={{ color: 'rgba(255,255,255,0.40)', fontStyle: 'italic', fontFamily: FONT_EDITORIAL, fontSize: 13 }}>
            Was this instructor-led or self-directed?
          </p>
        </div>
      )}
    </>
  );
}
