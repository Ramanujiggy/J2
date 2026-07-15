// PrismMotif — animated Prism breathing indicator for Capture Composer recording.
// Used as a visual representation of the recording state; pulses/breathes based on
// breathRate parameter. Minimal, brand-aligned pentagon shape.

import { useMemo } from 'react';

interface Props {
  /** SVG size in pixels (width = height). */
  size: number;
  /** Intensity level: 'hero', 'elevated', 'base', etc. Affects opacity/glow. */
  intensity: string;
  /** Breathing cadence: 'fast', 'moderate', 'slow'. Affects animation duration. */
  breathRate: string;
}

export default function PrismMotif({ size, intensity, breathRate }: Props) {
  // Calculate breathing animation duration based on rate
  const breathDuration = useMemo(() => {
    switch (breathRate) {
      case 'fast':
        return '1.4s';
      case 'slow':
        return '3.2s';
      case 'moderate':
      default:
        return '2.0s';
    }
  }, [breathRate]);

  // Calculate opacity/intensity based on level
  const baseOpacity = useMemo(() => {
    switch (intensity) {
      case 'hero':
        return 0.72;
      case 'elevated':
        return 0.54;
      case 'base':
      default:
        return 0.38;
    }
  }, [intensity]);

  // Pentagon vertices (normalized to unit circle, rotated for star-point-up orientation)
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.32;
  const points = Array.from({ length: 5 }, (_, i) => {
    const angle = (i * 72 - 90) * (Math.PI / 180);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return `${x},${y}`;
  }).join(' ');

  return (
    <>
      <style>{`
        @keyframes j2-prism-breathe {
          0%, 100% { opacity: ${baseOpacity}; }
          50% { opacity: ${baseOpacity * 0.6}; }
        }
      `}</style>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        style={{
          display: 'block',
          overflow: 'visible',
          animation: `j2-prism-breathe ${breathDuration} ease-in-out infinite`,
        }}
      >
        <defs>
          <radialGradient id={`prism-motif-glow-${size}`} cx="50%" cy="50%">
            <stop offset="0%" stopColor="rgba(242, 228, 168, 0.4)" />
            <stop offset="70%" stopColor="rgba(242, 228, 168, 0.1)" />
            <stop offset="100%" stopColor="rgba(242, 228, 168, 0)" />
          </radialGradient>
        </defs>

        {/* Outer glow circle */}
        <circle
          cx={cx}
          cy={cy}
          r={r + size * 0.08}
          fill={`url(#prism-motif-glow-${size})`}
          opacity={baseOpacity * 0.5}
        />

        {/* Pentagon stroke */}
        <polygon
          points={points}
          fill="none"
          stroke="rgba(242, 228, 168, 0.62)"
          strokeWidth={1.5}
        />

        {/* Pentagon vertices as dots */}
        {Array.from({ length: 5 }, (_, i) => {
          const angle = (i * 72 - 90) * (Math.PI / 180);
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={2.5}
              fill="rgba(242, 228, 168, 0.72)"
            />
          );
        })}
      </svg>
    </>
  );
}
