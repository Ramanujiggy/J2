// PrismSkinToggle — Appearance setting for the focus prism's look. Two skins:
//   • etched — line/diamond marks (default)
//   • facet  — glowing gradient facets (light behavior)
// Persists to localStorage 'j2-prism-skin'; the Capture Composer reads it on
// mount. Shows a live, interactive preview so the difference is visible.

import { useState } from 'react';
import SegmentedToggle from './SegmentedToggle.tsx';
import PrismFocusInput, { type PrismSkin } from './PrismFocusInput.tsx';
import type { ChipSelection } from '../lib/selectionsToDistribution.ts';
import { PALE_YELLOW } from '../lib/theme.ts';

const STORAGE_KEY = 'j2-prism-skin';

// A couple of raised points so both skins show their character in the preview.
const PREVIEW: ChipSelection[] = [
  { pillar: 'guard', primary: true, deep_work: true },
  { pillar: 'standup', primary: false, deep_work: false },
];

function readSkin(): PrismSkin {
  try { return localStorage.getItem(STORAGE_KEY) === 'facet' ? 'facet' : 'etched'; }
  catch { return 'etched'; }
}

export default function PrismSkinToggle() {
  const [skin, setSkin] = useState<PrismSkin>(readSkin);
  const [preview] = useState<ChipSelection[]>(PREVIEW);

  const choose = (v: PrismSkin | null) => {
    if (!v) return;
    setSkin(v);
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
  };

  return (
    <div>
      <p className="text-sm font-semibold text-white" style={{ marginBottom: 2 }}>Prism style</p>
      <p className="text-xs text-white/40" style={{ marginBottom: 14 }}>
        How the focus prism looks when you log a session.
      </p>

      <SegmentedToggle<PrismSkin>
        options={[{ value: 'etched', label: 'Etched' }, { value: 'facet', label: 'Facet · glow' }]}
        value={skin}
        onChange={choose}
      />

      {/* Live preview — drag or tap to feel it; changes here don't save. */}
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <PrismFocusInput selections={preview} onChange={() => {}} skin={skin} />
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: -6 }}>
          Preview · <span style={{ color: PALE_YELLOW }}>{skin === 'facet' ? 'Facet' : 'Etched'}</span>
        </p>
      </div>
    </div>
  );
}
