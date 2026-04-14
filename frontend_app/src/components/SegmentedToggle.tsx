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
  return (
    <div className="flex rounded-xl p-0.5" style={{ backgroundColor: SURFACE_2 }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              vibrate(8);
              onChange(deselectable && active ? null : opt.value);
            }}
            className="flex-1 h-10 rounded-[10px] text-sm font-medium transition-all touch-manipulation"
            style={{
              backgroundColor: active ? COPPER : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,0.45)',
              transition: 'background-color 200ms ease, color 200ms ease',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
