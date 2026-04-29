import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '../lib/api.ts';
import { SKILL_TAGS } from '../lib/constants.ts';
import { INTENSITY_COLOR, SESSION_TYPE_LABELS } from '../lib/sessionUtils.ts';
import {
  COPPER, COPPER_BORDER, SURFACE_2, SURFACE_3,
  CARD_BG, CARD_SHADOW, PALE_YELLOW,
} from '../lib/theme.ts';
import { vibrate } from '../lib/haptics.ts';
import {
  type SearchFilters, DEFAULT_FILTERS, hasActiveFilters, filterSessionsLocal,
} from '../lib/searchUtils.ts';
import { useCanonicalConstraints } from '../hooks/useCanonicalConstraints.ts';
import { useUserConstraints } from '../hooks/useUserConstraints.ts';
import SessionDetailModal from './SessionDetailModal.tsx';
import type { SessionSummary, SearchSessionsResponse } from '../types/api.ts';

// ── Helpers ──────────────────────────────────────────────────────────────

const GI_OPTIONS = [
  { value: 'gi' as const, label: 'Gi' },
  { value: 'no_gi' as const, label: 'No-Gi' },
];

const TYPE_OPTIONS = [
  { value: 'class' as const, label: 'Class' },
  { value: 'drilling' as const, label: 'Drilling' },
  { value: 'competition_training' as const, label: 'Comp' },
];

function headingLabel(v: string | null | undefined): string {
  if (!v) return '';
  return SKILL_TAGS.find(s => s.value === v)?.label ?? v;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDuration(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

// ── Component ────────────────────────────────────────────────────────────

interface Props {
  cachedSessions: SessionSummary[];
  onRefresh: () => void;
}

export default function SessionSearchPanel({ cachedSessions, onRefresh }: Props) {
  const [filters, setFilters] = useState<SearchFilters>({ ...DEFAULT_FILTERS });
  const [results, setResults] = useState<SessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [searched, setSearched] = useState(false);
  const [detailSession, setDetailSession] = useState<SessionSummary | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Constraint vocabulary for the chip filter row. Constraints rarely change,
  // so the canonical hook caches at module level — this is cheap.
  const { constraints: canonicalConstraints } = useCanonicalConstraints();
  const { constraints: userConstraints } = useUserConstraints();

  const LIMIT = 50;

  // Focus input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const doSearch = useCallback(async (f: SearchFilters, append = false) => {
    const newOffset = append ? offset + LIMIT : 0;
    if (!append) setOffset(0);

    // Offline fallback
    if (!navigator.onLine) {
      const filtered = filterSessionsLocal(cachedSessions, f);
      setResults(filtered);
      setTotal(filtered.length);
      setSearched(true);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.q) params.set('q', f.q);
      if (f.gi_nogi) params.set('gi_nogi', f.gi_nogi);
      if (f.session_type) params.set('session_type', f.session_type);
      if (f.heading) params.set('heading', f.heading);
      if (f.intensity_min > 1) params.set('intensity_min', String(f.intensity_min));
      if (f.intensity_max < 5) params.set('intensity_max', String(f.intensity_max));
      if (f.from) params.set('from', f.from);
      if (f.to) params.set('to', f.to);
      if (f.partner) params.set('partner', f.partner);
      for (const id of f.constraint_ids) params.append('constraint_id', id);
      params.set('limit', String(LIMIT));
      params.set('offset', String(newOffset));

      const data = await api.get<SearchSessionsResponse>(
        `/api/sessions/search?${params.toString()}`,
      );
      if (append) {
        setResults(prev => [...prev, ...(data.sessions ?? [])]);
      } else {
        setResults(data.sessions ?? []);
      }
      setTotal(data.total ?? 0);
      setOffset(newOffset);
    } catch {
      // Fallback to client-side filter
      const filtered = filterSessionsLocal(cachedSessions, f);
      setResults(filtered);
      setTotal(filtered.length);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, [cachedSessions, offset]);

  // Trigger search when filters change (debounced for text, immediate for chips)
  const triggerSearch = useCallback((f: SearchFilters, debounce = false) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (debounce) {
      debounceRef.current = setTimeout(() => doSearch(f), 300);
    } else {
      doSearch(f);
    }
  }, [doSearch]);

  const updateFilter = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K],
    debounce = false,
  ) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    triggerSearch(next, debounce);
  };

  const toggleFilter = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K],
  ) => {
    vibrate(8);
    const next = { ...filters, [key]: filters[key] === value ? null : value };
    setFilters(next as SearchFilters);
    triggerSearch(next as SearchFilters);
  };

  const clearAll = () => {
    vibrate(8);
    const reset = { ...DEFAULT_FILTERS };
    setFilters(reset);
    setResults([]);
    setTotal(0);
    setSearched(false);
    setOffset(0);
    inputRef.current?.focus();
  };

  const chipStyle = (active: boolean) => ({
    backgroundColor: active ? 'rgba(196,145,95,0.25)' : SURFACE_3,
    color: active ? COPPER : 'rgba(255,255,255,0.5)',
    border: `1px solid ${active ? COPPER_BORDER : 'transparent'}`,
  });

  return (
    <>
      <div data-no-page-swipe="" className="space-y-4">
        {/* Search input */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search notes, skills, pillars..."
            value={filters.q}
            onChange={e => updateFilter('q', e.target.value, true)}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm text-white placeholder:text-white/30 outline-none transition-colors touch-manipulation"
            style={{
              backgroundColor: SURFACE_3,
              border: `1px solid ${COPPER_BORDER}`,
            }}
          />
          {filters.q && (
            <button
              onClick={() => updateFilter('q', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 touch-manipulation"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="space-y-2.5">
          {/* Gi / No-Gi */}
          <div className="flex flex-wrap gap-1.5">
            {GI_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => toggleFilter('gi_nogi', o.value)}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-colors touch-manipulation j2-press"
                style={chipStyle(filters.gi_nogi === o.value)}
              >
                {o.label}
              </button>
            ))}
            <span className="w-px mx-1" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
            {TYPE_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => toggleFilter('session_type', o.value)}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-colors touch-manipulation j2-press"
                style={chipStyle(filters.session_type === o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Pillar chips */}
          <div className="flex flex-wrap gap-1.5">
            {SKILL_TAGS.map(s => (
              <button
                key={s.value}
                onClick={() => toggleFilter('heading', s.value)}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-colors touch-manipulation j2-press"
                style={chipStyle(filters.heading === s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Partner — freetext, debounced. Matches case-insensitive substring. */}
          <div className="relative">
            <input
              type="text"
              placeholder="Filter by partner name..."
              value={filters.partner}
              onChange={e => updateFilter('partner', e.target.value, true)}
              className="w-full pl-3 pr-8 py-2 rounded-lg text-xs text-white placeholder:text-white/30 outline-none touch-manipulation"
              style={{
                backgroundColor: SURFACE_3,
                border: `1px solid ${COPPER_BORDER}`,
              }}
            />
            {filters.partner && (
              <button
                onClick={() => updateFilter('partner', '')}
                className="absolute right-2 top-1/2 -translate-y-1/2 touch-manipulation"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Constraints — both canonical (curated) and user-scoped (custom).
              Multi-select: a session matches if ANY selected constraint is on it. */}
          {(canonicalConstraints.length > 0 || userConstraints.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {[...canonicalConstraints, ...userConstraints].map(c => {
                const active = filters.constraint_ids.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      vibrate(8);
                      const next = active
                        ? filters.constraint_ids.filter(id => id !== c.id)
                        : [...filters.constraint_ids, c.id];
                      updateFilter('constraint_ids', next);
                    }}
                    className="px-3 py-1 rounded-lg text-xs font-medium transition-colors touch-manipulation j2-press"
                    style={chipStyle(active)}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Clear all */}
          {hasActiveFilters(filters) && (
            <button
              onClick={clearAll}
              className="text-xs transition-colors touch-manipulation"
              style={{ color: 'rgba(196,145,95,0.7)' }}
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Results */}
        {loading && !results.length && (
          <p className="text-xs text-center py-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Searching...
          </p>
        )}

        {searched && !loading && results.length === 0 && (
          <p className="text-xs text-center py-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
            No sessions match your filters.
          </p>
        )}

        {results.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {results.length < total
                ? `Showing ${results.length} of ${total} results`
                : `${total} result${total === 1 ? '' : 's'}`}
            </p>

            {results.map(s => (
              <button
                key={s.id}
                onClick={() => { vibrate(8); setDetailSession(s); }}
                className="w-full text-left rounded-xl p-3 transition-colors touch-manipulation j2-press"
                style={{
                  backgroundColor: CARD_BG,
                  boxShadow: CARD_SHADOW,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  {/* Intensity dot */}
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: INTENSITY_COLOR[s.intensity] ?? '#666' }}
                  />
                  <span className="text-xs font-medium" style={{ color: PALE_YELLOW }}>
                    {formatDate(s.date)}
                  </span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {fmtDuration(s.duration)}
                  </span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {s.gi_nogi === 'gi' ? 'Gi' : 'No-Gi'}
                  </span>
                  {s.heading && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: SURFACE_2, color: COPPER }}
                    >
                      {headingLabel(s.heading)}
                    </span>
                  )}
                  <span className="text-xs ml-auto" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {SESSION_TYPE_LABELS[s.session_type] ?? s.session_type}
                  </span>
                </div>
                {s.notes && (
                  <p
                    className="text-xs leading-relaxed line-clamp-2"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  >
                    {s.notes}
                  </p>
                )}
              </button>
            ))}

            {/* Load more */}
            {results.length < total && (
              <button
                onClick={() => doSearch(filters, true)}
                disabled={loading}
                className="w-full text-center text-xs py-3 rounded-xl transition-colors disabled:opacity-50 touch-manipulation"
                style={{ backgroundColor: SURFACE_2, color: 'rgba(196,145,95,0.7)' }}
              >
                {loading ? 'Loading...' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Session detail modal */}
      {detailSession && (
        <SessionDetailModal
          session={detailSession}
          date={new Date(detailSession.date + 'T00:00:00')}
          onClose={() => setDetailSession(null)}
          onSaved={() => { setDetailSession(null); onRefresh(); doSearch(filters); }}
          onDeleted={() => { setDetailSession(null); onRefresh(); doSearch(filters); }}
        />
      )}
    </>
  );
}
