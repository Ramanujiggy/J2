import { describe, it, expect } from 'vitest';
import { timeAtBeltLabel } from '../belt.ts';

const on = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('timeAtBeltLabel', () => {
  it('says under a month for a fresh promotion', () => {
    expect(timeAtBeltLabel('2026-03-14', on(2026, 4, 13))).toBe('under a month at this belt');
  });
  it('counts whole calendar months', () => {
    expect(timeAtBeltLabel('2026-03-14', on(2026, 4, 14))).toBe('1 month at this belt');
    expect(timeAtBeltLabel('2026-01-01', on(2026, 10, 20))).toBe('9 months at this belt');
  });
  it('folds months into years', () => {
    expect(timeAtBeltLabel('2025-03-01', on(2026, 10, 20))).toBe('1 year, 7 months at this belt');
    expect(timeAtBeltLabel('2024-10-20', on(2026, 10, 20))).toBe('2 years at this belt');
  });
  it('reads a full timestamp by its date', () => {
    expect(timeAtBeltLabel('2025-10-20T00:00:00.000Z', on(2026, 10, 20))).toBe('1 year at this belt');
  });
});
