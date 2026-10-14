import { PALE_YELLOW, COPPER, FONT_EDITORIAL, GLOW_SOFT, TEXT_SECONDARY } from '../lib/theme.ts';

interface Props {
  heroLines: string[];
  supporting: string;
  affordance: string;
  onAction: () => void;
  /** When true, removes top padding (for use inside existing page flow). */
  inline?: boolean;
}

export default function JournalEmptyState({ heroLines, supporting, affordance, onAction, inline = false }: Props) {
  return (
    <div style={{ paddingTop: inline ? 24 : '18vh', paddingBottom: inline ? 24 : 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h1
        style={{
          fontFamily: FONT_EDITORIAL,
          fontStyle: 'italic',
          fontWeight: 600,
          fontSize: inline ? 'clamp(32px, 9vw, 40px)' : 'clamp(28px, 8vw, 36px)',
          color: PALE_YELLOW,
          textShadow: GLOW_SOFT,
          lineHeight: 1.2,
          textAlign: 'center',
          maxWidth: 320,
          margin: 0,
        }}
      >
        {heroLines.map((line, i) => (
          <span key={i} style={{ display: 'block' }}>{line}</span>
        ))}
      </h1>

      <p
        style={{
          fontFamily: FONT_EDITORIAL,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: 16,
          color: TEXT_SECONDARY,
          lineHeight: 1.5,
          textAlign: 'center',
          maxWidth: 280,
          marginTop: 24,
        }}
      >
        {supporting}
      </p>

      <button
        onClick={onAction}
        className="touch-manipulation"
        style={{
          fontFamily: FONT_EDITORIAL,
          fontStyle: 'italic',
          fontWeight: 600,
          fontSize: 17,
          color: COPPER,
          background: 'none',
          border: 'none',
          borderBottom: '1px solid rgba(196,145,95,0.35)',
          cursor: 'pointer',
          padding: '12px 8px',
          marginTop: 32,
        }}
        aria-label={affordance}
      >
        {affordance}
      </button>
    </div>
  );
}
