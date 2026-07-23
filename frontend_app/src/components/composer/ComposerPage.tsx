// Capture Composer screen 3 — the page. Entry text is editable in the
// editorial serif; beneath it, chips the app HEARD (confirmations, not
// questions — tap to keep/discard). Slim toolbar: mic resume + details
// drawer. Desktop renders the same content in a paper column (~58ch);
// the inferred rail lives in CaptureComposer. Spec §2 state 3.

import { FONT_EDITORIAL, PALE_YELLOW } from '../../lib/theme.ts';
import { vibrate } from '../../lib/haptics.ts';
import type { ExtractedChip } from '../../lib/chipExtraction.ts';

interface Props {
  kernelCaption: string;
  text: string;
  onTextChange: (t: string) => void;
  chips: ExtractedChip[];
  confirmed: Set<string>;
  onToggleChip: (name: string) => void;
  speechSupported: boolean;
  recording: boolean;
  onMicToggle: () => void;
  onOpenDetails: () => void;
  onContinue: () => void;
  isDesktop: boolean;
}

export default function ComposerPage({
  kernelCaption, text, onTextChange, chips, confirmed, onToggleChip,
  speechSupported, recording, onMicToggle, onOpenDetails, onContinue, isDesktop,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 420, maxWidth: isDesktop ? '58ch' : undefined, margin: isDesktop ? '0 auto' : undefined }}>
      <p style={{ fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.34)', textAlign: isDesktop ? 'left' : 'center', margin: '0 0 12px' }}>
        {kernelCaption}
      </p>

      <textarea
        value={text}
        onChange={e => onTextChange(e.target.value)}
        placeholder="What would you like to remember about this training session?"
        rows={isDesktop ? 12 : 8}
        autoFocus={!recording}
        style={{
          flex: 1, width: '100%', background: 'transparent', border: 'none', outline: 'none',
          resize: 'none', fontFamily: FONT_EDITORIAL, fontSize: isDesktop ? 19 : 17.5,
          lineHeight: 1.65, color: 'rgba(255,255,255,0.88)',
        }}
      />

      {chips.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(196,145,95,0.14)', paddingTop: 12, marginTop: 8 }}>
          <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.34)', margin: '0 0 8px' }}>
            Heard in your entry — tap to keep
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {chips.map(chip => {
              const on = confirmed.has(chip.name);
              return (
                <button
                  key={chip.name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => { vibrate(6); onToggleChip(chip.name); }}
                  className="touch-manipulation"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600,
                    padding: '5px 11px', borderRadius: 999,
                    border: `1px ${on ? 'solid rgba(196,145,95,0.40)' : 'dashed rgba(196,145,95,0.40)'}`,
                    color: on ? PALE_YELLOW : 'rgba(255,255,255,0.55)',
                    background: on ? 'rgba(196,145,95,0.16)' : 'transparent',
                  }}
                >
                  {on && <span style={{ color: '#52B56C', fontWeight: 800 }}>✓</span>}
                  {chip.kind === 'partner' ? `${chip.name} (partner)` : chip.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderTop: '1px solid rgba(196,145,95,0.14)', marginTop: 12, paddingTop: 12 }}>
        {speechSupported && (
          <button
            type="button"
            aria-label={recording ? 'Stop recording' : 'Resume recording'}
            onClick={() => { vibrate(6); onMicToggle(); }}
            className="touch-manipulation"
            style={{
              width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: recording ? 'rgba(196,145,95,0.16)' : 'transparent',
              border: '1px solid rgba(196,145,95,0.40)', color: '#C4915F',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => { vibrate(6); onOpenDetails(); }}
          className="touch-manipulation"
          style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(242,228,168,0.62)', background: 'transparent', border: 'none', textDecoration: 'underline', textDecorationColor: 'rgba(196,145,95,0.4)' }}
        >
          All details
        </button>
        <button
          type="button"
          onClick={() => { vibrate(8); onContinue(); }}
          disabled={!text.trim()}
          className="touch-manipulation"
          style={{
            marginLeft: 'auto', fontWeight: 700, fontSize: 14, color: '#fff', background: '#DA7422',
            borderRadius: 12, padding: '11px 22px', opacity: text.trim() ? 1 : 0.4,
            boxShadow: '0 4px 22px rgba(218,116,34,0.32)',
          }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
