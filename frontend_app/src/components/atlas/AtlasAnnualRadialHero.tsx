// AtlasAnnualRadialHero — the year-of-training hero card at the top of
// the Atlas Analytics tab. Houses an AnnualRadial chart at 620px and a
// pillar-count legend strip beneath, separated by a copper hairline.
//
// Migrated to Atlas from the desktop PathAhead page when the IA tightened
// to "operational vs reflective" — the year-shaped reflection belongs in
// Atlas's reflective register, not the operational dashboard.
//
// Extracted from AtlasPage.tsx during the 2026-05-09 refactor pass.

import AnnualRadial from '../charts/AnnualRadial.tsx';
import { SKILL_COLORS } from '../charts/RadarChart.tsx';
import { SKILL_TAGS } from '../../lib/constants.ts';
import { toDateString } from '../../lib/sessionUtils.ts';
import {
  CARD_BG, CARD_GLOW, CARD_GLOW_BORDER, COPPER, FONT_EDITORIAL, PALE_YELLOW,
} from '../../lib/theme.ts';
import type { Intention, SessionSummary } from '../../types/api.ts';

interface Props {
  sessions: SessionSummary[];
  intentions: Intention[];
  currentYear: number;
}

export default function AtlasAnnualRadialHero({ sessions, intentions, currentYear }: Props) {
  return (
    <div
      style={{
        backgroundColor: CARD_BG,
        border: `1px solid ${CARD_GLOW_BORDER}`,
        boxShadow: CARD_GLOW,
        borderRadius: 16,
        padding: 40,
        marginBottom: 28,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
        <div>
          <div className="j2-label-copper">◈ The Path · {currentYear}</div>
          <div className="j2-serif-display" style={{ fontSize: 30, marginTop: 8 }}>
            A year of training at a glance
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 28px' }}>
        <AnnualRadial
          sessions={sessions}
          intentions={intentions}
          year={currentYear}
          size={620}
        />
      </div>
      {/* Pillar legend */}
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', gap: 14,
          paddingTop: 22, borderTop: '1px solid var(--j2-border-2)',
        }}
      >
        {SKILL_TAGS.map(tag => {
          const count = sessions.filter(s =>
            new Date((typeof s.date === 'string' ? s.date : toDateString(new Date(s.date))) + 'T00:00:00').getFullYear() === currentYear
            && s.tags?.[0] === tag.value
          ).length;
          const color = SKILL_COLORS[tag.value]?.stroke ?? COPPER;
          return (
            <div key={tag.value} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: color,
                  boxShadow: `0 0 12px ${color}80`,
                }}
              />
              <div className="j2-label-micro" style={{ fontSize: 12 }}>{tag.label}</div>
              <div style={{ fontSize: 19, color: PALE_YELLOW, fontFamily: FONT_EDITORIAL }}>{count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
