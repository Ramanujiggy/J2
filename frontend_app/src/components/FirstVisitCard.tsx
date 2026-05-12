import { CARD_BG, COPPER_BORDER, CARD_SHADOW, PALE_YELLOW, GLOW_SOFT } from '../lib/theme.ts';

interface Props {
  onLogFirst: () => void;
}

export default function FirstVisitCard({ onLogFirst }: Props) {
  return (
    <div
      className="rounded-2xl text-center"
      style={{
        backgroundColor: CARD_BG,
        border: `1px solid ${COPPER_BORDER}`,
        boxShadow: CARD_SHADOW,
        padding: '40px 24px',
      }}
    >
      <h3
        className="text-lg font-display font-semibold mb-2"
        style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}
      >
        Welcome to Journada
      </h3>
      <p className="text-sm mb-6 leading-relaxed" style={{ color: 'rgba(255,255,255,0.50)' }}>
        Track your sessions, set intentions, and watch your game evolve.
      </p>
      <button
        onClick={onLogFirst}
        className="w-full rounded-xl py-3.5 text-base font-semibold text-white touch-manipulation"
        style={{
          backgroundColor: '#DA7422',
          boxShadow: '0 2px 12px rgba(218,116,34,0.3)',
        }}
      >
        Log Your First Session
      </button>
    </div>
  );
}
