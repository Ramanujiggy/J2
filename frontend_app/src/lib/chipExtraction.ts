// Transcript → technique/partner chips for the Capture Composer. Chips are
// CONFIRMATIONS the user taps to keep, so precision beats recall: matching is
// case-insensitive whole-phrase with word boundaries. Canonical positions
// match on name + aliases (mig 012 lexicon); a canonical beats a same-named
// user tag so the stored id is the stable UUID (TagPicker convention).

import type { UserTag, CanonicalPosition, Pillar } from '../types/api.ts';

export interface ExtractedChip {
  kind: 'user_tag' | 'canonical' | 'partner';
  id: string | null;
  name: string;
  pillar: Pillar | null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsPhrase(haystackLower: string, phrase: string): boolean {
  const p = phrase.trim();
  if (p.length < 2) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(p.toLowerCase())}($|[^a-z0-9])`).test(haystackLower);
}

export function extractChips(
  text: string,
  userTags: UserTag[],
  canonicals: CanonicalPosition[],
  pastPartners: string[],
): ExtractedChip[] {
  const lower = text.toLowerCase();
  if (!lower.trim()) return [];

  const out: ExtractedChip[] = [];
  const takenNames = new Set<string>();

  // Canonicals first — they win same-name collisions.
  for (const c of canonicals) {
    const hit = containsPhrase(lower, c.name) || (c.aliases ?? []).some(a => containsPhrase(lower, a));
    if (hit && !takenNames.has(c.name.toLowerCase())) {
      takenNames.add(c.name.toLowerCase());
      out.push({ kind: 'canonical', id: c.id, name: c.name, pillar: c.parent_pillar });
    }
  }
  for (const t of userTags) {
    if (takenNames.has(t.name.toLowerCase())) continue;
    if (containsPhrase(lower, t.name)) {
      takenNames.add(t.name.toLowerCase());
      out.push({ kind: 'user_tag', id: t.id, name: t.name, pillar: t.parent_pillar });
    }
  }
  for (const p of [...new Set(pastPartners)]) {
    if (containsPhrase(lower, p)) {
      out.push({ kind: 'partner', id: null, name: p, pillar: null });
    }
  }
  return out;
}
