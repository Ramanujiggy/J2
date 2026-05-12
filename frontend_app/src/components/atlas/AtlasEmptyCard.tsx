// AtlasEmptyCard — small shared "no data" card used inside AtlasTimelinePanel.
// Editorial register, 60×32 padding, copper-tinted card edge.
//
// Extracted from AtlasPage.tsx during the 2026-05-09 refactor pass.

import { CARD_BG } from '../../lib/theme.ts';

interface Props {
  title: string;
  body: string;
}

export default function AtlasEmptyCard({ title, body }: Props) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: '1px solid var(--j2-border-2)',
        borderRadius: 16,
        padding: '60px 32px',
        textAlign: 'center',
        maxWidth: 560,
        margin: '40px auto',
      }}
    >
      <h2 className="j2-serif-display" style={{ fontSize: 28, margin: 0 }}>{title}</h2>
      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.50)', lineHeight: 1.6, marginTop: 10 }}>
        {body}
      </p>
    </div>
  );
}
