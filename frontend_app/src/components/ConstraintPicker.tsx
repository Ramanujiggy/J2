// ConstraintPicker — multi-select autocomplete across two libraries:
//   1. Canonical constraints — curated global vocabulary (read-only to users)
//   2. User constraints — the user's private custom additions
//
// Mirrors TagPicker. Three substantive differences (per the Refero research
// pass at 2026-04-27-constraints-library-and-roulette-toggle-refero.md):
//   - parent_pillar is OPTIONAL (some constraints span multiple pillars,
//     e.g., "no grips" affects standup + passing + guard).
//   - Default max-selected is 1 (CLA sessions usually have one rule mod).
//   - Chip text wraps for sentence-length constraint names.
//
// The "yours" badge convention from TagPicker is reused verbatim — same
// visual primitive, validated by Raycast's `Beta` badge pattern.
//
// Selection emits as two parallel arrays so the parent form can send them
// to the two DB columns they belong in (canonical_constraint_ids + user_constraint_ids).

import { useState, useMemo, useRef } from 'react';
import { COPPER, SURFACE_2, SURFACE_3, TEXT_BODY, TEXT_SECONDARY, TEXT_HINT } from '../lib/theme.ts';
import { vibrate } from '../lib/haptics.ts';
import { useUserConstraints } from '../hooks/useUserConstraints.ts';
import { useCanonicalConstraints } from '../hooks/useCanonicalConstraints.ts';
import type { CanonicalConstraint, UserConstraint, Pillar } from '../types/api.ts';

interface Props {
  selectedUserConstraintIds: string[];
  selectedCanonicalConstraintIds: string[];
  /** Called with both ID arrays whenever selection changes. */
  onChange: (userIds: string[], canonicalIds: string[]) => void;
  /** Optional pillar — used as a default for newly-created user constraints
   *  and to gently rank canonical matches. NOT required (constraints can be
   *  cross-pillar). */
  currentPillar?: Pillar | null;
  /** Maximum total constraints selectable across both libraries. Default 1
   *  per the research recommendation — CLA sessions usually have a single
   *  rule modification. Override to allow more. */
  maxSelected?: number;
  /** Optional initial query string — used by the Rep Roulette flow to seed
   *  the typeahead with the suggested constraint name. The user still has
   *  to commit (Enter / tap match / tap Add). */
  defaultQuery?: string;
}

const PILLAR_LABELS: Record<Pillar, string> = {
  standup: 'Stand-up',
  passing: 'Passing',
  pins: 'Pins',
  submissions: 'Subs',
  guard: 'Guard',
};

type CanonicalRow = { kind: 'canonical'; id: string; name: string; parent_pillar: Pillar | null; aliases: string[] };
type UserRow      = { kind: 'user';      id: string; name: string; parent_pillar: Pillar | null; aliases: string[] };
type Row = CanonicalRow | UserRow;

function matches(query: string, row: { name: string; aliases: string[] }): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (row.name.toLowerCase().includes(q)) return true;
  return row.aliases.some(a => a.toLowerCase().includes(q));
}

export default function ConstraintPicker({
  selectedUserConstraintIds,
  selectedCanonicalConstraintIds,
  onChange,
  currentPillar,
  maxSelected = 1,
  defaultQuery,
}: Props) {
  const { constraints: userConstraints, loading: userLoading, error: userError, createConstraint } = useUserConstraints();
  const { constraints: canonical, loading: canonicalLoading, error: canonicalError } = useCanonicalConstraints();

  // Seed the query from defaultQuery on first mount only — subsequent changes
  // to the prop are ignored (the user has already typed).
  const [query, setQuery] = useState(defaultQuery ?? '');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loading = userLoading || canonicalLoading;
  const error = userError ?? canonicalError;

  const userById = useMemo(() => new Map(userConstraints.map(c => [c.id, c])), [userConstraints]);
  const canonicalById = useMemo(() => new Map(canonical.map(c => [c.id, c])), [canonical]);

  const selectedUser: UserConstraint[] = selectedUserConstraintIds
    .map(id => userById.get(id))
    .filter((c): c is UserConstraint => !!c);
  const selectedCanonical: CanonicalConstraint[] = selectedCanonicalConstraintIds
    .map(id => canonicalById.get(id))
    .filter((c): c is CanonicalConstraint => !!c);

  // Search — canonical first, then user. Within canonical, prefer rows whose
  // parent_pillar matches `currentPillar` (or NULL = cross-pillar) when a pillar
  // is provided; otherwise pure alphabetical via the data layer.
  const trimmed = query.trim();
  const filtered = useMemo<Row[]>(() => {
    if (!trimmed) return [];
    const canonicalRanked = canonical
      .filter(c => !selectedCanonicalConstraintIds.includes(c.id))
      .filter(c => matches(trimmed, { name: c.name, aliases: c.aliases }));
    // Stable sort: pillar-match first when currentPillar is set.
    if (currentPillar) {
      canonicalRanked.sort((a, b) => {
        const aPriority = a.parent_pillar === currentPillar ? 0 : a.parent_pillar === null ? 1 : 2;
        const bPriority = b.parent_pillar === currentPillar ? 0 : b.parent_pillar === null ? 1 : 2;
        return aPriority - bPriority;
      });
    }
    const canonicalMatches: CanonicalRow[] = canonicalRanked.map(c => ({
      kind: 'canonical', id: c.id, name: c.name, parent_pillar: c.parent_pillar, aliases: c.aliases,
    }));

    const userMatches: UserRow[] = userConstraints
      .filter(c => !selectedUserConstraintIds.includes(c.id))
      .filter(c => matches(trimmed, { name: c.name, aliases: c.aliases }))
      .map(c => ({ kind: 'user', id: c.id, name: c.name, parent_pillar: c.parent_pillar, aliases: c.aliases }));

    return [...canonicalMatches, ...userMatches].slice(0, 8);
  }, [trimmed, canonical, userConstraints, selectedCanonicalConstraintIds, selectedUserConstraintIds, currentPillar]);

  const lowered = trimmed.toLowerCase();
  const exactMatch = useMemo(() => {
    if (!trimmed) return null;
    for (const c of canonical) if (c.name.toLowerCase() === lowered) return true;
    for (const c of userConstraints) if (c.name.toLowerCase() === lowered) return true;
    return false;
  }, [trimmed, lowered, canonical, userConstraints]);

  const totalSelected = selectedUserConstraintIds.length + selectedCanonicalConstraintIds.length;
  const atLimit = totalSelected >= maxSelected;
  // No `currentPillar` requirement for create — constraints can be cross-pillar.
  const canCreate = trimmed.length >= 1 && trimmed.length <= 100 && !exactMatch && !atLimit;

  const selectRow = (row: Row) => {
    if (atLimit) return;
    vibrate(8);
    if (row.kind === 'canonical') {
      onChange(selectedUserConstraintIds, [...selectedCanonicalConstraintIds, row.id]);
    } else {
      onChange([...selectedUserConstraintIds, row.id], selectedCanonicalConstraintIds);
    }
    setQuery('');
    inputRef.current?.focus();
  };

  const removeUser = (id: string) => {
    vibrate(6);
    onChange(selectedUserConstraintIds.filter(x => x !== id), selectedCanonicalConstraintIds);
    inputRef.current?.focus();
  };
  const removeCanonical = (id: string) => {
    vibrate(6);
    onChange(selectedUserConstraintIds, selectedCanonicalConstraintIds.filter(x => x !== id));
    inputRef.current?.focus();
  };

  const create = async () => {
    if (!canCreate) return;
    setCreating(true);
    const constraint = await createConstraint({ name: trimmed, parent_pillar: currentPillar ?? null });
    setCreating(false);
    if (constraint) {
      onChange([...selectedUserConstraintIds, constraint.id], selectedCanonicalConstraintIds);
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
      if (selectedUserConstraintIds.length > 0) {
        removeUser(selectedUserConstraintIds[selectedUserConstraintIds.length - 1]!);
      } else if (selectedCanonicalConstraintIds.length > 0) {
        removeCanonical(selectedCanonicalConstraintIds[selectedCanonicalConstraintIds.length - 1]!);
      }
    }
  };

  return (
    <div>
      {/* Selected chips — sentence-length names wrap to multiple lines. */}
      {(selectedCanonical.length > 0 || selectedUser.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedCanonical.map(c => (
            <button
              key={`c-${c.id}`}
              type="button"
              onClick={() => removeCanonical(c.id)}
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors touch-manipulation j2-press inline-flex items-center gap-1.5 max-w-full"
              style={{ backgroundColor: COPPER, color: '#fff', textAlign: 'left' }}
              title={`${c.name}${c.parent_pillar ? ` → ${PILLAR_LABELS[c.parent_pillar]}` : ''} (tap to remove)`}
            >
              <span style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{c.name}</span>
              <span style={{ color: TEXT_SECONDARY, fontSize: 12, flexShrink: 0 }}>×</span>
            </button>
          ))}
          {selectedUser.map(c => (
            <button
              key={`u-${c.id}`}
              type="button"
              onClick={() => removeUser(c.id)}
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors touch-manipulation j2-press inline-flex items-center gap-1.5 max-w-full"
              style={{ backgroundColor: COPPER, color: '#fff', textAlign: 'left' }}
              title={`${c.name}${c.parent_pillar ? ` → ${PILLAR_LABELS[c.parent_pillar]}` : ''} (tap to remove)`}
            >
              <span style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{c.name}</span>
              <span style={{ color: TEXT_SECONDARY, fontSize: 12, flexShrink: 0 }}>×</span>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value.slice(0, 100))}
        onKeyDown={handleKey}
        disabled={atLimit}
        placeholder={
          atLimit
            ? maxSelected === 1 ? 'One constraint set' : `Max ${maxSelected} constraints`
            : loading
              ? 'Loading library…'
              : 'e.g. only attack from closed guard'
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
              <span className="text-sm flex items-center gap-2" style={{ color: TEXT_BODY }}>
                <span style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.name}</span>
                {row.kind === 'user' && (
                  <span
                    className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ color: 'rgba(196,145,95,0.65)', backgroundColor: 'rgba(196,145,95,0.08)' }}
                  >
                    yours
                  </span>
                )}
              </span>
              {row.parent_pillar && (
                <span className="text-[10px] uppercase tracking-wider flex-shrink-0 ml-2" style={{ color: TEXT_HINT }}>
                  {PILLAR_LABELS[row.parent_pillar]}
                </span>
              )}
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
              <span className="text-[10px] uppercase tracking-wider flex-shrink-0 ml-2" style={{ color: TEXT_HINT }}>
                {currentPillar ? `→ ${PILLAR_LABELS[currentPillar]} · yours` : '→ yours'}
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
