// DurationDial — an analog timer knob for session duration. Drag around it,
// spin the wheel, or (on desktop) it responds to wheel; snaps every 15 min.
// Ported from the Margin Notes handoff's makeDial; wrapped as a controlled
// input over `value` (minutes) so it drops into any session form.

import { useEffect, useRef } from 'react';
import { PALE_YELLOW, COPPER, TEXT_TERTIARY } from '../lib/theme.ts';
import { vibrate } from '../lib/haptics.ts';

const MIN = 15, MAX = 240, STEP = 15;
const snap = (m: number) => Math.max(MIN, Math.min(MAX, Math.round(m / STEP) * STEP));
const fmt = (m: number) => {
  const h = Math.floor(m / 60), mm = m % 60;
  return (h ? h + 'h ' : '') + (mm < 10 ? '0' : '') + mm + 'm';
};

interface Props {
  value: number;
  onChange: (minutes: number) => void;
  size?: number;
}

export default function DurationDial({ value, onChange, size = 168 }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const valRef = useRef(snap(value));
  const renderRef = useRef<() => void>(() => {});
  onChangeRef.current = onChange;

  // External control — reflect a changed `value` prop into the dial.
  useEffect(() => {
    const next = snap(value);
    if (next !== valRef.current) { valRef.current = next; renderRef.current(); }
  }, [value]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const cx = size / 2, cy = size / 2, r = size / 2 - 16, C = 2 * Math.PI * r;
    let last = valRef.current;

    host.innerHTML =
      '<div style="position:relative;width:' + size + 'px;height:' + size + 'px">'
      + '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="touch-action:none;cursor:grab;display:block">'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="12"/>'
      + '<circle class="prog" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + COPPER + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + C + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>'
      + '<circle class="knob" r="9" fill="' + PALE_YELLOW + '" stroke="#12130e" stroke-width="2"/></svg>'
      + '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none">'
      + '<div class="dv" style="font-family:\'Plus Jakarta Sans\',system-ui,sans-serif;font-variant-numeric:tabular-nums;font-size:27px;font-weight:700;color:' + PALE_YELLOW + ';letter-spacing:-0.01em"></div>'
      + '<div style="font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:' + TEXT_TERTIARY + ';margin-top:4px">on the mat</div>'
      + '</div></div>';

    const svg = host.querySelector('svg')!;
    const prog = host.querySelector('.prog') as SVGCircleElement;
    const knob = host.querySelector('.knob') as SVGCircleElement;
    const dv = host.querySelector('.dv') as HTMLElement;

    const render = () => {
      const val = valRef.current;
      const frac = (val - MIN) / (MAX - MIN);
      prog.style.strokeDashoffset = String(C * (1 - frac));
      const th = -Math.PI / 2 + frac * 2 * Math.PI;
      knob.setAttribute('cx', String(cx + r * Math.cos(th)));
      knob.setAttribute('cy', String(cy + r * Math.sin(th)));
      dv.textContent = fmt(val);
      if (val !== last) { last = val; vibrate(6); }
    };
    renderRef.current = render;

    const setFromXY = (x: number, y: number) => {
      let a = Math.atan2(y - cy, x - cx) + Math.PI / 2;
      if (a < 0) a += 2 * Math.PI;
      const next = snap(MIN + a / (2 * Math.PI) * (MAX - MIN));
      if (next !== valRef.current) { valRef.current = next; render(); onChangeRef.current(next); }
      else render();
    };

    let drag = false;
    const onDown = (e: PointerEvent) => {
      drag = true; svg.setPointerCapture(e.pointerId);
      const b = svg.getBoundingClientRect();
      setFromXY(e.clientX - b.left, e.clientY - b.top);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const b = svg.getBoundingClientRect();
      setFromXY(e.clientX - b.left, e.clientY - b.top);
    };
    const onUp = () => { drag = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = snap(valRef.current + (e.deltaY < 0 ? STEP : -STEP));
      if (next !== valRef.current) { valRef.current = next; render(); onChangeRef.current(next); }
    };

    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    host.addEventListener('wheel', onWheel, { passive: false });
    render();

    return () => {
      svg.removeEventListener('pointerdown', onDown);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerup', onUp);
      host.removeEventListener('wheel', onWheel);
      renderRef.current = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  return <div ref={hostRef} style={{ display: 'flex', justifyContent: 'center' }} />;
}
