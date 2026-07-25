// StampCollectionPage — the Boa die collection, reachable from Profile and from
// the reveal sheet's "Collection" button. Earned dies render live and open the
// reveal sheet on tap; unearned dies show a dimmed silhouette (no name, no
// criteria — you find out what one is by earning it).

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import PageContent from '../components/PageContent.tsx';
import SealStamp from '../components/seal/SealStamp.tsx';
import SealRevealSheet from '../components/seal/SealRevealSheet.tsx';
import { useStamps } from '../hooks/useStamps.ts';
import { STAMP_DIES, DIE_KEYS, type StampDie } from '../lib/stampDies.ts';
import {
  PALE_YELLOW, GLOW_SOFT, COPPER, FONT_EDITORIAL, CARD_BG, CARD_GLOW, CARD_GLOW_BORDER,
  SURFACE_2, SURFACE_2_BORDER,
} from '../lib/theme.ts';

export default function StampCollectionPage() {
  const navigate = useNavigate();
  const { stamps, loading } = useStamps();
  const [reveal, setReveal] = useState<{ die: StampDie; struckAt: string; count: number; auto: boolean } | null>(null);

  const earnedCount = DIE_KEYS.filter(k => stamps.has(k)).length;

  return (
    <PageContent ready={!loading}>
      <div className="mx-auto max-w-2xl px-4 sm:px-6" style={{ paddingTop: 16, paddingBottom: 32 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <button
            onClick={() => navigate('/profile')}
            aria-label="Back to profile"
            style={{ padding: 8, borderRadius: 10, background: SURFACE_2, border: `1px solid ${SURFACE_2_BORDER}`, color: 'rgba(242,228,168,0.6)', cursor: 'pointer' }}
          >
            <ChevronLeft size={16} />
          </button>
          <h1 style={{ fontFamily: FONT_EDITORIAL, fontSize: 28, color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
            Collection
          </h1>
        </div>

        <div
          style={{ backgroundColor: CARD_BG, border: `1px solid ${CARD_GLOW_BORDER}`, boxShadow: CARD_GLOW, borderRadius: 18, padding: 22 }}
        >
          <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: COPPER, marginBottom: 16 }}>
            ◇ {earnedCount} of {DIE_KEYS.length} struck
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
            {DIE_KEYS.map(key => {
              const die = STAMP_DIES[key]!;
              const earned = stamps.get(key);
              if (earned) {
                return (
                  <button
                    key={key}
                    onClick={() => setReveal({ die, struckAt: earned.last_struck_at, count: earned.count, auto: die.earnRule === 'auto' })}
                    className="j2-press"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
                  >
                    <SealStamp die={die} top={die.sub} size={82} style={{ transform: 'rotate(-8deg)' }} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>{die.name}</span>
                  </button>
                );
              }
              return (
                <div
                  key={key}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 8, opacity: 0.16, filter: 'grayscale(1)' }}
                  aria-label="Locked stamp"
                >
                  <SealStamp die={die} top="· · · ·" size={82} style={{ transform: 'rotate(-8deg)' }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Locked</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <SealRevealSheet
        open={reveal != null}
        die={reveal?.die ?? null}
        struckAt={reveal?.struckAt ?? null}
        count={reveal?.count ?? 0}
        autoEarned={reveal?.auto ?? false}
        onClose={() => setReveal(null)}
      />
    </PageContent>
  );
}
