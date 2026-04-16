import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { api } from '../lib/api.ts';
import { PALE_YELLOW, GLOW_SOFT, SURFACE_2, COPPER } from '../lib/theme.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import { CATEGORY_COLORS, SKILL_TAGS, MONTH_NAMES } from '../lib/constants.ts';
import { formatDuration, INTENSITY_COLOR } from '../lib/sessionUtils.ts';
import { vibrate } from '../lib/haptics.ts';
import type { Intention, IntentionsResponse, SessionSummary, SessionsResponse } from '../types/api.ts';
import PageContent from '../components/PageContent.tsx';
import SessionDetailModal from '../components/SessionDetailModal.tsx';
import { formatWeekLong } from '../lib/analyticsUtils.ts';

export default function JournalEntryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { intentionsEnabled } = useProfile();

  const [intention, setIntention] = useState<Intention | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const saveTimeout  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const textInitialized = useRef(false);

  const fetchIntention = useCallback(async () => {
    try {
      const data = await api.get<IntentionsResponse>('/api/intentions');
      const found = (data.intentions ?? []).find(i => i.id === id) ?? null;
      setIntention(found);
      // Only initialize text on first load — preserve in-progress edits on re-fetch
      if (found?.journal_entry && !textInitialized.current) {
        setText(found.journal_entry);
        textInitialized.current = true;
      }

      // Fetch sessions within the intention's date window
      if (found) {
        const from = found.week_start.slice(0, 10);
        const endDate = new Date(from + 'T00:00:00');
        endDate.setDate(endDate.getDate() + found.duration_days - 1);
        const to = endDate.toISOString().slice(0, 10);
        const sesRes = await api.get<SessionsResponse>(`/api/sessions?from=${from}&to=${to}`);
        setSessions(sesRes.sessions ?? []);
      }
    } catch {
      setError('Could not load intention. Please go back and try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchIntention(); }, [fetchIntention]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

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

  const categoryColor = intention?.intent_category
    ? (CATEGORY_COLORS[intention.intent_category] ?? 'rgba(255,255,255,0.4)')
    : null;

  return (
    <PageContent ready={!loading} loadingMessages={['Loading your intentions...']}>
    {!intention ? (
      <div className={`mx-auto py-6 ${isDesktop ? 'max-w-3xl px-8' : 'max-w-2xl px-4 sm:px-6'}`}>
        <p className="text-sm text-red-400">Intention not found.</p>
        <button
          onClick={() => navigate('/intentions')}
          className="mt-4 text-sm transition-colors"
          style={{ color: 'rgba(255,255,255,0.40)' }}
        >
          ← Back to Intentions
        </button>
      </div>
    ) : (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

      {/* Back */}
      <button
        onClick={() => navigate('/intentions')}
        className="text-sm flex items-center gap-1.5 transition-colors touch-manipulation"
        style={{ color: 'rgba(255,255,255,0.40)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Intentions
      </button>

      {/* Header */}
      <div>
        <h2
          className="text-2xl font-display font-bold tracking-tight"
          style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}
        >
          {intention.intent_label}
        </h2>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {formatWeekLong(intention.week_start)}
          </span>
          {categoryColor && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
              <span
                className="text-[10px] px-2 py-0.5 rounded-lg font-medium capitalize"
                style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}
              >
                {intention.intent_category}
              </span>
            </>
          )}
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {intention.duration_days}d intention
          </span>
        </div>
      </div>

      {/* Journal card */}
      <div
        className="rounded-xl px-5 py-5"
        style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}
      >
        <p
          className="text-[10px] font-medium uppercase tracking-widest mb-3"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        >
          Journal Entry
        </p>
        {!intentionsEnabled && (
          <p className="text-xs mb-3 italic" style={{ color: 'rgba(255,255,255,0.22)' }}>
            Intentions are disabled — entry is read-only.
          </p>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={intentionsEnabled ? handleChange : undefined}
          readOnly={!intentionsEnabled}
          placeholder="Describe the context and goals of your training intentions this week..."
          className="w-full bg-transparent resize-none outline-none text-sm leading-relaxed placeholder-white/20"
          style={{
            minHeight: 200,
            height: 'auto',
            color: 'rgba(255,255,255,0.75)',
            cursor: intentionsEnabled ? 'text' : 'default',
          }}
          autoFocus={intentionsEnabled}
        />
      </div>

      {/* Save area */}
      {intentionsEnabled && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {saving ? 'Saving...' : saved ? 'Saved' : ''}
          </span>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-red-400">{error}</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-white font-semibold rounded-xl transition-all touch-manipulation disabled:opacity-50"
              style={{
                height: 44,
                paddingLeft: 24,
                paddingRight: 24,
                backgroundColor: '#DA7422',
                boxShadow: '0 2px 12px rgba(218,116,34,0.25)',
                fontSize: 14,
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* ── Associated Sessions ────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.80)' }}>
            Sessions
          </h3>
          {sessions.length > 0 && (
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>
              {sessions.length} logged
            </span>
          )}
        </div>

        {/* Mini summary */}
        {sessions.length > 0 && (() => {
          const totalMin = sessions.reduce((s, ses) => s + ses.duration, 0);
          return (
            <p className="text-xs mb-2.5" style={{ color: 'rgba(255,255,255,0.30)' }}>
              {formatDuration(totalMin)} across {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </p>
          );
        })()}

        {sessions.length > 0 ? (
          <div className="space-y-2">
            {sessions.map(session => {
              const d = new Date(session.date + 'T00:00:00');
              const dateLabel = `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
              const primaryTag = session.tags?.[0];
              const tagLabel = primaryTag ? (SKILL_TAGS.find(s => s.value === primaryTag)?.label ?? primaryTag) : null;
              const intensityColor = INTENSITY_COLOR[session.intensity] ?? 'rgba(255,255,255,0.3)';

              return (
                <button
                  key={session.id}
                  onClick={() => { vibrate(8); setSelectedSession(session); }}
                  className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-3 j2-press touch-manipulation"
                  style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  {/* Intensity dot */}
                  <span
                    className="flex-shrink-0 rounded-full"
                    style={{ width: 8, height: 8, backgroundColor: intensityColor }}
                  />

                  {/* Session info */}
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.80)' }}>
                      {dateLabel}
                    </span>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>·</span>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.50)' }}>
                      {formatDuration(session.duration)}
                    </span>
                    {tagLabel && (
                      <>
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>·</span>
                        <span className="text-xs font-medium truncate" style={{ color: COPPER }}>
                          {tagLabel}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Chevron */}
                  <ChevronRight size={14} strokeWidth={2} style={{ color: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        ) : (
          <div
            className="rounded-xl px-5 py-4"
            style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <p className="text-sm italic" style={{ color: 'rgba(255,255,255,0.30)' }}>
              No sessions logged during this period.
            </p>
          </div>
        )}
      </div>

      {/* ── Session Detail Modal ──────────────────────────────── */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          date={new Date(selectedSession.date + 'T00:00:00')}
          intention={{ intent_label: intention.intent_label, intent_category: intention.intent_category }}
          onClose={() => setSelectedSession(null)}
          onSaved={() => { setSelectedSession(null); fetchIntention(); }}
          onDeleted={() => { setSelectedSession(null); fetchIntention(); }}
        />
      )}

    </div>
    )}
    </PageContent>
  );
}
