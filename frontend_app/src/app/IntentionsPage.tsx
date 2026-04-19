import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { api } from '../lib/api.ts';
import {
  PALE_YELLOW, GLOW_SOFT, COPPER, CARD_BG, CARD_GLOW, CARD_GLOW_BORDER,
  SURFACE_2, SURFACE_3, FONT_EDITORIAL,
} from '../lib/theme.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { SKILL_TAGS, CATEGORY_COLORS, MONTH_NAMES } from '../lib/constants.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import { useActiveIntention } from '../context/ActiveIntentionContext.tsx';
import { toDateString, addDays } from '../lib/sessionUtils.ts';
import type { Intention, SessionSummary, IntentionsResponse, SessionsResponse } from '../types/api.ts';
import PageContent from '../components/PageContent.tsx';
import SetIntentionModal from '../components/SetIntentionModal.tsx';
import MiniPrism from '../components/charts/MiniPrism.tsx';
import { SKILL_COLORS } from '../components/charts/RadarChart.tsx';
import { formatWeekShort, topTagInRange, computeAlignment, tagHoursInRange } from '../lib/analyticsUtils.ts';

export default function IntentionsPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { intentionsEnabled } = useProfile();
  const { refresh: refreshRailIntention } = useActiveIntention();
  const [intentions,  setIntentions]  = useState<Intention[]>([]);
  const [sessions,    setSessions]    = useState<SessionSummary[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [editTarget,  setEditTarget]  = useState<Intention | null>(null);
  const [createOpen,  setCreateOpen]  = useState(false);

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

  // ── Desktop layout ────────────────────────────────────────────────────

  if (isDesktop) {
    return (
      <DesktopIntentionsView
        intentions={intentions}
        sessions={sessions}
        loading={loading}
        intentionsEnabled={intentionsEnabled}
        editTarget={editTarget}
        createOpen={createOpen}
        onOpenCreate={() => setCreateOpen(true)}
        onOpenEdit={setEditTarget}
        onCloseModal={() => { setCreateOpen(false); setEditTarget(null); }}
        onSaved={() => { fetchAll(); refreshRailIntention(); }}
        onNavigate={navigate}
      />
    );
  }

  // ── Mobile layout (preserved verbatim) ────────────────────────────────

  return (
    <PageContent ready={!loading} loadingMessages={['Loading your intentions...']}>
    <div className="mx-auto space-y-5 max-w-5xl px-4 sm:px-6 py-6">

      {/* Header */}
      <div>
        <h2
          className="text-2xl font-display font-bold tracking-tight"
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
          style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.06)' }}
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
        <div className="space-y-3">
          {intentions.map(intention => {
            const headingLabel = intention.heading
              ? (SKILL_TAGS.find(s => s.value === intention.heading)?.label ?? intention.heading)
              : null;
            const topTag        = topTagInRange(sessions, intention.week_start, intention.duration_days);
            const ambient       = topTag?.label ?? null;
            const hours         = tagHoursInRange(sessions, intention.week_start, intention.duration_days);
            const alignment     = computeAlignment(intention, topTag, hours);
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
                      backgroundColor: alignment.status === 'aligned'  ? 'rgba(82,181,108,0.70)'
                                     : alignment.status === 'diverged' ? 'rgba(218,116,34,0.50)'
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
                  {alignment.status !== 'no-data' && (
                    <span
                      className="text-[10px]"
                      style={{
                        color: alignment.status === 'aligned'
                          ? 'rgba(82,181,108,0.65)'
                          : 'rgba(218,116,34,0.50)',
                      }}
                    >
                      {alignment.score !== null ? `${alignment.score}%` : (alignment.status === 'aligned' ? 'Aligned' : 'Diverged')}
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
          onSaved={() => { fetchAll(); refreshRailIntention(); }}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
    </PageContent>
  );
}

// ── Desktop editorial layout ──────────────────────────────────────────────

interface DesktopViewProps {
  intentions: Intention[];
  sessions: SessionSummary[];
  loading: boolean;
  intentionsEnabled: boolean;
  editTarget: Intention | null;
  createOpen: boolean;
  onOpenCreate: () => void;
  onOpenEdit: (intention: Intention) => void;
  onCloseModal: () => void;
  onSaved: () => void;
  onNavigate: (path: string) => void;
}

function DesktopIntentionsView({
  intentions, sessions, loading, intentionsEnabled,
  editTarget, createOpen,
  onOpenCreate, onOpenEdit, onCloseModal, onSaved, onNavigate,
}: DesktopViewProps) {
  const todayStr = toDateString(new Date());

  const activeIntention = useMemo(() => {
    return intentions.find(i => {
      const start = i.week_start.slice(0, 10);
      const end = addDays(start, (i.duration_days ?? 7) - 1);
      return todayStr >= start && todayStr <= end;
    }) ?? null;
  }, [intentions, todayStr]);

  // Group intentions by year (newest first), each year's entries also newest-first
  const byYear = useMemo(() => {
    const map = new Map<string, Intention[]>();
    intentions.forEach(i => {
      const y = i.week_start.slice(0, 4);
      const bucket = map.get(y) ?? [];
      bucket.push(i);
      map.set(y, bucket);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [intentions]);

  return (
    <PageContent ready={!loading} loadingMessages={['Loading your intentions...']}>
    <div style={{ maxWidth: 1680, margin: '0 auto', padding: '64px 64px 104px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 52 }}>
        <div>
          <div className="j2-label-micro" style={{ marginBottom: 16 }}>Intentions</div>
          <h1 className="j2-serif-display j2-heading-glow" style={{ fontSize: 72, margin: 0 }}>
            Your focus, week by week.
          </h1>
          <div className="j2-serif-italic" style={{ marginTop: 14, fontSize: 22 }}>
            Every week since you started — what you chose to work on.
          </div>
        </div>
        {intentionsEnabled && (
          <button
            onClick={onOpenCreate}
            style={{
              height: 54, padding: '0 28px',
              background: '#DA7422', color: '#fff',
              fontWeight: 600, borderRadius: 12,
              boxShadow: '0 0 0 1px rgba(218,116,34,0.3), 0 10px 24px -12px rgba(218,116,34,0.6)',
              transition: 'background 180ms ease',
              display: 'inline-flex', alignItems: 'center', gap: 12,
              fontSize: 16, cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E8823A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#DA7422'; }}
          >
            ◇ {activeIntention ? 'Adjust focus' : "Set this week's focus"}
          </button>
        )}
      </div>

      {!intentionsEnabled && (
        <div
          style={{
            background: 'var(--j2-surface-2)',
            border: '1px solid var(--j2-border-1)',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 14,
            color: 'rgba(255,255,255,0.40)',
            marginBottom: 24,
          }}
        >
          Intentions are currently disabled — viewing history only.
        </div>
      )}

      {intentions.length === 0 ? (
        <DesktopEmpty onStart={() => onNavigate('/home')} />
      ) : (
        <>
          {/* ── Current-week hero ──────────────────────────── */}
          {activeIntention && (
            <CurrentIntentionHero
              intention={activeIntention}
              sessions={sessions}
              onEdit={() => onOpenEdit(activeIntention)}
              onOpenJournal={() => onNavigate(`/intentions/${activeIntention.id}/journal`)}
            />
          )}

          {/* ── History grouped by year ─────────────────────── */}
          {byYear.map(([year, items]) => (
            <div key={year} style={{ marginBottom: 52 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 22, marginBottom: 22 }}>
                <div className="j2-serif-display" style={{ fontSize: 48 }}>{year}</div>
                <div className="j2-label-micro">
                  {items.length} {items.length === 1 ? 'week' : 'weeks'}
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(4, items.length)}, 1fr)`,
                  gap: 16,
                }}
              >
                {items.map(i => (
                  <HistoryCard
                    key={i.id}
                    intention={i}
                    sessions={sessions}
                    onOpenJournal={() => onNavigate(`/intentions/${i.id}/journal`)}
                    onEdit={() => onOpenEdit(i)}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Modals */}
      {(createOpen || editTarget) && (
        <SetIntentionModal
          editIntention={editTarget ?? undefined}
          onSaved={() => { onSaved(); onCloseModal(); }}
          onClose={onCloseModal}
        />
      )}
    </div>
    </PageContent>
  );
}

// ── Current-week hero card ────────────────────────────────────────────────

function CurrentIntentionHero({
  intention, sessions, onEdit, onOpenJournal,
}: {
  intention: Intention;
  sessions: SessionSummary[];
  onEdit: () => void;
  onOpenJournal: () => void;
}) {
  const heading = intention.heading
    ? (SKILL_TAGS.find(t => t.value === intention.heading)?.label ?? intention.heading)
    : intention.intent_label;
  const subtitle = intention.intent_label
    && intention.intent_label.trim().toLowerCase() !== (heading ?? '').toLowerCase()
    ? intention.intent_label
    : null;

  const topTag = topTagInRange(sessions, intention.week_start, intention.duration_days);
  const hours = tagHoursInRange(sessions, intention.week_start, intention.duration_days);
  const alignment = computeAlignment(intention, topTag, hours);
  const alignmentScore = alignment.score ?? 0;

  return (
    <div
      style={{
        backgroundColor: CARD_BG,
        border: `1px solid ${CARD_GLOW_BORDER}`,
        boxShadow: CARD_GLOW,
        borderRadius: 20,
        padding: 48,
        display: 'grid',
        gridTemplateColumns: '1fr 460px',
        gap: 52,
        alignItems: 'center',
        marginBottom: 52,
      }}
    >
      <div>
        <div className="j2-label-copper" style={{ marginBottom: 14 }}>◇ This week</div>
        <div className="j2-serif-display" style={{ fontSize: 96, lineHeight: 1 }}>
          {heading ?? 'Focus'}
        </div>
        {subtitle && (
          <div
            className="j2-serif-italic"
            style={{ fontSize: 22, color: 'rgba(255,255,255,0.60)', marginTop: 12 }}
          >
            {subtitle}
          </div>
        )}

        {/* Alignment bar */}
        <div style={{ marginTop: 40, maxWidth: 520 }}>
          <div
            style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.40)', marginBottom: 10,
            }}
          >
            <span>Alignment so far</span>
            <span>
              {alignment.status === 'no-data' ? '—' : `${alignmentScore}%`}
            </span>
          </div>
          <div
            style={{
              height: 10,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 5,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${alignment.status === 'no-data' ? 0 : alignmentScore}%`,
                height: '100%',
                background:
                  alignment.status === 'aligned'  ? 'linear-gradient(90deg, #A8CB72, #F2E4A8 60%, #C4915F)' :
                  alignment.status === 'diverged' ? 'linear-gradient(90deg, #DA7422, #C4915F)' :
                                                    'rgba(255,255,255,0.12)',
                boxShadow: alignment.status === 'aligned' ? '0 0 14px rgba(242,228,168,0.4)' : 'none',
                transition: 'width 700ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 14, marginTop: 40 }}>
          <button
            onClick={onOpenJournal}
            style={{
              height: 50, padding: '0 22px',
              background: 'var(--j2-surface-3)',
              color: 'rgba(255,255,255,0.90)',
              border: '1px solid var(--j2-border-2)',
              borderRadius: 12,
              fontWeight: 500, fontSize: 15,
              cursor: 'pointer',
            }}
          >
            {intention.journal_entry ? 'Open journal' : 'Write an entry'}
          </button>
          <button
            onClick={onEdit}
            style={{
              height: 50, padding: '0 22px',
              background: 'transparent',
              color: COPPER,
              border: '1px solid rgba(196,145,95,0.35)',
              borderRadius: 12,
              fontWeight: 500, fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Edit
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <MiniPrism activeTag={intention.heading ?? null} size={380} />
      </div>
    </div>
  );
}

// ── History card ──────────────────────────────────────────────────────────

function HistoryCard({
  intention, sessions, onOpenJournal, onEdit,
}: {
  intention: Intention;
  sessions: SessionSummary[];
  onOpenJournal: () => void;
  onEdit: () => void;
}) {
  const heading = intention.heading
    ? (SKILL_TAGS.find(t => t.value === intention.heading)?.label ?? intention.heading)
    : intention.intent_label || 'Focus';
  const accentColor = intention.heading
    ? (SKILL_COLORS[intention.heading]?.stroke ?? COPPER)
    : COPPER;

  const topTag = topTagInRange(sessions, intention.week_start, intention.duration_days);
  const hours = tagHoursInRange(sessions, intention.week_start, intention.duration_days);
  const alignment = computeAlignment(intention, topTag, hours);
  const alignmentScore = alignment.score ?? 0;
  const weekStart = new Date(intention.week_start.slice(0, 10) + 'T00:00:00');

  return (
    <div
      style={{
        padding: 22,
        background: 'var(--j2-surface-2)',
        border: '1px solid var(--j2-border-1)',
        borderRadius: 14,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Corner halo in pillar color */}
      <div
        aria-hidden
        style={{
          position: 'absolute', top: 0, right: 0, width: 84, height: 84,
          background: `radial-gradient(circle at 100% 0%, ${accentColor}30, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.40)',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        Wk of {MONTH_NAMES[weekStart.getMonth()]} {weekStart.getDate()}
      </div>
      <div
        style={{
          fontSize: 23,
          fontFamily: FONT_EDITORIAL,
          fontWeight: 600,
          color: PALE_YELLOW,
          marginTop: 10,
        }}
      >
        {heading}
      </div>

      {/* Alignment row */}
      <div
        style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 18,
        }}
      >
        <div
          style={{
            flex: 1,
            height: 5,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 3,
            marginRight: 14,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${alignment.status === 'no-data' ? 0 : alignmentScore}%`,
              height: '100%',
              background: accentColor,
              borderRadius: 3,
            }}
          />
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.40)',
            letterSpacing: '0.1em',
            minWidth: 44,
            textAlign: 'right',
          }}
        >
          {alignment.status === 'no-data' ? '—' : `${alignmentScore}%`}
        </div>
      </div>

      {/* Footer row — journal link + edit */}
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 20, paddingTop: 14,
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <button
          onClick={onOpenJournal}
          style={{
            fontSize: 13, fontWeight: 600,
            color: intention.journal_entry ? 'rgba(242,228,168,0.45)' : COPPER,
            background: 'transparent', padding: 0, cursor: 'pointer',
          }}
        >
          {intention.journal_entry ? 'Read entry' : '+ Write'}
        </button>
        <button
          onClick={onEdit}
          style={{
            color: 'rgba(255,255,255,0.25)',
            background: 'transparent', padding: 0, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center',
          }}
          title="Edit intention"
        >
          <Pencil size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────

function DesktopEmpty({ onStart }: { onStart: () => void }) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_GLOW_BORDER}`,
        boxShadow: CARD_GLOW,
        borderRadius: 16,
        padding: '60px 32px',
        textAlign: 'center',
        maxWidth: 560,
        margin: '40px auto',
      }}
    >
      <h2 className="j2-serif-display" style={{ fontSize: 32, margin: 0 }}>No intentions yet.</h2>
      <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.60)', lineHeight: 1.6, marginTop: 10 }}>
        Declare what you&rsquo;re working on — each week, each pivot. It&rsquo;ll live here
        as a log of what your training has been <em>about</em>, not just what it was.
      </p>
      <button
        onClick={onStart}
        style={{
          marginTop: 20,
          height: 44, padding: '0 22px',
          background: '#DA7422', color: '#fff',
          fontWeight: 600, borderRadius: 10,
          boxShadow: '0 10px 24px -12px rgba(218,116,34,0.6)',
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Set your first intention
      </button>
    </div>
  );
}
