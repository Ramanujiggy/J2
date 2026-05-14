import { PALE_YELLOW, COPPER, FONT_EDITORIAL, GLOW_SOFT } from '../lib/theme.ts';

interface Props {
  heroLines: string[];
  supporting: string;
  affordance: string;
  onAction: () => void;
}

export default function JournalEmptyState({ heroLines, supporting, affordance, onAction }: Props) {
  return (
    <div style={{ paddingTop: '18vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h1
        style={{
          fontFamily: FONT_EDITORIAL,
          fontStyle: 'italic',
          fontWeight: 600,
          fontSize: 'clamp(28px, 8vw, 36px)',
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
          color: 'rgba(255,255,255,0.60)',
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
