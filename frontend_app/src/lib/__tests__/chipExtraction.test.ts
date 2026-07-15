import { describe, it, expect } from 'vitest';
import { extractChips } from '../chipExtraction.ts';
import type { UserTag, CanonicalPosition } from '../../types/api.ts';

const ut = (over: Partial<UserTag>): UserTag =>
  ({ id: 'u1', name: 'Arm Weave', parent_pillar: 'passing', ...over } as UserTag);
const cp = (over: Partial<CanonicalPosition>): CanonicalPosition =>
  ({ id: 'c1', name: 'De La Riva', parent_pillar: 'guard', aliases: ['DLR', 'de la riva guard'], created_at: '', ...over } as CanonicalPosition);

describe('extractChips', () => {
  it('finds a user tag by name, case-insensitive', () => {
    const chips = extractChips('kept hunting the arm weave pass', [ut({})], [], []);
    expect(chips).toEqual([{ kind: 'user_tag', id: 'u1', name: 'Arm Weave', pillar: 'passing' }]);
  });

  it('finds a canonical position by alias', () => {
    const chips = extractChips('got swept from DLR early', [], [cp({})], []);
    expect(chips).toEqual([{ kind: 'canonical', id: 'c1', name: 'De La Riva', pillar: 'guard' }]);
  });

  it('dedupes when user tag and canonical share a name — canonical wins', () => {
    const chips = extractChips('worked de la riva', [ut({ name: 'De La Riva', parent_pillar: 'guard' })], [cp({})], []);
    expect(chips).toHaveLength(1);
    expect(chips[0]!.kind).toBe('canonical');
  });

  it('requires word boundaries — "bar" does not match inside "armbar"', () => {
    const chips = extractChips('finished an armbar', [ut({ name: 'Bar' })], [], []);
    expect(chips).toEqual([]);
  });

  it('detects past partners as partner chips', () => {
    const chips = extractChips('rolled with Marcus tonight', [], [], ['Marcus', 'Elena']);
    expect(chips).toEqual([{ kind: 'partner', id: null, name: 'Marcus', pillar: null }]);
  });

  it('returns [] for empty text', () => {
    expect(extractChips('', [ut({})], [cp({})], ['Marcus'])).toEqual([]);
  });

  it('longest match wins — "reverse de la riva" fires only Reverse De La Riva', () => {
    const rdlr = cp({ id: 'c2', name: 'Reverse De La Riva', aliases: ['RDLR'] });
    const chips = extractChips('got stuck in reverse de la riva', [], [cp({}), rdlr], []);
    expect(chips).toEqual([{ kind: 'canonical', id: 'c2', name: 'Reverse De La Riva', pillar: 'guard' }]);
  });

  it('canonical alias suppresses a same-named user tag', () => {
    const chips = extractChips('played DLR all night', [ut({ id: 'u9', name: 'DLR', parent_pillar: 'guard' })], [cp({})], []);
    expect(chips).toEqual([{ kind: 'canonical', id: 'c1', name: 'De La Riva', pillar: 'guard' }]);
  });
});
