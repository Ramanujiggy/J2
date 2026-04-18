import { useLayoutEffect, useRef, useState } from 'react';
import { COPPER, SURFACE_2 } from '../lib/theme.ts';
import { vibrate } from '../lib/haptics.ts';

interface Option<T extends string> { value: T; label: string }

interface Props<T extends string> {
  options: Option<T>[];
  value: T | null;
  onChange: (v: T | null) => void;
  deselectable?: boolean;
}

export default function SegmentedToggle<T extends string>({ options, value, onChange, deselectable }: Props<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [slider, setSlider] = useState<{ left: number; width: number } | null>(null);

  // Measure the active button and position the slider behind it
  useLayoutEffect(() => {
    if (value == null) { setSlider(null); return; }
    const node = buttonRefs.current[value];
    const track = trackRef.current;
    if (!node || !track) return;
    const nRect = node.getBoundingClientRect();
    const tRect = track.getBoundingClientRect();
    setSlider({ left: nRect.left - tRect.left - 2, width: nRect.width });
  }, [value, options]);

  return (
    <div
      ref={trackRef}
      className="flex rounded-xl p-0.5 relative"
      style={{ backgroundColor: SURFACE_2 }}
    >
      {/* Sliding copper pill */}
      {slider && (
        <div
          className="absolute rounded-[10px] pointer-events-none"
          style={{
            top: 2,
            left: 2,
            height: 'calc(100% - 4px)',
            width: slider.width,
            backgroundColor: COPPER,
            transform: `translateX(${slider.left}px)`,
            transition: 'transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1), width 280ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            boxShadow: '0 2px 8px rgba(196,145,95,0.3)',
            zIndex: 0,
          }}
        />
      )}

      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            ref={el => { buttonRefs.current[opt.value] = el; }}
            type="button"
            onClick={() => {
              vibrate(8);
              onChange(deselectable && active ? null : opt.value);
            }}
            className="flex-1 h-10 rounded-[10px] text-sm font-medium touch-manipulation relative"
            style={{
              backgroundColor: 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,0.45)',
              transition: 'color 200ms ease',
              zIndex: 1,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
