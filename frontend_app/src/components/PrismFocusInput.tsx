// PrismFocusInput — drag-first focus input. The pentagon IS the control: drag a
// point outward (untouched → touched → drilled) or tap to step; the deepest
// point becomes the study (primary). Two skins: etched (default), facet.
//
// The interaction engine is ported from the design handoff's margin-prism.js
// (imperative SVG + rAF + pointer capture). It's wrapped here so its output is a
// standard controlled input: it reads/writes ChipSelection[] — the exact shape
// LogSessionForm and SessionDetailModal already use — so it drops into either
// the current form or the future Margin Notes layout with no payload change.
//
//   level 0 (untouched) → pillar absent from selections
//   level 1 (touched)   → { deep_work: false }
//   level 2 (drilled)   → { deep_work: true }
//   deepest point       → { primary: true }  (the study)

import { useEffect, useRef } from 'react';
import { PALE_YELLOW, COPPER } from '../lib/theme.ts';
import { vibrate } from '../lib/haptics.ts';
import type { ChipSelection } from '../lib/selectionsToDistribution.ts';
import type { Pillar } from '../types/api.ts';

export type PrismSkin = 'etched' | 'facet';

const PILLARS: Pillar[] = ['standup', 'passing', 'pins', 'submissions', 'guard'];
const PLBL = ['Stand-up', 'Passing', 'Pins', 'Subs', 'Guard'];
const PN = 5;
const DETS = [0.14, 0.6, 1.0];

function pang(i: number): number { return -Math.PI / 2 + i * 2 * Math.PI / 5; }

function selectionsToLevels(selections: readonly ChipSelection[]): number[] {
  const lvl = [0, 0, 0, 0, 0];
  for (const s of selections) {
    const i = PILLARS.indexOf(s.pillar);
    if (i >= 0) lvl[i] = s.deep_work ? 2 : 1;
  }
  return lvl;
}

function levelsToSelections(lvl: number[]): ChipSelection[] {
  let heart = -1;
  for (let i = 0; i < PN; i++) if (lvl[i]! > 0 && (heart < 0 || lvl[i]! > lvl[heart]!)) heart = i;
  const out: ChipSelection[] = [];
  for (let i = 0; i < PN; i++) {
    if (lvl[i]! > 0) out.push({ pillar: PILLARS[i]!, primary: i === heart, deep_work: lvl[i] === 2 });
  }
  return out;
}

interface Props {
  selections: ChipSelection[];
  onChange: (next: ChipSelection[]) => void;
  skin?: PrismSkin;
}

export default function PrismFocusInput({ selections, onChange, skin = 'etched' }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const onChangeRef = useRef(onChange);
  const skinRef = useRef<PrismSkin>(skin);
  const renderRef = useRef<() => void>(() => {});

  onChangeRef.current = onChange;

  // Re-render (not re-init) when the skin changes.
  useEffect(() => { skinRef.current = skin; renderRef.current(); }, [skin]);

  // Seed once from the initial selections; the engine owns state thereafter and
  // reports outward via onChange.
  const seedRef = useRef(selections);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cx = 170, cy = 150, R = 96;

    const lvl = selectionsToLevels(seedRef.current);
    const vals: number[] = [], vel: number[] = [], pulse: number[] = [0, 0, 0, 0, 0];
    for (let i = 0; i < PN; i++) { vals[i] = DETS[lvl[i]!]!; vel[i] = 0; }
    let drag = -1, moved = false, down: { x: number; y: number } | null = null;
    let running = false, last = 0;

    const pt = (e: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      return { x: (e.clientX - r.left) * 340 / r.width, y: (e.clientY - r.top) * 310 / r.height };
    };
    const nearest = (v: number) => {
      let b = 0;
      for (let j = 1; j < 3; j++) if (Math.abs(DETS[j]! - v) < Math.abs(DETS[b]! - v)) b = j;
      return b;
    };
    const heart = () => {
      let b = -1;
      for (let i = 0; i < PN; i++) if (lvl[i]! > 0 && (b < 0 || lvl[i]! > lvl[b]!)) b = i;
      return b;
    };
    const vpts = () => {
      const a = [];
      for (let i = 0; i < PN; i++) a.push({ x: cx + Math.cos(pang(i)) * R * vals[i]!, y: cy + Math.sin(pang(i)) * R * vals[i]! });
      return a;
    };
    const poly = (p: { x: number; y: number }[]) => p.map(q => q.x.toFixed(1) + ',' + q.y.toFixed(1)).join(' ');
    const labels = () => {
      let s = '';
      for (let i = 0; i < PN; i++) {
        const a = pang(i), lx = cx + Math.cos(a) * (R + 20), ly = cy + Math.sin(a) * (R + 20) + 3;
        const anc = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
        s += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" font-family="Plus Jakarta Sans" font-size="10.5" font-weight="700" letter-spacing="0.06em" fill="' + (lvl[i]! ? PALE_YELLOW : 'rgba(255,255,255,0.38)') + '" text-anchor="' + anc + '" pointer-events="none">' + PLBL[i]!.toUpperCase() + '</text>';
      }
      return s;
    };
    const pulses = (col: string) => {
      let s = ''; const vp = vpts();
      for (let i = 0; i < PN; i++) if (pulse[i]! > 0) {
        const r = 10 + 16 * (1 - pulse[i]!);
        s += '<circle cx="' + vp[i]!.x + '" cy="' + vp[i]!.y + '" r="' + r.toFixed(1) + '" fill="none" stroke="' + col + '" stroke-width="1.5" opacity="' + (pulse[i]! * 0.8).toFixed(2) + '"/>';
      }
      return s;
    };
    const etchedBase = (() => {
      let s = '';
      for (let i = 0; i < PN; i++) {
        const a = pang(i), ca = Math.cos(a), sa = Math.sin(a);
        s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + ca * R) + '" y2="' + (cy + sa * R) + '" stroke="rgba(255,255,255,0.09)" stroke-width="1"/>';
        for (let j = 0; j < 3; j++) {
          const r = R * DETS[j]!, px = -sa * 4, py = ca * 4;
          s += '<line x1="' + (cx + ca * r - px) + '" y1="' + (cy + sa * r - py) + '" x2="' + (cx + ca * r + px) + '" y2="' + (cy + sa * r + py) + '" stroke="rgba(196,145,95,0.5)" stroke-width="1"/>';
        }
      }
      const o = [];
      for (let k = 0; k < PN; k++) o.push({ x: cx + Math.cos(pang(k)) * R, y: cy + Math.sin(pang(k)) * R });
      s += '<polygon points="' + poly(o) + '" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>';
      return s;
    })();

    const SKINS: Record<PrismSkin, () => string> = {
      etched: () => {
        const vp = vpts(); let s = etchedBase; const hk = heart();
        s += '<polygon points="' + poly(vp) + '" fill="rgba(196,145,95,0.06)" stroke="' + COPPER + '" stroke-width="1.6" stroke-linejoin="round"/>';
        for (let i = 0; i < PN; i++) {
          const p = vp[i]!, on = lvl[i]! > 0, sz = lvl[i] === 2 ? 6 : lvl[i] === 1 ? 5 : 3.6;
          if (hk === i) s += '<rect x="' + (p.x - sz - 4.5) + '" y="' + (p.y - sz - 4.5) + '" width="' + ((sz + 4.5) * 2) + '" height="' + ((sz + 4.5) * 2) + '" fill="none" stroke="' + PALE_YELLOW + '" stroke-width="1.3" transform="rotate(45 ' + p.x + ' ' + p.y + ')"/>';
          s += '<rect x="' + (p.x - sz) + '" y="' + (p.y - sz) + '" width="' + (sz * 2) + '" height="' + (sz * 2) + '" fill="' + (on ? PALE_YELLOW : 'rgba(255,255,255,0.3)') + '" transform="rotate(45 ' + p.x + ' ' + p.y + ')"/>';
        }
        return s + pulses(PALE_YELLOW) + labels();
      },
      facet: () => {
        const vp = vpts(); const hk = heart();
        let s = '<defs><filter id="mfglow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>';
        for (let i = 0; i < PN; i++) {
          const a1 = pang(i), a2 = pang((i + 1) % PN);
          s += '<linearGradient id="mfg' + i + '" x1="' + (0.5 + Math.cos((a1 + a2) / 2) * 0.5) + '" y1="' + (0.5 + Math.sin((a1 + a2) / 2) * 0.5) + '" x2="0.5" y2="0.5"><stop offset="0%" stop-color="' + PALE_YELLOW + '"/><stop offset="100%" stop-color="' + COPPER + '" stop-opacity="0.15"/></linearGradient>';
        }
        s += '</defs>';
        for (let g = 0; g < 2; g++) {
          const r = R * DETS[g + 1]!, ring = [];
          for (let k = 0; k < PN; k++) ring.push({ x: cx + Math.cos(pang(k)) * r, y: cy + Math.sin(pang(k)) * r });
          s += '<polygon points="' + poly(ring) + '" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>';
        }
        s += '<polygon points="' + poly(vp) + '" fill="rgba(196,145,95,0.5)" filter="url(#mfglow)" opacity="0.55"/>';
        for (let i = 0; i < PN; i++) {
          const j = (i + 1) % PN, op = 0.14 + 0.4 * ((vals[i]! + vals[j]!) / 2);
          s += '<polygon points="' + cx + ',' + cy + ' ' + vp[i]!.x + ',' + vp[i]!.y + ' ' + vp[j]!.x + ',' + vp[j]!.y + '" fill="url(#mfg' + i + ')" opacity="' + op.toFixed(2) + '" stroke="rgba(242,228,168,0.25)" stroke-width="0.7"/>';
        }
        s += '<polygon points="' + poly(vp) + '" fill="none" stroke="' + PALE_YELLOW + '" stroke-width="1.3" stroke-linejoin="round" opacity="0.85"/>';
        for (let i = 0; i < PN; i++) {
          const p = vp[i]!, on = lvl[i]! > 0, r2 = lvl[i] === 2 ? 5.5 : lvl[i] === 1 ? 4.5 : 3.2;
          s += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + (r2 + 5) + '" fill="rgba(242,228,168,' + (on ? 0.18 : 0.06) + ')"/>';
          if (hk === i) s += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + (r2 + 8) + '" fill="none" stroke="' + PALE_YELLOW + '" stroke-width="1.4"/>';
          s += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + r2 + '" fill="' + (on ? PALE_YELLOW : 'rgba(255,255,255,0.35)') + '"/>';
        }
        return s + pulses(PALE_YELLOW) + labels();
      },
    };

    const render = () => { svg.innerHTML = SKINS[skinRef.current](); };
    renderRef.current = render;

    const active = () => {
      if (drag >= 0) return true;
      for (let i = 0; i < PN; i++) if (pulse[i]! > 0 || Math.abs(DETS[lvl[i]!]! - vals[i]!) > 0.002 || Math.abs(vel[i]!) > 0.002) return true;
      return false;
    };
    const frame = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000); last = now;
      for (let i = 0; i < PN; i++) {
        pulse[i] = Math.max(0, pulse[i]! - dt * 3);
        if (i === drag && moved) continue;
        const t = DETS[lvl[i]!]!;
        if (REDUCE) { vals[i] = t; vel[i] = 0; continue; }
        const acc = 180 * (t - vals[i]!) - 13 * vel[i]!;
        vel[i]! += acc * dt; vals[i]! += vel[i]! * dt;
      }
      render();
      if (active()) requestAnimationFrame(frame);
      else {
        for (let j = 0; j < PN; j++) { vals[j] = DETS[lvl[j]!]!; vel[j] = 0; pulse[j] = 0; }
        render(); running = false;
      }
    };
    const wake = () => { if (running) return; running = true; last = performance.now(); requestAnimationFrame(frame); };

    const onDown = (e: PointerEvent) => {
      const p = pt(e); let best = -1, bd = 1e9;
      for (let i = 0; i < PN; i++) {
        const vx = cx + Math.cos(pang(i)) * R * vals[i]!, vy = cy + Math.sin(pang(i)) * R * vals[i]!;
        const d = Math.hypot(p.x - vx, p.y - vy);
        if (d < bd) { bd = d; best = i; }
      }
      if (bd > 36) return;
      drag = best; moved = false; down = p; svg.setPointerCapture(e.pointerId); e.preventDefault(); wake();
    };
    const onMove = (e: PointerEvent) => {
      if (drag < 0) return;
      const p = pt(e);
      if (!moved && down && Math.hypot(p.x - down.x, p.y - down.y) > 6) moved = true;
      if (!moved) return;
      const a = pang(drag);
      let v = ((p.x - cx) * Math.cos(a) + (p.y - cy) * Math.sin(a)) / R;
      if (v > 1) v = 1 + (v - 1) * 0.28;
      if (v < DETS[0]!) v = DETS[0]! - (DETS[0]! - v) * 0.28;
      if (nearest(vals[drag]!) !== nearest(v)) { vibrate(5); pulse[drag] = 1; }
      vals[drag] = v; vel[drag] = 0; wake();
    };
    const commit = () => {
      if (drag < 0) return;
      const i = drag; drag = -1;
      if (!moved) lvl[i] = (lvl[i]! + 1) % 3;
      else lvl[i] = nearest(vals[i]!);
      vibrate(8); pulse[i] = 1; wake();
      onChangeRef.current(levelsToSelections(lvl));
    };

    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', commit);
    svg.addEventListener('pointercancel', commit);
    render();

    return () => {
      svg.removeEventListener('pointerdown', onDown);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerup', commit);
      svg.removeEventListener('pointercancel', commit);
      renderRef.current = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg
        ref={svgRef}
        width="100%"
        viewBox="0 0 340 310"
        style={{ maxWidth: 340, touchAction: 'none', cursor: 'grab', display: 'block' }}
        role="group"
        aria-label="Focus areas — drag a point outward or tap to step through untouched, touched, and drilled"
      />
    </div>
  );
}
