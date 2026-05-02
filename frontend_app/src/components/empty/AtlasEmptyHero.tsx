// Editorial empty-state hero for /atlas. Single leather card, Cormorant
// heading, copper CTA back to logging. Pattern: ABY Journal "Empty. But
// full of possibilities." (Refero `8416de7c-…`).

import { useNavigate } from 'react-router-dom';
import {
  CARD_BG, CARD_GLOW, CARD_GLOW_BORDER, COPPER, COPPER_BORDER,
  PALE_YELLOW, FONT_EDITORIAL, GLOW_SOFT,
} from '../../lib/theme.ts';

interface Props {
  /** Optional override for the CTA — defaults to navigating to /home. */
  onLogSession?: () => void;
}

export default function AtlasEmptyHero({ onLogSession }: Props) {
  const navigate = useNavigate();
  const handleClick = onLogSession ?? (() => navigate('/home'));

  return (
    <div
      style={{
        backgroundColor: CARD_BG,
        border: `1px solid ${CARD_GLOW_BORDER}`,
        boxShadow: CARD_GLOW,
        borderRadius: 18,
        padding: '36px 28px',
        textAlign: 'center',
        maxWidth: 480,
        margin: '24px auto',
      }}
    >
      <p
        style={{
          fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: COPPER, marginBottom: 12,
        }}
      >
        ◇ The Atlas
      </p>
      <h2
        style={{
          fontFamily: FONT_EDITORIAL, fontSize: 26, lineHeight: 1.25,
          color: PALE_YELLOW, textShadow: GLOW_SOFT, marginBottom: 12,
        }}
      >
        Your map is blank for now.
      </h2>
      <p
        style={{
          fontFamily: FONT_EDITORIAL, fontStyle: 'italic',
          fontSize: 15, color: 'rgba(242,228,168,0.62)', lineHeight: 1.5,
          marginBottom: 22,
        }}
      >
        Log a few sessions and the territory will appear.
      </p>
      <button
        onClick={handleClick}
        style={{
          backgroundColor: COPPER, color: '#fff',
          fontSize: 14, fontWeight: 600,
          padding: '12px 22px', borderRadius: 999,
          border: `1px solid ${COPPER_BORDER}`,
          cursor: 'pointer',
        }}
      >
        Log a session →
      </button>
    </div>
  );
}
