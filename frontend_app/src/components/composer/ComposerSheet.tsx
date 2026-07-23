// frontend_app/src/components/composer/ComposerSheet.tsx
// Capture Composer screen 1 — leads with tonight's card (kernel from the
// class schedule + the active intention as a prompt), Apple-Journal style.
// Three exits: speak (primary when supported), write, mark-attended-only.
// No schedule match renders the quiet variant. Spec §2 state 1.

import { SKILL_TAGS } from '../../lib/constants.ts';
import { CARD_BG, CARD_SHADOW, COPPER, GLOW_SOFT, PALE_YELLOW, FONT_EDITORIAL } from '../../lib/theme.ts';
import { vibrate } from '../../lib/haptics.ts';
import { formatTime12 } from '../../lib/timeUtils.ts';
import type { Kernel } from '../../lib/composerKernel.ts';
import type { Intention } from '../../types/api.ts';

interface Props {
  kernel: Kernel;
  intention: Intention | null;
  speechSupported: boolean;
  onSpeak: () => void;
  onWrite: () => void;
  onMarkAttended: () => void;
}

function intentionPrompt(i: Intention): string {
  const label = i.intent_label?.trim()
    || (i.heading ? SKILL_TAGS.find(t => t.value === i.heading)?.label ?? i.heading : null);
  return label ? `You said this week was about ${label.toLowerCase()} — how did it go?` : '';
}

export default function ComposerSheet({ kernel, intention, speechSupported, onSpeak, onWrite, onMarkAttended }: Props) {
  const hasClass = kernel.scheduleName !== null;
  const prompt = intention ? intentionPrompt(intention) : '';
  const meta = [
    kernel.startTime ? formatTime12(kernel.startTime) : null,
    `${kernel.duration} min`,
    kernel.gi_nogi === 'no_gi' ? 'No-Gi' : kernel.gi_nogi === 'both' ? 'Gi + No-Gi' : 'Gi',
  ].filter(Boolean).join(' · ');

  return (
    <div
      style={{ backgroundColor: CARD_BG, border: '1px solid rgba(196,145,95,0.40)', borderRadius: 18, padding: '24px 22px', boxShadow: CARD_SHADOW }}
    >
      <p className="j2-label-copper" style={{ marginBottom: 8 }}>
        ◇ {hasClass ? 'Tonight' : 'Today'}
      </p>
      <h3 style={{ fontFamily: FONT_EDITORIAL, fontWeight: 500, fontSize: 28, color: PALE_YELLOW, margin: '0 0 4px', letterSpacing: '-0.01em', textShadow: GLOW_SOFT }}>
        {kernel.scheduleName ?? 'Open mat?'}
      </h3>
      <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.40)', letterSpacing: '0.05em', textTransform: 'uppercase', margin: '2px 0 0' }}>
        {meta}
      </p>

      {prompt && (
        <div
          style={{
            margin: '14px 0 2px', padding: '12px 14px', borderLeft: `2px solid ${COPPER}`,
            fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 15.5,
            color: 'rgba(242,228,168,0.62)', background: 'rgba(196,145,95,0.06)', borderRadius: '0 10px 10px 0',
          }}
        >
          "{prompt}"
        </div>
      )}

      <button
        type="button"
        onClick={() => { vibrate(8); (speechSupported ? onSpeak : onWrite)(); }}
        className="w-full touch-manipulation"
        style={{
          marginTop: 20, fontWeight: 700, fontSize: 15, color: '#fff',
          background: '#DA7422', borderRadius: 16, padding: '16px 14px',
          boxShadow: '0 4px 22px rgba(218,116,34,0.32), inset 0 1px 0 rgba(255,255,255,0.18)',
        }}
      >
        {speechSupported ? '🎙  Journal using voice' : 'Write your journal'}
      </button>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {speechSupported && (
          <button
            type="button"
            onClick={() => { vibrate(6); onWrite(); }}
            className="touch-manipulation"
            style={{ flex: 1, fontWeight: 600, fontSize: 13.5, color: 'rgba(242,228,168,0.62)', border: '1px solid rgba(196,145,95,0.30)', borderRadius: 14, padding: '14px 12px', background: 'rgba(196,145,95,0.06)' }}
          >
            Write instead
          </button>
        )}
        <button
          type="button"
          onClick={() => { vibrate(6); onMarkAttended(); }}
          className="touch-manipulation"
          style={{ flex: 1, fontWeight: 600, fontSize: 13.5, color: 'rgba(242,228,168,0.62)', border: '1px solid rgba(196,145,95,0.30)', borderRadius: 14, padding: '14px 12px', background: 'rgba(196,145,95,0.06)' }}
        >
          Just mark attended ✓
        </button>
      </div>
    </div>
  );
}
