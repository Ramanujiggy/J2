// Transcript → technique/partner chips for the Capture Composer. Chips are
// CONFIRMATIONS the user taps to keep, so precision beats recall: matching is
// case-insensitive whole-phrase with word boundaries. LONGEST MATCH WINS — a
// text span already consumed by one match can never fire another chip (e.g.
// "reverse de la riva" fires only Reverse De La Riva, never De La Riva too).
// Canonical positions match on name + aliases (mig 012 lexicon); when a
// canonical fires, its name AND all its aliases are recorded as taken, so a
// same-named user tag never also fires — even if the canonical matched via
// an alias rather than its name. The stored id for a canonical hit is the
// stable UUID (TagPicker convention).

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

interface Span {
  start: number;
  end: number;
}

function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

type Candidate =
  | { kind: 'canonical'; phrase: string; canonical: CanonicalPosition }
  | { kind: 'user_tag'; phrase: string; userTag: UserTag };

export function extractChips(
  text: string,
  userTags: UserTag[],
  canonicals: CanonicalPosition[],
  pastPartners: string[],
): ExtractedChip[] {
  const lower = text.toLowerCase();
  if (!lower.trim()) return [];

  // One candidate per phrase: canonicals contribute name + every alias
  // (all pointing at the same entity); user tags contribute their name.
  const candidates: Candidate[] = [];
  for (const c of canonicals) {
    for (const phrase of [c.name, ...(c.aliases ?? [])]) {
      candidates.push({ kind: 'canonical', phrase, canonical: c });
    }
  }
  for (const t of userTags) {
    candidates.push({ kind: 'user_tag', phrase: t.name, userTag: t });
  }

  // Longest phrase wins; ties favor canonicals over user tags.
  candidates.sort((a, b) => {
    const lenDiff = b.phrase.length - a.phrase.length;
    if (lenDiff !== 0) return lenDiff;
    if (a.kind !== b.kind) return a.kind === 'canonical' ? -1 : 1;
    return 0;
  });

  const consumed: Span[] = [];
  const takenNames = new Set<string>();
  const emittedCanonicalIds = new Set<string>();
  const out: ExtractedChip[] = [];

  for (const cand of candidates) {
    const p = cand.phrase.trim();
    if (p.length < 2) continue;
    if (cand.kind === 'user_tag' && takenNames.has(cand.userTag.name.toLowerCase())) continue;

    const re = new RegExp(`(^|[^a-z0-9])(${escapeRegex(p.toLowerCase())})($|[^a-z0-9])`);
    const m = re.exec(lower);
    if (!m) continue;

    const start = m.index + m[1]!.length;
    const span: Span = { start, end: start + m[2]!.length };
    if (consumed.some((s) => overlaps(s, span))) continue;
    consumed.push(span);

    if (cand.kind === 'canonical') {
      const c = cand.canonical;
      if (emittedCanonicalIds.has(c.id)) continue; // matched via a second phrase — one chip only
      emittedCanonicalIds.add(c.id);
      takenNames.add(c.name.toLowerCase());
      for (const a of c.aliases ?? []) takenNames.add(a.toLowerCase());
      out.push({ kind: 'canonical', id: c.id, name: c.name, pillar: c.parent_pillar });
    } else {
      const t = cand.userTag;
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
