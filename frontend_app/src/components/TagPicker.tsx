// TagPicker — multi-select autocomplete across two libraries:
//   1. Canonical positions — curated global vocabulary (read-only to users)
//   2. User tags — the user's private custom additions
//
// Behaviour (Technique Library v1, migration 027):
//
// Empty query + a current pillar: dropdown pre-populates with that pillar's
// techniques (user_tags + canonical, deduped by name, user wins). This is the
// soft "two-tier cascade" — user picks Guard, sees DLR / Half Guard / Spider
// without typing.
//
// Typed query: search across all pillars (substring + alias matches), but
// rank current-pillar matches first. Soft gate, not hard — a class might
// have crossed pillars and the user can still find moves outside the current
// pillar by typing.
//
// On selection: if the user picks a canonical row, silently fork it into a
// personal user_tag via `selectCanonicalAsUserTag()` and add the resulting
// user_tag id to `selectedUserTagIds`. The user never sees this — DLR appears
// every time, but after first pick it's their DLR (with affinity / resonance
// hooks of their own). Idempotent at the server.

import { useState, useMemo, useRef } from 'react';
import { COPPER, SURFACE_2, SURFACE_3, TEXT_BODY, TEXT_SECONDARY, TEXT_TERTIARY, TEXT_HINT } from '../lib/theme.ts';
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
  const { tags: userTags, loading: userLoading, error: userError, createTag, selectCanonicalAsUserTag } = useUserTags();
  const { positions: canonical, loading: canonicalLoading, error: canonicalError } = useCanonicalPositions();

  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [focused, setFocused] = useState(false);
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

  // Search — match against name + aliases. Migration 027 ranking: current-pillar
  // matches always come first (soft cascade); within each tier, user_tags rank
  // before canonicals (so a tag the user has already engaged with — and may
  // carry an affinity badge — surfaces above an untouched canonical).
  const trimmed = query.trim();
  const filtered = useMemo<Row[]>(() => {
    if (!trimmed) return [];

    // Build candidate rows from each library, exclude already-selected ids,
    // and dedupe by lowercase name (user_tag wins) so a forked canonical
    // doesn't show twice in the dropdown.
    const userMatches: UserRow[] = userTags
      .filter(t => !selectedUserTagIds.includes(t.id))
      .filter(t => matches(trimmed, { name: t.name, aliases: t.aliases ?? [] }))
      .map(t => ({ kind: 'user', id: t.id, name: t.name, parent_pillar: t.parent_pillar, aliases: t.aliases ?? [] }));

    const userNames = new Set(userMatches.map(r => r.name.toLowerCase()));

    const canonicalMatches: CanonicalRow[] = canonical
      .filter(p => !selectedCanonicalIds.includes(p.id))
      .filter(p => !userNames.has(p.name.toLowerCase()))
      .filter(p => matches(trimmed, { name: p.name, aliases: p.aliases }))
      .map(p => ({ kind: 'canonical', id: p.id, name: p.name, parent_pillar: p.parent_pillar, aliases: p.aliases }));

    const all: Row[] = [...userMatches, ...canonicalMatches];

    // Rank current-pillar matches first; preserve user-before-canonical within tiers.
    if (currentPillar) {
      all.sort((a, b) => {
        const aScore = (a.parent_pillar === currentPillar ? 0 : 2) + (a.kind === 'user' ? 0 : 1);
        const bScore = (b.parent_pillar === currentPillar ? 0 : 2) + (b.kind === 'user' ? 0 : 1);
        return aScore - bScore;
      });
    }

    return all.slice(0, 8);
  }, [trimmed, canonical, userTags, selectedCanonicalIds, selectedUserTagIds, currentPillar]);

  // Empty-state suggestions when the input is focused, no query has been typed,
  // and a pillar is active. This is the visible "two-tier cascade" — user picks
  // Guard, sees Guard's techniques laid out without typing. Migration 027.
  const emptyStateRows = useMemo<Row[]>(() => {
    if (!currentPillar) return [];

    // User tags in this pillar (excluding already-selected).
    const userInPillar = userTags
      .filter(t => t.parent_pillar === currentPillar)
      .filter(t => !selectedUserTagIds.includes(t.id));
    const userNames = new Set(userInPillar.map(t => t.name.toLowerCase()));

    // Canonical in this pillar — exclude any name the user has already forked
    // to keep the list deduped.
    const canonicalInPillar = canonical
      .filter(p => p.parent_pillar === currentPillar)
      .filter(p => !selectedCanonicalIds.includes(p.id))
      .filter(p => !userNames.has(p.name.toLowerCase()));

    const userRows: UserRow[] = userInPillar
      .map(t => ({ kind: 'user' as const, id: t.id, name: t.name, parent_pillar: t.parent_pillar, aliases: t.aliases ?? [] }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const canonicalRows: CanonicalRow[] = canonicalInPillar
      .map(p => ({ kind: 'canonical' as const, id: p.id, name: p.name, parent_pillar: p.parent_pillar, aliases: p.aliases }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return [...userRows, ...canonicalRows].slice(0, 8);
  }, [currentPillar, userTags, canonical, selectedUserTagIds, selectedCanonicalIds]);

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

  const selectRow = async (row: Row) => {
    if (atLimit) return;
    vibrate(8);
    if (row.kind === 'canonical') {
      // Silently fork the canonical into the user's library so any future
      // personal data (affinity / resonance) has a row to land on. Idempotent
      // at the server. The returned id is a user_tag id; we drop it into
      // selectedUserTagIds, NOT selectedCanonicalIds. Migration 027.
      const newId = await selectCanonicalAsUserTag(row.id);
      if (newId) {
        onChange([...selectedUserTagIds, newId], selectedCanonicalIds);
      }
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
      if (filtered.length > 0) void selectRow(filtered[0]!);
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
              <span style={{ color: TEXT_TERTIARY, fontSize: 10 }}>
                {PILLAR_LABELS[p.parent_pillar]}
              </span>
              <span style={{ color: TEXT_SECONDARY, fontSize: 11 }}>×</span>
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
              {/* Affinity badge — small inline glyph when the user has expressed
                  judgement on this technique (migration 027). Reads as a
                  reminder of "your relationship with this move" mid-form. */}
              {t.affinity === 'go_to'    && <span aria-label="go-to"  style={{ fontSize: 10 }}>★</span>}
              {t.affinity === 'learning' && <span aria-label="learning" style={{ fontSize: 10 }}>◐</span>}
              {t.affinity === 'shelved'  && <span aria-label="shelved"  style={{ fontSize: 10, opacity: 0.7 }}>◌</span>}
              <span>{t.name}</span>
              <span style={{ color: TEXT_TERTIARY, fontSize: 10 }}>
                {PILLAR_LABELS[t.parent_pillar]}
              </span>
              <span style={{ color: TEXT_SECONDARY, fontSize: 11 }}>×</span>
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
        onFocus={() => setFocused(true)}
        // Delay closing so a tap on a dropdown row registers before unmount.
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        disabled={atLimit}
        placeholder={
          atLimit
            ? `Max ${maxSelected} techniques`
            : loading
              ? 'Loading library…'
              : currentPillar
                ? `Search ${PILLAR_LABELS[currentPillar].toLowerCase()} techniques or type to add…`
                : 'Search techniques or type to add…'
        }
        className="w-full border rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors disabled:opacity-50"
        style={{ backgroundColor: SURFACE_3, borderColor: 'rgba(255,255,255,0.08)' }}
      />

      {/* Empty-state dropdown — soft pillar suggestions when focused with no
          query typed. Shows up to 8 techniques in the current pillar. The
          visible "two-tier cascade" (migration 027). */}
      {focused && !trimmed && emptyStateRows.length > 0 && currentPillar && !atLimit && (
        <div
          className="mt-1.5 rounded-xl overflow-hidden"
          style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div
            className="px-4 py-1.5 text-[10px] uppercase tracking-widest"
            style={{ color: 'rgba(196,145,95,0.65)', backgroundColor: 'rgba(196,145,95,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
          >
            ◇ {PILLAR_LABELS[currentPillar]} techniques
          </div>
          {emptyStateRows.map(row => {
            const userRow = row.kind === 'user' ? userById.get(row.id) : null;
            const affinity = userRow?.affinity;
            return (
              <button
                key={`empty-${row.kind}-${row.id}`}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => void selectRow(row)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left j2-press touch-manipulation"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              >
                <span className="text-sm flex items-center gap-2" style={{ color: TEXT_BODY }}>
                  {affinity === 'go_to'    && <span aria-label="go-to" style={{ fontSize: 11, color: COPPER }}>★</span>}
                  {affinity === 'learning' && <span aria-label="learning" style={{ fontSize: 11, color: 'rgba(196,145,95,0.65)' }}>◐</span>}
                  {affinity === 'shelved'  && <span aria-label="shelved" style={{ fontSize: 11, color: TEXT_HINT }}>◌</span>}
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
              </button>
            );
          })}
        </div>
      )}

      {/* Suggestions dropdown */}
      {trimmed && (filtered.length > 0 || canCreate) && (
        <div
          className="mt-1.5 rounded-xl overflow-hidden"
          style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {filtered.map(row => {
            const userRow = row.kind === 'user' ? userById.get(row.id) : null;
            const affinity = userRow?.affinity;
            return (
              <button
                key={`${row.kind}-${row.id}`}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => void selectRow(row)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left j2-press touch-manipulation"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              >
                <span className="text-sm flex items-center gap-2" style={{ color: TEXT_BODY }}>
                  {affinity === 'go_to'    && <span aria-label="go-to" style={{ fontSize: 11, color: COPPER }}>★</span>}
                  {affinity === 'learning' && <span aria-label="learning" style={{ fontSize: 11, color: 'rgba(196,145,95,0.65)' }}>◐</span>}
                  {affinity === 'shelved'  && <span aria-label="shelved" style={{ fontSize: 11, color: TEXT_HINT }}>◌</span>}
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
                <span className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_HINT }}>
                  {PILLAR_LABELS[row.parent_pillar]}
                </span>
              </button>
            );
          })}
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
              <span className="text-[10px] uppercase tracking-wider" style={{ color: TEXT_HINT }}>
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
