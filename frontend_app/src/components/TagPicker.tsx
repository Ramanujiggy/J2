// TagPicker — multi-select autocomplete across two libraries:
//   1. Canonical positions — curated global vocabulary (read-only to users)
//   2. User tags — the user's private custom additions
//
// Search matches name + aliases, substring, case-insensitive. Canonical hits
// rank first. Creating a new tag (when nothing matches) drops into user_tags.
// Selection is emitted as two parallel arrays so the parent form can send them
// to the two DB columns they belong in (canonical_position_ids + user_tag_ids).

import { useState, useMemo, useRef } from 'react';
import { COPPER, SURFACE_2, SURFACE_3 } from '../lib/theme.ts';
import { vibrate } from '../lib/haptics.ts';
import { useUserTags } from '../hooks/useUserTags.ts';
import { useCanonicalPositions } from '../hooks/useCanonicalPositions.ts';
import type { UserTag, CanonicalPosition, Pillar } from '../types/api.ts';

interface Props {
  /** Selected user-tag UUIDs (private customs) */
  selectedUserTagIds: string[];
  /** Selected canonical-position UUIDs (shared library) */
  selectedCanonicalIds: string[];
  /** Called with both ID arrays whenever selection changes */
  onChange: (userTagIds: string[], canonicalIds: string[]) => void;
  /** Current pillar — assigned as parent_pillar for newly created user tags */
  currentPillar: Pillar | null;
  /** Maximum total tags selectable across both libraries (default 5) */
  maxSelected?: number;
}

const PILLAR_LABELS: Record<Pillar, string> = {
  standup: 'Stand-up',
  passing: 'Passing',
  pins: 'Pins',
  submissions: 'Subs',
  guard: 'Guard',
};

type CanonicalRow = { kind: 'canonical'; id: string; name: string; parent_pillar: Pillar; aliases: string[] };
type UserRow      = { kind: 'user';      id: string; name: string; parent_pillar: Pillar; aliases: string[] };
type Row = CanonicalRow | UserRow;

function matches(query: string, row: { name: string; aliases: string[] }): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (row.name.toLowerCase().includes(q)) return true;
  return row.aliases.some(a => a.toLowerCase().includes(q));
}

export default function TagPicker({
  selectedUserTagIds,
  selectedCanonicalIds,
  onChange,
  currentPillar,
  maxSelected = 5,
}: Props) {
  const { tags: userTags, loading: userLoading, error: userError, createTag } = useUserTags();
  const { positions: canonical, loading: canonicalLoading, error: canonicalError } = useCanonicalPositions();

  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loading = userLoading || canonicalLoading;
  const error = userError ?? canonicalError;

  // Quick lookups
  const userById = useMemo(() => new Map(userTags.map(t => [t.id, t])), [userTags]);
  const canonicalById = useMemo(() => new Map(canonical.map(p => [p.id, p])), [canonical]);

  const selectedUserTags: UserTag[] = selectedUserTagIds
    .map(id => userById.get(id))
    .filter((t): t is UserTag => !!t);
  const selectedCanonical: CanonicalPosition[] = selectedCanonicalIds
    .map(id => canonicalById.get(id))
    .filter((p): p is CanonicalPosition => !!p);

  // Search — canonical first, then user. Aliases matter.
  const trimmed = query.trim();
  const filtered = useMemo<Row[]>(() => {
    if (!trimmed) return [];
    const canonicalMatches: CanonicalRow[] = canonical
      .filter(p => !selectedCanonicalIds.includes(p.id))
      .filter(p => matches(trimmed, { name: p.name, aliases: p.aliases }))
      .map(p => ({ kind: 'canonical', id: p.id, name: p.name, parent_pillar: p.parent_pillar, aliases: p.aliases }));

    const userMatches: UserRow[] = userTags
      .filter(t => !selectedUserTagIds.includes(t.id))
      .filter(t => matches(trimmed, { name: t.name, aliases: t.aliases ?? [] }))
      .map(t => ({ kind: 'user', id: t.id, name: t.name, parent_pillar: t.parent_pillar, aliases: t.aliases ?? [] }));

    return [...canonicalMatches, ...userMatches].slice(0, 8);
  }, [trimmed, canonical, userTags, selectedCanonicalIds, selectedUserTagIds]);

  // Exact-name match (either library) blocks the Create affordance
  const lowered = trimmed.toLowerCase();
  const exactMatch = useMemo(() => {
    if (!trimmed) return null;
    for (const p of canonical) if (p.name.toLowerCase() === lowered) return true;
    for (const t of userTags) if (t.name.toLowerCase() === lowered) return true;
    return false;
  }, [trimmed, lowered, canonical, userTags]);

  const totalSelected = selectedUserTagIds.length + selectedCanonicalIds.length;
  const atLimit = totalSelected >= maxSelected;
  const canCreate = trimmed.length >= 1 && trimmed.length <= 50 && !exactMatch && !!currentPillar && !atLimit;

  const selectRow = (row: Row) => {
    if (atLimit) return;
    vibrate(8);
    if (row.kind === 'canonical') {
      onChange(selectedUserTagIds, [...selectedCanonicalIds, row.id]);
    } else {
      onChange([...selectedUserTagIds, row.id], selectedCanonicalIds);
    }
    setQuery('');
    inputRef.current?.focus();
  };

  const removeUser = (id: string) => {
    vibrate(6);
    onChange(selectedUserTagIds.filter(x => x !== id), selectedCanonicalIds);
    inputRef.current?.focus();
  };
  const removeCanonical = (id: string) => {
    vibrate(6);
    onChange(selectedUserTagIds, selectedCanonicalIds.filter(x => x !== id));
    inputRef.current?.focus();
  };

  const create = async () => {
    if (!canCreate || !currentPillar) return;
    setCreating(true);
    const tag = await createTag({ name: trimmed, parent_pillar: currentPillar });
    setCreating(false);
    if (tag) {
      onChange([...selectedUserTagIds, tag.id], selectedCanonicalIds);
      setQuery('');
      inputRef.current?.focus();
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0) selectRow(filtered[0]!);
      else if (canCreate) void create();
    } else if (e.key === 'Backspace' && query === '') {
      // Backspace with empty input removes the most recently added chip.
      // We remove user tags first (they're appended after canonical visually).
      if (selectedUserTagIds.length > 0) {
        removeUser(selectedUserTagIds[selectedUserTagIds.length - 1]!);
      } else if (selectedCanonicalIds.length > 0) {
        removeCanonical(selectedCanonicalIds[selectedCanonicalIds.length - 1]!);
      }
    }
  };

  return (
    <div>
      {/* Selected chips — canonical first, then user customs */}
      {(selectedCanonical.length > 0 || selectedUserTags.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedCanonical.map(p => (
            <button
              key={`c-${p.id}`}
              type="button"
              onClick={() => removeCanonical(p.id)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors touch-manipulation j2-press inline-flex items-center gap-1.5"
              style={{ backgroundColor: COPPER, color: '#fff' }}
              title={`${p.name} → ${PILLAR_LABELS[p.parent_pillar]} (tap to remove)`}
            >
              <span>{p.name}</span>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10 }}>
                {PILLAR_LABELS[p.parent_pillar]}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>×</span>
            </button>
          ))}
          {selectedUserTags.map(t => (
            <button
              key={`u-${t.id}`}
              type="button"
              onClick={() => removeUser(t.id)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors touch-manipulation j2-press inline-flex items-center gap-1.5"
              style={{ backgroundColor: COPPER, color: '#fff' }}
              title={`${t.name} → ${PILLAR_LABELS[t.parent_pillar]} (tap to remove)`}
            >
              <span>{t.name}</span>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10 }}>
                {PILLAR_LABELS[t.parent_pillar]}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>×</span>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value.slice(0, 50))}
        onKeyDown={handleKey}
        disabled={atLimit}
        placeholder={
          atLimit
            ? `Max ${maxSelected} tags`
            : loading
              ? 'Loading library…'
              : 'Search positions or type to add…'
        }
        className="w-full border rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors disabled:opacity-50"
        style={{ backgroundColor: SURFACE_3, borderColor: 'rgba(255,255,255,0.08)' }}
      />

      {/* Suggestions dropdown */}
      {trimmed && (filtered.length > 0 || canCreate) && (
        <div
          className="mt-1.5 rounded-xl overflow-hidden"
          style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {filtered.map(row => (
            <button
              key={`${row.kind}-${row.id}`}
              type="button"
              onClick={() => selectRow(row)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left j2-press touch-manipulation"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              <span className="text-sm flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {row.name}
                {row.kind === 'user' && (
                  <span
                    className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded"
                    style={{ color: 'rgba(196,145,95,0.65)', backgroundColor: 'rgba(196,145,95,0.08)' }}
                  >
                    yours
                  </span>
                )}
              </span>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {PILLAR_LABELS[row.parent_pillar]}
              </span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => void create()}
              disabled={creating}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left j2-press touch-manipulation disabled:opacity-50"
            >
              <span className="text-sm" style={{ color: COPPER }}>
                {creating ? 'Creating…' : `Add "${trimmed}"`}
              </span>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                → {currentPillar ? PILLAR_LABELS[currentPillar] : ''} · yours
              </span>
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs mt-1.5" style={{ color: 'rgba(218,90,70,0.85)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
