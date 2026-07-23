import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { api } from '../lib/api.ts';
import { PALE_YELLOW, GLOW_SOFT, SURFACE_2, SURFACE_3, COPPER, FONT_EDITORIAL } from '../lib/theme.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { useProfile } from '../context/ProfileContext.tsx';
import { CATEGORY_COLORS, SKILL_TAGS, MONTH_NAMES, REFLECTION_PROMPTS } from '../lib/constants.ts';
import { formatDuration, INTENSITY_COLOR } from '../lib/sessionUtils.ts';
import { vibrate } from '../lib/haptics.ts';
import type { Intention, IntentionsResponse, SessionSummary, SessionsResponse, IntentionCompletionType, UserTag } from '../types/api.ts';
import { useUserTags } from '../hooks/useUserTags.ts';
import PageContent from '../components/PageContent.tsx';
import SessionDetailModal from '../components/SessionDetailModal.tsx';
import SegmentedToggle from '../components/SegmentedToggle.tsx';
import { formatWeekLong } from '../lib/analyticsUtils.ts';
import { measureLines } from '../lib/pretextMeasure.ts';

export default function JournalEntryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const { intentionsEnabled } = useProfile();
  const { byId: userTagById } = useUserTags();

  // Origin tracking — where did the user come from?
  const origin = (location.state as { from?: string } | null)?.from ?? '/intentions';
  const originLabel = origin === '/home' ? 'Home' : 'Intentions';

  const [intention, setIntention] = useState<Intention | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // True when the last save was queued offline rather than confirmed by the
  // server. Drives the distinct "Saved on this device" status copy.
  const [savedOffline, setSavedOffline] = useState(false);
  const [error, setError] = useState('');

  // Inline edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const [editHeading, setEditHeading] = useState<string | null>(null);
  const [editDuration, setEditDuration] = useState(7);
  const [editCompletionType, setEditCompletionType] = useState<IntentionCompletionType>('days');
  const [editTarget, setEditTarget] = useState(4);
  const [editSaving, setEditSaving] = useState(false);
  const saveTimeout  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const textInitialized = useRef(false);

  // Inscribe reveal — when an existing entry loads, animate it line-by-line
  // (using Pretext-measured wrap points) before handing the textarea over.
  // Skipped for empty entries, reduced-motion users, and re-fetches.
  // `revealComplete` starts false: textarea is hidden until we know whether
  // there's anything to reveal (avoids a flash of full text on first paint).
  const [revealLines, setRevealLines] = useState<string[] | null>(null);
  const [revealComplete, setRevealComplete] = useState(false);
  const [revealStagger, setRevealStagger] = useState(120);
  const journalCardRef = useRef<HTMLDivElement | null>(null);
  const [journalCardWidth, setJournalCardWidth] = useState(0);
  useEffect(() => {
    const el = journalCardRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setJournalCardWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fetchIntention = useCallback(async () => {
    try {
      const data = await api.get<IntentionsResponse>('/api/intentions');
      const found = (data.intentions ?? []).find(i => i.id === id) ?? null;
      setIntention(found);
      // Only initialize text on first load — preserve in-progress edits on re-fetch
      if (found?.journal_entry && !textInitialized.current) {
        setText(found.journal_entry);
        textInitialized.current = true;
        // Trigger inscribe reveal unless reduced-motion is on. The reveal-line
        // measurement runs in a useEffect once journalCardWidth is known.
        const reduceMotion = typeof window !== 'undefined'
          && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) {
          setRevealComplete(true);
        }
        // Else: revealComplete stays false; useEffect below will schedule completion.
      } else {
        // No entry to reveal — textarea is interactive immediately.
        setRevealComplete(true);
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
      // Don't leave the textarea trapped behind a never-firing reveal
      setRevealComplete(true);
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

  // When the reveal has been requested AND the card width is known, measure
  // the prose into wrapped lines and schedule the completion timeout.
  useEffect(() => {
    if (revealComplete) return;
    if (!text || journalCardWidth <= 0) return;
    // Card has px-5 (20px each side) → prose width = card width - 40px.
    const lines = measureLines({
      text,
      width: Math.max(40, journalCardWidth - 40),
      font: "14px 'Plus Jakarta Sans', system-ui, sans-serif",
      lineHeight: 14 * 1.625,
    }).lines;
    setRevealLines(lines);
    // Stagger formula: 40ms floor, 150ms ceiling, scales inversely with line
    // count so total reveal duration stays within ~2.5s for long entries.
    const stagger = Math.min(150, Math.max(40, Math.round(2400 / Math.max(1, lines.length))));
    setRevealStagger(stagger);
    const total = lines.length * stagger + 280 + 200; // last-line settle + breath
    const t = setTimeout(() => setRevealComplete(true), total);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealComplete, journalCardWidth, text]);

  // Safety fallback — if reveal hasn't completed 2s after text loads, force it
  useEffect(() => {
    if (revealComplete || !text) return;
    const fallback = setTimeout(() => setRevealComplete(true), 2000);
    return () => clearTimeout(fallback);
  }, [revealComplete, text]);

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
      const data = await api.patch(`/api/intentions/${id}/journal`, { journal_entry: entry });
      // Mirror LogSessionForm / CaptureComposer: api.patch() resolves with a
      // synthetic `_offline` payload (it never throws) when the write was
      // parked in the IndexedDB queue instead of reaching the server. Reporting
      // a bare "Saved" there tells the user their entry is safe on the server
      // when it is still only on this device — surface the distinction so they
      // know to stay signed in until it syncs.
      const queuedOffline = (data as unknown as { _offline?: boolean })?._offline === true;
      setSavedOffline(queuedOffline);
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

  const openEdit = () => {
    if (!intention) return;
    setEditLabel(intention.intent_label ?? '');
    setEditHeading(intention.heading);
    setEditDuration(intention.duration_days ?? 7);
    setEditCompletionType(intention.completion_type ?? 'days');
    setEditTarget(intention.target_count ?? 4);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!intention) return;
    setEditSaving(true);
    try {
      const targetCount = editCompletionType === 'sessions' ? editTarget
        : editCompletionType === 'training_weeks' ? editTarget
        : null;
      await api.patch(`/api/intentions/${intention.id}`, {
        intent_label: editLabel.trim() || null,
        heading: editHeading,
        duration_days: editDuration,
        completion_type: editCompletionType,
        target_count: targetCount,
      });
      setEditOpen(false);
      fetchIntention();
    } catch {
      setError('Failed to update focus.');
    } finally {
      setEditSaving(false);
    }
  };

  const categoryColor = intention?.intent_category
    ? (CATEGORY_COLORS[intention.intent_category] ?? 'rgba(255,255,255,0.4)')
    : null;

  // Daily reflection prompt — same index calc as the old Path Ahead card so a
  // user who reloaded across pages on the same day saw a stable prompt.
  const todayIdx = Math.floor(Date.now() / 86_400_000);
  const reflectionPrompt = REFLECTION_PROMPTS[todayIdx % REFLECTION_PROMPTS.length];

  return (
    <PageContent ready={!loading} loadingMessages={['Loading your intentions...']}>
    {!intention ? (
      <div className={`mx-auto py-6 ${isDesktop ? 'max-w-3xl px-8' : 'max-w-2xl px-4 sm:px-6'}`}>
        <p className="text-sm text-error">Intention not found.</p>
        <button
          onClick={() => navigate(origin)}
          className="mt-4 text-sm transition-colors"
          style={{ color: 'rgba(255,255,255,0.40)' }}
        >
          ← Back to {originLabel}
        </button>
      </div>
    ) : (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

      {/* Back */}
      <button
        onClick={() => navigate(origin)}
        className="text-sm flex items-center gap-1.5 transition-colors touch-manipulation"
        style={{ color: 'rgba(255,255,255,0.40)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {originLabel}
      </button>

      {/* Header — editorial chrome matching IntentionHeroCard. Promotes the
          intention from inline page text to a real card surface: copper-tinted
          bg + border, radial champagne highlight, ◇ kicker, serif title, and
          italic dek when intent_label adds info beyond the pillar heading. */}
      {(() => {
        const focusLabel = intention.heading
          ? (SKILL_TAGS.find(s => s.value === intention.heading)?.label ?? intention.heading)
          : intention.intent_label;
        const showDek = !!intention.intent_label
          && !!focusLabel
          && intention.intent_label.trim().toLowerCase() !== focusLabel.toLowerCase();

        return (
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              padding: '18px 20px',
              borderRadius: 14,
              background: 'rgba(196,145,95,0.04)',
              border: '1px solid rgba(196,145,95,0.22)',
            }}
          >
            {/* Radial champagne highlight from the top-right */}
            <div
              aria-hidden
              style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(circle at 100% 0%, rgba(242,228,168,0.08), transparent 60%)',
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="j2-label-copper" style={{ marginBottom: 8 }}>
                ◇ Intention
              </div>
              <h2
                className="j2-serif-display"
                style={{
                  fontSize: 26,
                  lineHeight: 1.15,
                  color: PALE_YELLOW,
                  textShadow: GLOW_SOFT,
                  letterSpacing: '-0.005em',
                  margin: 0,
                }}
              >
                {focusLabel}
              </h2>
              {showDek && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 14,
                    color: 'rgba(255,255,255,0.60)',
                    fontStyle: 'italic',
                    lineHeight: 1.4,
                  }}
                >
                  {intention.intent_label}
                </div>
              )}
              {/* Status row — small-caps metadata under the title */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 12,
                  flexWrap: 'wrap',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.40)',
                }}
              >
                <span>{formatWeekLong(intention.week_start)}</span>
                {categoryColor && (
                  <>
                    <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                    <span
                      className="capitalize"
                      style={{
                        padding: '3px 10px',
                        borderRadius: 999,
                        background: `${categoryColor}20`,
                        color: categoryColor,
                        letterSpacing: '0.08em',
                      }}
                    >
                      {intention.intent_category}
                    </span>
                  </>
                )}
                <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                <span>{intention.duration_days}d intention</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Technique chips — copper-tinted tags linking to /techniques/:id */}
      {(() => {
        const resolvedTags = (intention.user_tag_ids ?? [])
          .map(id => userTagById.get(id))
          .filter((t): t is UserTag => !!t);
        if (resolvedTags.length === 0) return null;
        return (
          <div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase' as const,
                color: 'rgba(255,255,255,0.28)',
              }}
            >
              Techniques
            </span>
            <div className="flex flex-wrap gap-1.5" style={{ marginTop: 6 }}>
              {resolvedTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => navigate(`/techniques/${tag.id}`)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium touch-manipulation"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    color: 'rgba(196,145,95,0.70)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Edit focus — inline collapsible section */}
      {intentionsEnabled && !editOpen && (
        <button
          onClick={openEdit}
          className="touch-manipulation"
          style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 15, color: COPPER, opacity: 0.6, background: 'none', border: 'none', borderBottom: '1px solid rgba(196,145,95,0.25)', cursor: 'pointer', padding: 0, display: 'block' }}
        >
          Edit focus →
        </button>
      )}

      {editOpen && (
        <div style={{ borderBottom: '1px solid rgba(196,145,95,0.08)', paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
              Edit Focus
            </span>
            <button onClick={() => setEditOpen(false)} style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
          </div>

          {/* Label */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', display: 'block', marginBottom: 4 }}>
              What specifically? <span style={{ color: 'rgba(255,255,255,0.20)' }}>(optional)</span>
            </label>
            <input
              type="text"
              maxLength={20}
              value={editLabel}
              onChange={e => setEditLabel(e.target.value)}
              placeholder="e.g. Waiter Guard, Berimbolo"
              style={{ width: '100%', fontSize: 14, padding: '10px 12px', borderRadius: 10, backgroundColor: SURFACE_3, border: '1px solid rgba(255,255,255,0.08)', color: 'white', outline: 'none' }}
            />
          </div>

          {/* Completion mode */}
          <div style={{ marginBottom: 12 }}>
            <SegmentedToggle<IntentionCompletionType>
              size="compact"
              options={[
                { value: 'days', label: 'Days' },
                { value: 'sessions', label: 'Sessions' },
                { value: 'training_weeks', label: 'Weeks' },
              ]}
              value={editCompletionType}
              onChange={v => v && setEditCompletionType(v)}
            />
          </div>

          {/* Duration / target */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(editCompletionType === 'days'
              ? [3, 5, 7, 14]
              : editCompletionType === 'sessions'
                ? [3, 4, 6, 8, 12]
                : [2, 3, 4, 6, 8]
            ).map(n => {
              const val = editCompletionType === 'days' ? editDuration : editTarget;
              const active = val === n;
              return (
                <button
                  key={n}
                  onClick={() => { vibrate(8); editCompletionType === 'days' ? setEditDuration(n) : setEditTarget(n); }}
                  className="flex-1 touch-manipulation"
                  style={{
                    height: 34, borderRadius: 8, fontSize: 13, fontWeight: 600,
                    backgroundColor: active ? COPPER : SURFACE_3,
                    color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  {editCompletionType === 'days' ? `${n}d` : n}
                </button>
              );
            })}
          </div>

          {/* Save */}
          <button
            onClick={saveEdit}
            disabled={editSaving}
            className="touch-manipulation disabled:opacity-50"
            style={{ fontFamily: FONT_EDITORIAL, fontWeight: 700, fontStyle: 'normal', fontSize: 16, color: PALE_YELLOW, textShadow: GLOW_SOFT, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {editSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}

      {/* Reflection prompt — daily rotating question. Lives here (instead of
          on Path Ahead, where it used to) because journaling is when it's
          actually useful. */}
      <div
        className="rounded-xl px-5 py-4"
        style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}
      >
        <p
          className="text-[10px] font-semibold uppercase tracking-widest mb-2"
          style={{ color: COPPER }}
        >
          ◇ Reflection
        </p>
        <p
          className="text-sm italic leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.75)' }}
        >
          &ldquo;{reflectionPrompt}&rdquo;
        </p>
      </div>

      {/* Journal card */}
      <div
        ref={journalCardRef}
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

        {/* Inscribe reveal overlay — line-by-line fade-up of the saved entry,
            shown only on initial load with content. Sits in the same flex slot
            as the textarea; the textarea is hidden via opacity until reveal
            completes, then we cross-fade to it. */}
        <div style={{ position: 'relative' }}>
          {!revealComplete && revealLines && revealLines.length > 0 && (
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none text-sm leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.75)' }}
            >
              {revealLines.map((line, i) => (
                <span
                  key={i}
                  style={{
                    display: 'block',
                    opacity: 0,
                    animation: `j2InscribeLine 280ms cubic-bezier(0.16, 1, 0.3, 1) ${i * revealStagger}ms forwards`,
                  }}
                >
                  {line || '\u00A0'}
                </span>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={text}
            onChange={intentionsEnabled ? handleChange : undefined}
            readOnly={!intentionsEnabled || !revealComplete}
            placeholder="Describe the context and goals of your training intentions this week..."
            className="w-full bg-transparent resize-none outline-none text-sm leading-relaxed placeholder-white/20"
            style={{
              minHeight: 200,
              height: 'auto',
              color: 'rgba(255,255,255,0.75)',
              cursor: intentionsEnabled && revealComplete ? 'text' : 'default',
              opacity: revealComplete ? 1 : 0,
              transition: 'opacity 240ms ease',
            }}
            autoFocus={intentionsEnabled && revealComplete}
          />
        </div>
      </div>

      {/* Save area */}
      {intentionsEnabled && (
        <div className="flex items-center justify-between">
          <span
            className="text-xs"
            style={{ color: savedOffline && !saving ? COPPER : 'rgba(255,255,255,0.25)' }}
          >
            {saving
              ? 'Saving...'
              : saved
                ? (savedOffline ? 'Saved on this device — will sync when online' : 'Saved')
                : ''}
          </span>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-error">{error}</span>}
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
          intention={{ intent_label: intention.intent_label, intent_category: intention.intent_category, heading: intention.heading }}
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
