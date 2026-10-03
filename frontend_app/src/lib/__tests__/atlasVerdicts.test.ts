import { describe, it, expect } from 'vitest';
import {
  overlayVerdict, byWeekVerdict, ghostVerdict, pillarShares, hoursPerPillar,
} from '../atlasVerdicts.ts';
import type { PillarDistribution, SessionSummary } from '../../types/api.ts';

const dist = (over: Partial<PillarDistribution>): PillarDistribution => ({
  standup: 0, passing: 0, pins: 0, submissions: 0, guard: 0, ...over,
});

/** n sessions all weighted to one pillar. */
const stack = (n: number, over: Partial<PillarDistribution>) =>
  Array.from({ length: n }, () => dist(over));

describe('pillarShares', () => {
  it('normalises to fractions summing to one, largest first', () => {
    const shares = pillarShares([dist({ guard: 3, passing: 1 })]);
    expect(shares[0]!.pillar).toBe('guard');
    expect(shares[0]!.share).toBeCloseTo(0.75);
    expect(shares.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1);
  });
});

describe('overlayVerdict', () => {
  it('says nothing has stacked when there are no sessions', () => {
    const v = overlayVerdict([], 0);
    expect(v.emphasis).toMatch(/arrives with the sessions/);
  });

  it('refuses to call a game below the confidence floor', () => {
    const v = overlayVerdict(stack(5, { guard: 1 }), 5);
    expect(v.emphasis).toBe('Too early to call it a game');
  });

  it('names the heaviest pillar once there is enough history', () => {
    const v = overlayVerdict(stack(30, { submissions: 1 }), 30);
    expect(v.emphasis).toBe('Subs has carried the most weight');
    expect(v.lead).toBe('Thirty sessions, one shape.');
  });

  it('only puts a share in words when the share is actually large', () => {
    // Five pillars evenly weighted — 20% each, no headline fraction.
    const even = stack(30, { standup: 1, passing: 1, pins: 1, submissions: 1, guard: 1 });
    expect(overlayVerdict(even, 30).tail).toBe('.');

    const lopsided = stack(30, { guard: 4, passing: 1 });
    expect(overlayVerdict(lopsided, 30).tail).toMatch(/nearly half/);
  });
});

describe('byWeekVerdict', () => {
  it('declines to judge fewer than six weeks', () => {
    const v = byWeekVerdict([stack(2, { guard: 1 }), stack(2, { guard: 1 })]);
    expect(v.emphasis).toMatch(/Not enough weeks/);
  });

  it('reports a steady shape when the weeks agree', () => {
    const weeks = Array.from({ length: 10 }, () => stack(3, { guard: 3, passing: 1 }));
    const v = byWeekVerdict(weeks);
    expect(v.emphasis).toMatch(/holds week to week|steadies later on/);
  });

  it('reports volatility when every week has a different leader', () => {
    const weeks = [
      stack(3, { guard: 1 }), stack(3, { passing: 1 }), stack(3, { pins: 1 }),
      stack(3, { standup: 1 }), stack(3, { submissions: 1 }), stack(3, { guard: 1 }),
      stack(3, { passing: 1 }), stack(3, { pins: 1 }),
    ];
    const v = byWeekVerdict(weeks);
    expect(v.emphasis).toBe('No two weeks look alike yet');
  });

  it('counts only weeks that actually have sessions', () => {
    const weeks = [stack(2, { guard: 1 }), [], stack(2, { guard: 1 })];
    expect(byWeekVerdict(weeks).lead).toBe('2 weeks on the mat.');
  });
});

describe('ghostVerdict', () => {
  it('says there is nothing to compare when the past year is empty', () => {
    expect(ghostVerdict(stack(10, { guard: 1 }), [], '2023').emphasis).toMatch(/full year behind you/);
  });

  it('names the pillars that grew', () => {
    const v = ghostVerdict(stack(10, { guard: 1 }), stack(10, { passing: 1 }), '2023');
    expect(v.emphasis).toContain('Guard');
    expect(v.tail).toMatch(/passing year is over/);
  });

  it('says the shape barely moved when it barely moved', () => {
    const same = { guard: 3, passing: 1 };
    const v = ghostVerdict(stack(10, same), stack(10, same), '2023');
    expect(v.emphasis).toBe('your shape has barely moved');
  });
});

describe('hoursPerPillar', () => {
  const session = (duration: number, d: Partial<PillarDistribution> | null): SessionSummary => ({
    id: 's', date: '2026-01-01', duration, gi_nogi: 'gi', session_type: 'class',
    intensity: 3, pillar_distribution: d ? dist(d) : null,
  } as SessionSummary);

  it('splits a session across pillars by its distribution', () => {
    const rows = hoursPerPillar([session(60, { guard: 3, passing: 1 })]);
    const guard = rows.find(r => r.pillar === 'guard')!;
    const passing = rows.find(r => r.pillar === 'passing')!;
    expect(guard.hours).toBeCloseTo(0.75);
    expect(passing.hours).toBeCloseTo(0.25);
  });

  it('does not invent a shape for a session with no distribution', () => {
    const rows = hoursPerPillar([session(60, null)]);
    expect(rows.every(r => r.hours === 0)).toBe(true);
  });

  it('scales the bars against the heaviest pillar', () => {
    const rows = hoursPerPillar([session(60, { guard: 3, passing: 1 })]);
    expect(rows[0]!.pct).toBe(100);
  });
});
