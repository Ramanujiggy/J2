// TagPicker — multi-select autocomplete for the user's tag library.
// Shows selected tags as chips, with an input that autocompletes against the
// user's library and offers to create a new tag if no match exists.
// New tags inherit the current heading as their parent_pillar.

import { useState, useMemo, useRef } from 'react';
import { COPPER, SURFACE_2, SURFACE_3 } from '../lib/theme.ts';
import { vibrate } from '../lib/haptics.ts';
import { useUserTags } from '../hooks/useUserTags.ts';
import type { UserTag, Pillar } from '../types/api.ts';

interface Props {
  /** Currently selected tag IDs */
  selectedIds: string[];
  /** Called when the selection changes */
  onChange: (ids: string[]) => void;
  /** Current pillar — assigned as parent_pillar for newly created tags. Required to create. */
  currentPillar: Pillar | null;
  /** Maximum number of tags that can be selected (default 5) */
  maxSelected?: number;
}

const PILLAR_LABELS: Record<Pillar, string> = {
  standup: 'Stand-up',
  passing: 'Passing',
  pins: 'Pins',
  submissions: 'Subs',
  guard: 'Guard',
};

export default function TagPicker({ selectedIds, onChange, currentPillar, maxSelected = 5 }: Props) {
  const { tags, loading, createTag } = useUserTags();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Quick lookup: id → tag
  const tagsById = useMemo(() => {
    const m = new Map<string, UserTag>();
    tags.forEach(t => m.set(t.id, t));
    return m;
  }, [tags]);

  const selectedTags = selectedIds.map(id => tagsById.get(id)).filter((t): t is UserTag => !!t);

  // Filter library by query, exclude already-selected
  const trimmed = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!trimmed) return [];
    return tags
      .filter(t => !selectedIds.includes(t.id))
      .filter(t => t.name.toLowerCase().includes(trimmed))
      .slice(0, 6);
  }, [tags, trimmed, selectedIds]);

  const exactMatch = filtered.find(t => t.name.toLowerCase() === trimmed);
  const canCreate = trimmed.length >= 1 && trimmed.length <= 50 && !exactMatch && !!currentPillar;

  const atLimit = selectedIds.length >= maxSelected;

  const select = (id: string) => {
    if (atLimit) return;
    vibrate(8);
    onChange([...selectedIds, id]);
    setQuery('');
    inputRef.current?.focus();
  };

  const remove = (id: string) => {
    vibrate(6);
    onChange(selectedIds.filter(x => x !== id));
  };

  const create = async () => {
    if (!canCreate || !currentPillar) return;
    setCreating(true);
    const tag = await createTag({ name: query.trim(), parent_pillar: currentPillar });
    setCreating(false);
    if (tag) {
      onChange([...selectedIds, tag.id]);
      setQuery('');
      inputRef.current?.focus();
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered.length > 0) select(filtered[0].id);
      else if (canCreate) void create();
    } else if (e.key === 'Backspace' && query === '' && selectedIds.length > 0) {
      remove(selectedIds[selectedIds.length - 1]);
    }
  };

  return (
    <div>
      {/* Selected chips */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedTags.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => remove(t.id)}
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
              ? 'Loading tags…'
              : currentPillar
                ? 'Type to search or create…'
                : 'Pick a heading on the Prism first'
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
          {filtered.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => select(t.id)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left j2-press touch-manipulation"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{t.name}</span>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {PILLAR_LABELS[t.parent_pillar]}
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
                {creating ? 'Creating…' : `Create "${query.trim()}"`}
              </span>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                → {currentPillar ? PILLAR_LABELS[currentPillar] : ''}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Inline hint when no pillar yet */}
      {trimmed && !currentPillar && filtered.length === 0 && (
        <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.30)' }}>
          Tap a vertex on the Prism so we know where to file this tag.
        </p>
      )}
    </div>
  );
}
