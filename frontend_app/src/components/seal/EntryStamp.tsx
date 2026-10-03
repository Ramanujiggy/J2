// EntryStamp — a stamp that lives ON a journal entry.
//
// Renders a die's seal (SealStamp) as a small mark pressed onto the page. An
// existing/landed stamp sits crooked and static; a fresh strike (`justStruck`)
// plays the press-down animation (overshoot + settle) with a puff ring of
// displaced "dust". Tapping opens the reveal sheet (handled by the parent).
//
// Renders inline (position:relative) so the puff ring insets correctly; the
// parent places it (e.g. right-aligned under the prose) via `style`.

import SealStamp from './SealStamp.tsx';
import { PALE_YELLOW } from '../../lib/theme.ts';
import type { StampDie } from '../../lib/stampDies.ts';

const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Props {
  die: StampDie;
  /** Chord-band date text. */
  top?: string;
  /** Play the press-down animation once (a just-applied strike). */
  justStruck?: boolean;
  onTap?: () => void;
  size?: number;
  style?: React.CSSProperties;
}

export default function EntryStamp({ die, top, justStruck, onTap, size = 60, style }: Props) {
  const animate = justStruck && !REDUCED;
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`${die.name} stamp — open details`}
      style={{
        position: 'relative',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: onTap ? 'pointer' : 'default',
        lineHeight: 0,
        ...style,
      }}
    >
      {animate && (
        <span
          aria-hidden
          className="animate-j2-stamp-puff"
          style={{ position: 'absolute', inset: -10, borderRadius: '50%', border: `2px solid ${PALE_YELLOW}`, pointerEvents: 'none' }}
        />
      )}
      <SealStamp
        die={die}
        top={top}
        size={size}
        className={animate ? 'animate-j2-stamp-press' : undefined}
        style={animate ? undefined : { transform: 'rotate(-8deg)' }}
      />
    </button>
  );
}
