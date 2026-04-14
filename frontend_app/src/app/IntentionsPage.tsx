import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { api } from '../lib/api.ts';
import { PALE_YELLOW, GLOW_SOFT, COPPER, COPPER_BORDER, SURFACE_2, SURFACE_3 } from '../lib/theme.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { SKILL_TAGS, CATEGORY_COLORS } from '../lib/constants.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import type { Intention, SessionSummary, IntentionsResponse, SessionsResponse } from '../types/api.ts';
import PageContent from '../components/PageContent.tsx';
import SetIntentionModal from '../components/SetIntentionModal.tsx';
import { formatWeekShort, topTagInRange, computeAlignment } from '../lib/analyticsUtils.ts';

export default function IntentionsPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { intentionsEnabled } = useProfile();
  const [intentions,  setIntentions]  = useState<Intention[]>([]);
  const [sessions,    setSessions]    = useState<SessionSummary[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [editTarget,  setEditTarget]  = useState<Intention | null>(null);

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
    <PageContent ready={!loading} loadingMessages={['Loading your intentions...']}>
    <div className={`mx-auto space-y-5 ${isDesktop ? 'max-w-6xl px-8 py-5' : 'max-w-5xl px-4 sm:px-6 py-6'}`}>

      {/* Header */}
      <div>
        <h2
          className="text-2xl font-bold tracking-tight"
          style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}
        >
          Intentions
        </h2>
        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
          Your training focus over time
        </p>
      </div>

      {!intentionsEnabled && (
        <div
          className="rounded-xl px-4 py-2.5 text-sm"
          style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}
        >
          Intentions are currently disabled — viewing history only.
        </div>
      )}

      {intentions.length === 0 ? (
        /* ── Empty state ────────────────────────────────────── */
        <div
          className="rounded-xl px-6 py-10 text-center"
          style={{ backgroundColor: SURFACE_2, border: `1px solid ${COPPER_BORDER}` }}
        >
          <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.40)' }}>No intentions set yet.</p>
          <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.22)' }}>
            Declare what you're working on to track alignment.
          </p>
          <button
            onClick={() => navigate('/home')}
            className="w-full max-w-xs mx-auto text-white font-semibold rounded-xl transition-all touch-manipulation"
            style={{
              height: 52,
              backgroundColor: '#DA7422',
              boxShadow: '0 2px 12px rgba(218,116,34,0.25)',
              fontSize: 16,
            }}
          >
            Set Your First Intention
          </button>
        </div>
      ) : (
        /* ── Intention cards ────────────────────────────────── */
        <div className={isDesktop ? 'grid grid-cols-2 gap-5' : 'space-y-3'}>
          {intentions.map(intention => {
            const headingLabel = intention.heading
              ? (SKILL_TAGS.find(s => s.value === intention.heading)?.label ?? intention.heading)
              : null;
            const topTag        = topTagInRange(sessions, intention.week_start, intention.duration_days);
            const ambient       = topTag?.label ?? null;
            const alignment     = computeAlignment(intention, topTag);
            const categoryColor = intention.intent_category
              ? (CATEGORY_COLORS[intention.intent_category] ?? 'rgba(255,255,255,0.4)')
              : null;
            const hasJournal    = !!intention.journal_entry;
            const journalSnippet = hasJournal
              ? intention.journal_entry!.slice(0, 40) + (intention.journal_entry!.length > 40 ? '...' : '')
              : null;

            return (
              <div
                key={intention.id}
                className="rounded-xl px-4 py-4 space-y-3"
                style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}
              >
                {/* Top row — week date + duration + edit */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.40)' }}>
                      {formatWeekShort(intention.week_start)}
                    </span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-lg font-medium"
                      style={{ backgroundColor: SURFACE_3, color: COPPER }}
                    >
                      {intention.duration_days}d
                    </span>
                    {categoryColor && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-lg font-medium capitalize"
                        style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}
                      >
                        {intention.intent_category}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setEditTarget(intention)}
                    className="p-1.5 rounded-lg transition-colors touch-manipulation"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                    title="Edit intention"
                  >
                    <Pencil size={13} />
                  </button>
                </div>

                {/* Heading + label */}
                <div>
                  <p className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.90)' }}>
                    {headingLabel ?? intention.intent_label}
                  </p>
                  {headingLabel && intention.intent_label && intention.intent_label.toLowerCase() !== (headingLabel ?? '').toLowerCase() && (
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>
                      {intention.intent_label}
                    </p>
                  )}
                </div>

                {/* Alignment row */}
                <div className="flex items-center gap-2">
                  {/* Alignment indicator bar */}
                  <div
                    className="rounded-full"
                    style={{
                      width: 32,
                      height: 4,
                      backgroundColor: alignment === 'aligned'  ? 'rgba(82,181,108,0.70)'
                                     : alignment === 'diverged' ? 'rgba(218,116,34,0.50)'
                                     : 'rgba(255,255,255,0.06)',
                    }}
                  />
                  {ambient ? (
                    <span className="text-xs font-medium" style={{ color: COPPER }}>
                      Trained: {ambient}
                    </span>
                  ) : (
                    <span className="text-xs italic" style={{ color: 'rgba(255,255,255,0.20)' }}>
                      No sessions logged
                    </span>
                  )}
                  {alignment !== 'no-data' && (
                    <span
                      className="text-[10px]"
                      style={{
                        color: alignment === 'aligned'
                          ? 'rgba(82,181,108,0.65)'
                          : 'rgba(218,116,34,0.50)',
                      }}
                    >
                      {alignment === 'aligned' ? 'Aligned' : 'Diverged'}
                    </span>
                  )}
                </div>

                {/* Journal row */}
                <button
                  onClick={() => navigate(`/intentions/${intention.id}/journal`)}
                  className="w-full flex items-center gap-2 pt-2 transition-colors touch-manipulation"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                >
                  {hasJournal ? (
                    <span className="text-xs truncate" style={{ color: 'rgba(242,228,168,0.45)' }}>
                      {journalSnippet}
                    </span>
                  ) : (
                    <span className="text-xs font-medium" style={{ color: COPPER }}>
                      + Write
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <SetIntentionModal
          editIntention={editTarget}
          onSaved={fetchAll}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
    </PageContent>
  );
}
