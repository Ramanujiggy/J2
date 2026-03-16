import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.ts';
import { PALE_YELLOW, GLOW_SOFT, CARD_BG, COPPER_BORDER, CARD_SHADOW } from '../lib/theme.ts';
import { useProfile } from '../context/ProfileContext.tsx';

interface Intention {
  id: string;
  week_start: string;
  intent_label: string;
  intent_category: string | null;
  duration_days: number;
  journal_entry: string | null;
}

interface IntentionsResponse { intentions: Intention[] }

const CATEGORY_COLORS: Record<string, string> = {
  technical:   '#60a5fa',
  physical:    '#f87171',
  mental:      '#a78bfa',
  positional:  '#34d399',
  competitive: '#fbbf24',
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatWeek(weekStart: string): string {
  const d = new Date(weekStart.slice(0, 10) + 'T00:00:00');
  return `Week of ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function JournalEntryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { intentionsEnabled } = useProfile();

  const [intention, setIntention] = useState<Intention | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchIntention = useCallback(async () => {
    try {
      const data = await api.get<IntentionsResponse>('/api/intentions');
      const found = (data.intentions ?? []).find(i => i.id === id) ?? null;
      setIntention(found);
      if (found?.journal_entry) setText(found.journal_entry);
    } catch {
      setError('Could not load intention. Please go back and try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchIntention(); }, [fetchIntention]);

  // Autosave 1.5s after the user stops typing
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    setSaved(false);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => { void save(val); }, 1500);
  };

  const save = async (entry: string) => {
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      await api.patch(`/api/intentions/${id}/journal`, { journal_entry: entry });
      setSaved(true);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    await save(text);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-white/30">Loading…</p>
      </div>
    );
  }

  if (!intention) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <p className="text-sm text-red-400">Intention not found.</p>
        <button
          onClick={() => navigate('/intentions')}
          className="mt-4 text-sm text-white/40 hover:text-white transition-colors"
        >
          ← Back to Intentions
        </button>
      </div>
    );
  }

  const categoryColor = intention.intent_category
    ? (CATEGORY_COLORS[intention.intent_category] ?? 'rgba(255,255,255,0.4)')
    : null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

      {/* Back */}
      <button
        onClick={() => navigate('/intentions')}
        className="text-sm text-white/40 hover:text-white transition-colors flex items-center gap-1.5"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Intentions
      </button>

      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold tracking-tight"
          style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}
        >
          {intention.intent_label}
        </h2>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-white/35">{formatWeek(intention.week_start)}</span>
          {categoryColor && (
            <>
              <span className="text-white/15">·</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize"
                style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}
              >
                {intention.intent_category}
              </span>
            </>
          )}
          <span className="text-white/15">·</span>
          <span className="text-xs text-white/35">{intention.duration_days}d intention</span>
        </div>
      </div>

      {/* Journal card */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: CARD_BG, border: `1px solid ${COPPER_BORDER}`, boxShadow: CARD_SHADOW }}
      >
        <p className="text-xs text-white/35 mb-3 font-medium uppercase tracking-wide">Journal Entry</p>
        {!intentionsEnabled && (
          <p className="text-xs text-white/25 mb-3 italic">Intentions are disabled — entry is read-only.</p>
        )}
        <textarea
          value={text}
          onChange={intentionsEnabled ? handleChange : undefined}
          readOnly={!intentionsEnabled}
          placeholder="Describe the context and goals of your training intentions this week…"
          className="w-full bg-transparent resize-none outline-none text-sm text-white/80 placeholder-white/20 leading-relaxed"
          style={{ minHeight: 280, cursor: intentionsEnabled ? 'text' : 'default' }}
          autoFocus={intentionsEnabled}
        />
      </div>

      {/* Footer: status + save */}
      {intentionsEnabled && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/25">
            {saving ? 'Saving…' : saved ? 'Saved' : ''}
          </span>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-red-400">{error}</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-brand-orange hover:bg-brand-orange/90 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
