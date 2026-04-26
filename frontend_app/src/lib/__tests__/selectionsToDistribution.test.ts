import { describe, it, expect } from 'vitest';
import { selectionsToDistribution, type ChipSelection } from '../selectionsToDistribution.ts';

describe('selectionsToDistribution', () => {
  it('returns null for empty selections', () => {
    expect(selectionsToDistribution([])).toBeNull();
  });

  it('3 selected, 1 primary, 0 deep-work → (0.60, 0.20, 0.20)', () => {
    const sel: ChipSelection[] = [
      { pillar: 'guard',       primary: true,  deep_work: false },
      { pillar: 'submissions', primary: false, deep_work: false },
      { pillar: 'standup',     primary: false, deep_work: false },
    ];
    expect(selectionsToDistribution(sel)).toEqual({
      guard: 0.6, submissions: 0.2, standup: 0.2,
    });
  });

  it('1 primary+deep, 1 deep-only, 1 selected-only → (0.5714, 0.2857, 0.1429)', () => {
    const sel: ChipSelection[] = [
      { pillar: 'guard',       primary: true,  deep_work: true  },
      { pillar: 'passing',     primary: false, deep_work: true  },
      { pillar: 'submissions', primary: false, deep_work: false },
    ];
    expect(selectionsToDistribution(sel)).toEqual({
      guard: 0.5714, passing: 0.2857, submissions: 0.1429,
    });
  });

  it('3 selected with no flags → even split (0.3333 each)', () => {
    const sel: ChipSelection[] = [
      { pillar: 'guard',       primary: false, deep_work: false },
      { pillar: 'passing',     primary: false, deep_work: false },
      { pillar: 'submissions', primary: false, deep_work: false },
    ];
    expect(selectionsToDistribution(sel)).toEqual({
      guard: 0.3333, passing: 0.3333, submissions: 0.3333,
    });
  });

  it('single selection collapses to 100% on that pillar', () => {
    expect(selectionsToDistribution([
      { pillar: 'guard', primary: false, deep_work: false },
    ])).toEqual({ guard: 1 });

    expect(selectionsToDistribution([
      { pillar: 'guard', primary: true, deep_work: true },
    ])).toEqual({ guard: 1 });
  });

  it('all five chips selected, none primed → even fifths', () => {
    const sel: ChipSelection[] = (['standup','passing','pins','submissions','guard'] as const)
      .map(p => ({ pillar: p, primary: false, deep_work: false }));
    expect(selectionsToDistribution(sel)).toEqual({
      standup: 0.2, passing: 0.2, pins: 0.2, submissions: 0.2, guard: 0.2,
    });
  });

  it('result keys always sum to ~1.0 (within float tolerance)', () => {
    const sel: ChipSelection[] = [
      { pillar: 'guard',       primary: true,  deep_work: false },
      { pillar: 'passing',     primary: false, deep_work: true  },
      { pillar: 'pins',        primary: false, deep_work: false },
      { pillar: 'submissions', primary: false, deep_work: true  },
    ];
    const dist = selectionsToDistribution(sel)!;
    const sum = Object.values(dist).reduce((a, b) => (a ?? 0) + (b ?? 0), 0)!;
    expect(sum).toBeCloseTo(1.0, 3);
  });

  it('duplicate pillars accumulate points (defensive — UI should prevent)', () => {
    const sel: ChipSelection[] = [
      { pillar: 'guard', primary: false, deep_work: false },
      { pillar: 'guard', primary: true,  deep_work: false },
    ];
    // guard accumulates 1 + 3 = 4 points; sole pillar → 100%.
    expect(selectionsToDistribution(sel)).toEqual({ guard: 1 });
  });
});
