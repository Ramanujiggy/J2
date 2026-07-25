// SealStamp — renders a Boa ink die as SVG.
//
// The die generator (sealSVG / shakaHand / inkfx) is ported VERBATIM from the
// design handoff (mockups/Margin Notes.html · boa-seal.reference.js). Do not
// redraw it. The only React-specific change: the original minted filter/mask
// ids from a module-level `_sid` counter, which collides across instances and
// breaks under StrictMode's double-invoke. Here every instance gets a stable
// unique id from useId() so two seals on one screen don't inherit each other's
// feTurbulence filters.
//
// Rendered via dangerouslySetInnerHTML: the content is entirely app-authored
// (no user input → no XSS), and it keeps the two feTurbulence filters + mask
// byte-for-byte faithful to the source rather than re-authoring them as JSX.

import { useId } from 'react';
import { PRESTIGE_BLUE_GLOW } from '../../lib/theme.ts';
import type { StampDie } from '../../lib/stampDies.ts';

const HAND_D = 'M 886.699219 551.328125 C 863.804688 634.53125 833.636719 704.890625 817.839844 789.148438 C 804.808594 858.671875 784.96875 976.699219 764.769531 1040.078125 C 746.660156 1096.910156 742.472656 1100.082031 697.199219 1125.53125 C 634.738281 1160.644531 553.765625 1195.332031 484.425781 1219.761719 L 685.523438 1566.128906 C 690.871094 1575.847656 694.199219 1584.074219 701.828125 1590.507812 C 702.863281 1601.523438 717.804688 1622.402344 725.148438 1629.34375 C 813.5625 1609.785156 986.664062 1464.789062 1065.609375 1472.121094 C 1139.558594 1478.988281 1246.800781 1436.011719 1305.339844 1405.484375 C 1442.578125 1333.914062 1423.921875 1328.226562 1585.289062 1281.707031 C 1633.019531 1267.949219 1865.851562 1204.847656 1885.121094 1176.464844 C 1913.851562 1165.519531 1913.808594 1083.980469 1851.53125 1080.910156 C 1817.789062 1079.238281 1768.269531 1099.53125 1739.78125 1110.851562 C 1704.148438 1125.015625 1545.351562 1157.921875 1506.410156 1157.765625 C 1546.550781 1141.03125 1592.898438 1011.128906 1454.210938 995.46875 C 1463.390625 979.421875 1498.308594 953.570312 1479.761719 900.011719 C 1461.148438 846.261719 1435.070312 846.871094 1409.328125 838 C 1415.78125 818.210938 1426.621094 805.429688 1423.839844 778.089844 C 1413.800781 679.308594 1301.171875 676.148438 1228.851562 697.5 C 1191.121094 708.640625 1062.460938 731.640625 1029.941406 732.261719 C 1054.308594 654.449219 1044.269531 524.5 1033.089844 443.679688 C 1015.359375 315.53125 902.105469 282.210938 863.621094 310.710938 C 840.898438 333.398438 917.402344 439.78125 886.699219 551.328125 Z';
const CHORD = 'M20.6,138 A88,88 0 0 0 179.4,138 Z';
const AB = 'font-family="Archivo Black,Plus Jakarta Sans,sans-serif" font-weight="900"';
const OS = 'font-family="Oswald,Plus Jakarta Sans,sans-serif" font-weight="700"';

// eroded-edge + patchy-coverage defs: what makes it ink and not metal
function inkfx(id: string, seed: number): string {
  return '<filter id="r' + id + '" x="-12%" y="-12%" width="124%" height="124%">'
    + '<feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="' + seed + '" result="t"/>'
    + '<feDisplacementMap in="SourceGraphic" in2="t" scale="2.8" xChannelSelector="R" yChannelSelector="G"/></filter>'
    + '<filter id="sp' + id + '"><feTurbulence type="fractalNoise" baseFrequency="0.46" numOctaves="3" seed="' + (seed + 31) + '" result="n"/>'
    + '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.45 0 0 0 -0.75"/></filter>'
    + '<mask id="m' + id + '" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">'
    + '<rect width="200" height="200" fill="#fff"/><rect width="200" height="200" filter="url(#sp' + id + ')"/></mask>';
}

// the shaka + gi cuff. ang/flip locked to 8/1 — "from lower-right"
function shakaHand(S: number, w: number, ang: number, flip: number): string {
  const HCX = 1199, HCY = 955;
  const tx = (100 - S * HCX).toFixed(2), ty = (98 - S * HCY).toFixed(2);
  let Ax = 484, Ay = 1220, Bx = 685, By = 1566;
  const px = -0.865, py = 0.503, dwx = 0.503, dwy = 0.865, e = 95;
  Ax -= dwx * e; Ay -= dwy * e; Bx += dwx * e; By += dwy * e;
  const pt = (bx: number, by: number, d: number) => (bx + px * d).toFixed(0) + ',' + (by + py * d).toFixed(0);
  const W = 300, L = 150, vs = 'style="vector-effect:non-scaling-stroke"';
  const cuff = 'M' + pt(Ax, Ay, -40) + ' L' + pt(Bx, By, -40) + ' L' + pt(Bx, By, W) + ' L' + pt(Ax, Ay, W) + ' Z';
  const slv = 'M' + pt(Ax, Ay, W) + ' L' + (Ax + px * (W + L) - 40).toFixed(0) + ',' + (Ay + py * (W + L) + 22).toFixed(0)
    + ' L' + (Bx + px * (W + L) + 40).toFixed(0) + ',' + (By + py * (W + L) - 12).toFixed(0) + ' L' + pt(Bx, By, W);
  let g = '<g transform="translate(' + tx + ',' + ty + ') scale(' + S + ') rotate(' + ang + ' ' + HCX + ' ' + HCY + ')' + (flip ? ' translate(' + (2 * HCX) + ',0) scale(-1,1)' : '') + '" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">';
  g += '<path d="' + slv + '" stroke-width="' + (w * 0.88) + '" ' + vs + '/>';
  g += '<path d="' + cuff + '" stroke-width="' + (w * 0.96) + '" ' + vs + '/>';
  g += '<path d="M' + pt(Ax, Ay, 90) + ' L' + pt(Bx, By, 90) + '" stroke-width="' + (w * 0.42) + '" ' + vs + '/>';
  g += '<path d="M' + pt(Ax, Ay, 186) + ' L' + pt(Bx, By, 186) + '" stroke-width="' + (w * 0.42) + '" ' + vs + '/>';
  g += '<path d="' + HAND_D + '" stroke-width="' + w + '" ' + vs + '/></g>';
  return g;
}

// one die, one flat ink. band:'outline' on dark surfaces, 'fill' on paper.
function sealSVG(die: StampDie, top: string, uid: string): string {
  const ink = die.col || '#D9A468';
  const band = die.band || 'outline';
  const bg = '#152E22';
  const ang = die.ang != null ? die.ang : 8;
  const flip = die.flip != null ? die.flip : 1;
  let o = '<svg viewBox="0 0 200 200" width="100%" height="100%" style="color:' + ink + '">'
    + '<defs>' + inkfx(uid, 7) + '<path id="t' + uid + '" d="M39.3,58 A74,74 0 0 1 160.7,58" fill="none"/></defs>'
    + '<g filter="url(#r' + uid + ')" mask="url(#m' + uid + ')" fill="' + ink + '" stroke="' + ink + '">'
    + '<circle cx="100" cy="100" r="92" fill="none" stroke-width="6"/>'
    + '<text ' + AB + ' font-size="22" letter-spacing="2" fill="' + ink + '"><textPath href="#t' + uid + '" startOffset="50%" text-anchor="middle">BOA !</textPath></text>'
    + '<text ' + OS + ' font-size="8.5" letter-spacing="2.6" text-anchor="middle" x="100" y="62" fill="' + ink + '">' + die.sub + '</text>'
    + shakaHand(0.05, 4.4, ang, flip);
  if (band === 'fill') {
    o += '<path d="' + CHORD + '" fill="' + ink + '" stroke="none"/>'
      + '<text ' + OS + ' font-size="12.5" letter-spacing="3" text-anchor="middle" x="100" y="161" fill="' + bg + '" stroke="none">' + top + '</text>';
  } else {
    o += '<path d="' + CHORD + '" fill="none" stroke-width="3.2"/>'
      + '<text ' + OS + ' font-size="12.5" letter-spacing="3" text-anchor="middle" x="100" y="161" fill="' + ink + '">' + top + '</text>';
  }
  return o + '</g></svg>';
}

interface Props {
  die: StampDie;
  /** Chord-band text (a formatted date). Omit for locked/blank silhouettes. */
  top?: string;
  /** Rendered size in px (60 on the entry, 172 in the reveal sheet). */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function SealStamp({ die, top = '', size = 60, className, style }: Props) {
  // useId() can contain ':' which is invalid inside url(#…) references — strip
  // to alphanumerics for a stable, reference-safe per-instance id.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const html = sealSVG(die, top, uid);
  const glow = die.prestige
    ? `drop-shadow(0 0 6px ${PRESTIGE_BLUE_GLOW}) drop-shadow(0 0 14px ${PRESTIGE_BLUE_GLOW})`
    : undefined;
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{ display: 'inline-block', width: size, height: size, filter: glow, ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
