// 4-dot progress bar shown at the top of every onboarding page. Copper-fill
// on current and completed steps, hairline outline on future steps.

import { COPPER, COPPER_BORDER } from '../lib/theme.ts';

interface Props {
  /** 1-indexed current step. */
  step: number;
  /** Total number of steps (defaults to 4 — name/belt/first-session/done). */
  total?: number;
}

export default function OnboardingProgress({ step, total = 4 }: Props) {
  return (
    <div
      role="progressbar"
      aria-valuenow={step}
      aria-valuemin={1}
      aria-valuemax={total}
      style={{
        display: 'flex', justifyContent: 'center', gap: 8,
        padding: '10px 0 18px',
      }}
    >
      {Array.from({ length: total }).map((_, idx) => {
        const filled = idx + 1 <= step;
        return (
          <span
            key={idx}
            aria-hidden
            style={{
              width: 7, height: 7, borderRadius: '50%',
              backgroundColor: filled ? COPPER : 'transparent',
              border: `1px solid ${filled ? COPPER : COPPER_BORDER}`,
              boxShadow: filled ? `0 0 6px ${COPPER}66` : 'none',
              transition: 'background-color 220ms ease, box-shadow 220ms ease',
            }}
          />
        );
      })}
    </div>
  );
}
