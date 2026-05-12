// PartnerInput — minimal freetext chip-input for "who you trained with."
//
// No library backing (unlike TagPicker / ConstraintPicker), no autocomplete.
// Just chips + an input. The shape mirrors TagPicker's chip strip + input
// rhythm so the form feels consistent.
//
// Future evolution: when the Journada 2.0 social layer arrives, these
// freetext strings can be lifted into a user_partners table with autocomplete
// off real partner records. Today: pure local strings on the session record.

import { useState, useRef } from 'react';
import { COPPER, SURFACE_3 } from '../lib/theme.ts';
import { vibrate } from '../lib/haptics.ts';

interface Props {
  partners: string[];
  onChange: (next: string[]) => void;
  maxSelected?: number;
}

const MAX_PARTNER_LENGTH = 60;

export default function PartnerInput({ partners, onChange, maxSelected = 5 }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const atLimit = partners.length >= maxSelected;

  const commit = (raw: string) => {
    const trimmed = raw.trim().slice(0, MAX_PARTNER_LENGTH);
    if (!trimmed) return;
    if (atLimit) return;
    // Dedupe case-insensitively; preserve first-seen casing.
    const lower = trimmed.toLowerCase();
    if (partners.some(p => p.toLowerCase() === lower)) {
      setQuery('');
      return;
    }
    vibrate(8);
    onChange([...partners, trimmed]);
    setQuery('');
    inputRef.current?.focus();
  };

  const remove = (index: number) => {
    vibrate(6);
    onChange(partners.filter((_, i) => i !== index));
    inputRef.current?.focus();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(query);
    } else if (e.key === 'Backspace' && query === '' && partners.length > 0) {
      remove(partners.length - 1);
    }
  };

  const handleBlur = () => {
    // Commit the trailing token on blur so the user doesn't lose what they
    // typed if they tap Save without pressing Enter first.
    if (query.trim()) commit(query);
  };

  return (
    <div>
      {partners.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {partners.map((name, i) => (
            <button
              key={`${name}-${i}`}
              type="button"
              onClick={() => remove(i)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors touch-manipulation j2-press inline-flex items-center gap-1.5"
              style={{ backgroundColor: COPPER, color: '#fff' }}
              title={`${name} (tap to remove)`}
            >
              <span>{name}</span>
              <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11 }}>×</span>
            </button>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value.slice(0, MAX_PARTNER_LENGTH))}
        onKeyDown={handleKey}
        onBlur={handleBlur}
        disabled={atLimit}
        placeholder={
          atLimit                 ? `Max ${maxSelected} partners`
          : partners.length === 0 ? 'e.g. Alex, Mav'
          :                         'Add another…'
        }
        className="w-full border rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-colors disabled:opacity-50"
        style={{ backgroundColor: SURFACE_3, borderColor: 'rgba(255,255,255,0.08)' }}
        autoCapitalize="words"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        aria-label="Add a training partner"
      />
    </div>
  );
}
