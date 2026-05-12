// Editorial empty-state hero for /journal. ABY pattern.

import { useNavigate } from 'react-router-dom';
import {
  CARD_BG, CARD_GLOW, CARD_GLOW_BORDER, COPPER, COPPER_BORDER,
  PALE_YELLOW, FONT_EDITORIAL, GLOW_SOFT,
} from '../../lib/theme.ts';

export default function JournalEmptyHero() {
  const navigate = useNavigate();
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
        ◇ Journal
      </p>
      <h2
        style={{
          fontFamily: FONT_EDITORIAL, fontSize: 26, lineHeight: 1.25,
          color: PALE_YELLOW, textShadow: GLOW_SOFT, marginBottom: 6,
        }}
      >
        Empty.
      </h2>
      <h2
        style={{
          fontFamily: FONT_EDITORIAL, fontSize: 26, lineHeight: 1.25,
          color: PALE_YELLOW, textShadow: GLOW_SOFT, marginBottom: 16,
        }}
      >
        But full of possibilities.
      </h2>
      <p
        style={{
          fontFamily: FONT_EDITORIAL, fontStyle: 'italic',
          fontSize: 15, color: 'rgba(242,228,168,0.62)', lineHeight: 1.5,
          marginBottom: 22,
        }}
      >
        Each session you log adds a page.
      </p>
      <button
        onClick={() => navigate('/home')}
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
