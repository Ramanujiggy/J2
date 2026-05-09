// LogSessionResonance — Section 3 of LogSessionForm.
//
// The emotional layer of the session. Two distinct dimensions:
//   • Embodied / reflective prose (voice-to-text mic + textarea, with
//     per-type placeholder copy)
//   • Social-as-data (partner chip-input below the textarea, max 5)
// No mood scale anywhere — capture is freeform on both axes.
//
// Pure presentation — all state lives in the parent LogSessionForm.
// Extracted from LogSessionForm.tsx during the 2026-05-08 refactor.

import { SURFACE_3, PALE_YELLOW } from '../lib/theme.ts';
import VoiceReflectionInput from './VoiceReflectionInput.tsx';
import PartnerInput from './PartnerInput.tsx';
import type { SessionType } from './LogSessionFundamentals.tsx';

interface ResonanceProps {
  notes: string;
  onNotesChange: (n: string) => void;
  sessionType: SessionType;  // drives the placeholder copy
  partners: string[];
  onPartnersChange: (p: string[]) => void;
}

export default function LogSessionResonance({
  notes,
  onNotesChange,
  sessionType,
  partners,
  onPartnersChange,
}: ResonanceProps) {
  return (
    <>
      <div className="j2-label-copper">Resonance</div>

      {/* Embodied / reflective prose — voice-to-text mic + textarea. Per-type
          placeholder copy orients the user without dictating what they should
          feel. The section eyebrow + placeholder do the labelling work; no
          redundant "Notes" inline label. */}
      <VoiceReflectionInput
        value={notes}
        onChange={onNotesChange}
        placeholder={
          sessionType === 'drilling' ? 'What did you choose to drill?'
            : sessionType === 'cla'  ? 'What did the constraint reveal?'
            :                          'What stayed with you?'
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
          onChange={onPartnersChange}
          maxSelected={5}
        />
      </div>
    </>
  );
}
