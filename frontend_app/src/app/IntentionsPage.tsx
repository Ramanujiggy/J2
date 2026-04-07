import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.ts';
import { PALE_YELLOW, GLOW_SOFT, CARD_BG, COPPER_BORDER, SURFACE_2, SURFACE_2_BORDER } from '../lib/theme.ts';
import { SKILL_TAGS, CATEGORY_COLORS, MONTH_NAMES } from '../lib/constants.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import type { Intention, SessionSummary, IntentionsResponse, SessionsResponse } from '../types/api.ts';
import PageContent from '../components/PageContent.tsx';

function formatWeek(weekStart: string): string {
  const d = new Date(weekStart.slice(0, 10) + 'T00:00:00');
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

// Compute the most frequent tag across a set of sessions in a given week
function ambientFocus(sessions: SessionSummary[], weekStart: string): string | null {
  const weekStartSlice = weekStart.slice(0, 10);
  const weekEnd = new Date(weekStartSlice + 'T00:00:00');
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const tagCounts: Record<string, number> = {};
  sessions.forEach(s => {
    const dateStr = typeof s.date === 'string' ? s.date.slice(0, 10) : new Date(s.date).toISOString().slice(0, 10);
    if (dateStr >= weekStartSlice && dateStr <= weekEndStr) {
      s.tags?.forEach(t => { tagCounts[t] = (tagCounts[t] ?? 0) + 1; });
    }
  });

  const top = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  return top ? (SKILL_TAGS.find(s => s.value === top)?.label ?? top) : null;
}

export default function IntentionsPage() {
  const navigate = useNavigate();
  const { intentionsEnabled } = useProfile();
  const [intentions, setIntentions] = useState<Intention[]>([]);
  const [sessions,   setSessions]   = useState<SessionSummary[]>([]);
  const [loading,    setLoading]    = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [intRes, sesRes] = await Promise.all([
        api.get<IntentionsResponse>('/api/intentions'),
        api.get<SessionsResponse>('/api/sessions'),
      ]);
      setIntentions(intRes.intentions ?? []);
      setSessions(sesRes.sessions ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return (
    <PageContent ready={!loading}>
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

      <h2
        className="text-2xl font-bold tracking-tight"
        style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}
      >
        Intentions
      </h2>

      {!intentionsEnabled && (
        <div
          className="rounded-xl px-4 py-2.5 text-sm"
          style={{ backgroundColor: SURFACE_2, border: `1px solid ${SURFACE_2_BORDER}`, color: 'rgba(255,255,255,0.35)' }}
        >
          Intentions are currently disabled — viewing history only.
        </div>
      )}

      {intentions.length === 0 ? (
        <div
          className="rounded-xl px-6 py-10 text-center"
          style={{ backgroundColor: SURFACE_2, border: `1px solid ${COPPER_BORDER}` }}
        >
          <p className="text-white/30 text-sm">No intentions set yet.</p>
          <p className="text-white/20 text-xs mt-1">Set your first weekly intention from the Home tab.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Column headers */}
          <div className="hidden sm:grid grid-cols-[80px_1fr_1fr_100px] gap-4 px-4 pb-1">
            <span className="text-[11px] text-white/30 uppercase tracking-wide">Week</span>
            <span className="text-[11px] text-white/30 uppercase tracking-wide">Intention</span>
            <span className="text-[11px] text-white/30 uppercase tracking-wide">Training Telemetry</span>
            <span className="text-[11px] text-white/30 uppercase tracking-wide">Journal</span>
          </div>

          {intentions.map(intention => {
            const ambient = ambientFocus(sessions, intention.week_start);
            const categoryColor = intention.intent_category
              ? (CATEGORY_COLORS[intention.intent_category] ?? 'rgba(255,255,255,0.4)')
              : 'rgba(255,255,255,0.4)';
            const hasJournal = !!intention.journal_entry;
            const journalSnippet = hasJournal
              ? intention.journal_entry!.slice(0, 22) + (intention.journal_entry!.length > 22 ? '…' : '')
              : null;

            return (
              <div
                key={intention.id}
                className="rounded-xl px-4 py-3 sm:grid sm:grid-cols-[80px_1fr_1fr_100px] sm:gap-4 sm:items-center"
                style={{ backgroundColor: CARD_BG, border: `1px solid ${SURFACE_2_BORDER}` }}
              >
                {/* Mobile: top row — week + journal link */}
                <div className="flex items-center justify-between sm:contents">
                  <p className="text-xs text-white/40 font-medium">{formatWeek(intention.week_start)}</p>

                  {/* Journal entry link — right-aligned on mobile, own column on sm */}
                  <button
                    onClick={() => navigate(`/intentions/${intention.id}/journal`)}
                    className="flex items-center gap-1.5 text-left transition-colors group sm:hidden"
                    title={hasJournal ? intention.journal_entry! : 'Add a journal entry'}
                  >
                    {hasJournal ? (
                      <span className="text-xs group-hover:opacity-90 transition-opacity" style={{ color: 'rgba(242,228,168,0.6)' }}>
                        ✦ {journalSnippet}
                      </span>
                    ) : (
                      <span className="text-xs text-white/20 group-hover:text-white/40 transition-colors italic">+ add</span>
                    )}
                  </button>
                </div>

                {/* Intention label + category */}
                <div className="flex items-center gap-2 min-w-0 mt-1 sm:mt-0">
                  {intention.intent_category && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium capitalize"
                      style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}
                    >
                      {intention.intent_category}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-white truncate">{intention.intent_label}</span>
                </div>

                {/* Ambient focus */}
                <p className="text-xs sm:text-sm text-white/40 sm:text-white/50 mt-0.5 sm:mt-0">
                  {ambient
                    ? <><span className="text-white/20 sm:hidden">Ambient: </span>{ambient}</>
                    : <span className="text-white/20 italic">no data</span>
                  }
                </p>

                {/* Journal entry link — desktop column only */}
                <button
                  onClick={() => navigate(`/intentions/${intention.id}/journal`)}
                  className="hidden sm:flex items-center gap-1.5 text-left transition-colors group"
                  title={hasJournal ? intention.journal_entry! : 'Add a journal entry'}
                >
                  {hasJournal ? (
                    <span className="text-xs truncate group-hover:opacity-90 transition-opacity" style={{ color: 'rgba(242,228,168,0.6)' }}>
                      ✦ {journalSnippet}
                    </span>
                  ) : (
                    <span className="text-xs text-white/20 group-hover:text-white/40 transition-colors italic">+ add</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </PageContent>
  );
}
