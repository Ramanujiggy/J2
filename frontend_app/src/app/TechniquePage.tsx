// TechniquePage — the per-technique "Pokedex" page (`/techniques/:id`).
//
// Migration 027 surface. Lab-notebook + memory-book in one place:
//   • Title + pillar + ★ affinity badge
//   • Optional video clip (Move Library — Tier 1, mig 010)
//   • "How to do it" — editable video_notes (the lab notebook half)
//   • Resonance — cumulative journal, autosave on blur (the memory book half)
//   • Affinity chip row — go_to / learning / shelved / clear
//   • Sessions logged with this technique — derived from training_sessions.user_tag_ids
//   • Cross-ref: other techniques in the same pillar
//
// Editorial chrome matches IntentionHeroCard / SessionDetailModal: copper-tinted
// card surfaces, ◇ kickers, serif display titles, italic deks where helpful.
//
// Mobile (< 1024px): single-column stack ordered for "give me the gist fast" —
//   hero+affinity → video → How to → Resonance → Sessions → cross-ref. Affinity
//   sits with the hero so it's a one-tap commitment, not buried below the
//   journal. Session rows are tappable → SessionDetailModal.
//
// Desktop (≥ 1024px): two-column split modeled on PathAheadPage's layout
//   register — sticky 360px left rail (hero + video + affinity + cross-ref)
//   beside a wide right column (How to + Resonance + Sessions). The left rail
//   gives the user persistent context (the video they're describing, their
//   judgement on the move) while the right column is the writing surface.
//
// Forward-looking note: legacy sessions that referenced a canonical position
// directly (`canonical_position_ids`) won't appear in the session list here
// because the link is via `user_tag_ids` only. Acceptable per the migration
// plan — every future session lands cleanly in the user_tag bucket once the
// promote-on-pick flow runs.

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { api } from '../lib/api.ts';
import PageContent from '../components/PageContent.tsx';
import VideoPlayer from '../components/VideoPlayer.tsx';
import SessionDetailModal from '../components/SessionDetailModal.tsx';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import {
  PALE_YELLOW, GLOW_SOFT, COPPER, CARD_BG, SURFACE_2,
} from '../lib/theme.ts';
import { formatDurationMMSS } from '../lib/videoUtils.ts';
import { useUserTags } from '../hooks/useUserTags.ts';
import type { SessionSummary, SessionsResponse, Affinity, Pillar, UserTag } from '../types/api.ts';

const PILLAR_LABELS: Record<Pillar, string> = {
  standup: 'Stand-up',
  passing: 'Passing',
  pins: 'Pins',
  submissions: 'Subs',
  guard: 'Guard',
};

// One-year session window — covers virtually every Pokedex use case without
// paying the cost of the full archive. Tunable.
const SESSION_LOOKBACK_DAYS = 365;

// Cap the cross-pillar list so the rail doesn't get tall. Five reads as
// "here are some neighbours" without becoming its own table of contents.
const CROSS_REF_LIMIT = 6;

interface AffinityOption { value: Affinity; label: string; glyph: string; description: string; }

const AFFINITY_OPTIONS: readonly AffinityOption[] = [
  { value: 'go_to',    glyph: '★', label: 'Go-to',    description: 'Works for me' },
  { value: 'learning', glyph: '◐', label: 'Learning', description: 'Working on it' },
  { value: 'shelved',  glyph: '◌', label: 'Shelved',  description: 'Not for me / not now' },
] as const;

function relativeTime(ms: number): string {
  if (ms < 60_000)  return 'just now';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

export default function TechniquePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const {
    byId, tagsByPillar, loading: tagsLoading, error: hookError,
    setAffinity, setResonance, patchVideoMeta,
    attachVideo, detachVideo, retryEncode, refetch,
  } = useUserTags();

  const tag = id ? byId.get(id) ?? null : null;

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [openSession, setOpenSession] = useState<SessionSummary | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Local draft state for the autosave-on-blur textareas. Mirrors the saved
  // value but lets the textarea be edited without round-tripping every keystroke.
  const [resonanceDraft, setResonanceDraft] = useState('');
  const [howToDraft, setHowToDraft] = useState('');
  const [resonanceSavedAt, setResonanceSavedAt] = useState<number | null>(null);
  const [howToSavedAt, setHowToSavedAt] = useState<number | null>(null);
  const [savedTick, setSavedTick] = useState(0); // forces re-render for ".saved Xs ago"

  // Re-sync drafts whenever the tag identity changes (e.g. navigating between
  // techniques). Don't reset on every render of the same tag — that would
  // clobber in-flight typing.
  const lastTagIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!tag) return;
    if (lastTagIdRef.current !== tag.id) {
      setResonanceDraft(tag.resonance_journal ?? '');
      setHowToDraft(tag.video_notes ?? '');
      setResonanceSavedAt(null);
      setHowToSavedAt(null);
      lastTagIdRef.current = tag.id;
    }
  }, [tag]);

  // Tick once a second so the ".saved Xs ago" indicators stay live. Cheap.
  useEffect(() => {
    const i = setInterval(() => setSavedTick(t => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  // ── Sessions linked to this technique ────────────────────────────────────
  useEffect(() => {
    if (!tag) return;
    let cancelled = false;
    (async () => {
      setSessionsLoading(true);
      try {
        const from = new Date(Date.now() - SESSION_LOOKBACK_DAYS * 86_400_000)
          .toISOString().slice(0, 10);
        const to   = new Date(Date.now() + 5 * 86_400_000)
          .toISOString().slice(0, 10);
        const res = await api.get<SessionsResponse>(`/api/sessions?from=${from}&to=${to}`);
        if (cancelled) return;
        const linked = (res.sessions ?? [])
          .filter(s => Array.isArray(s.user_tag_ids) && s.user_tag_ids.includes(tag.id))
          .sort((a, b) => b.date.localeCompare(a.date));
        setSessions(linked);
      } catch {
        // Quiet — the page still works without the session list, just shows nothing
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tag]);

  const lastDrilledDate = useMemo(
    () => sessions[0]?.date ?? null,
    [sessions],
  );

  // Cross-ref list: other techniques in the same pillar. Free derivation
  // from useUserTags.tagsByPillar — sort go-to first, then alpha; cap.
  const otherInPillar = useMemo<UserTag[]>(() => {
    if (!tag) return [];
    const peers = tagsByPillar[tag.parent_pillar] ?? [];
    const affinityRank = (a: Affinity | null | undefined): number =>
      a === 'go_to' ? 0 : a === 'learning' ? 1 : a === 'shelved' ? 3 : 2;
    return peers
      .filter(t => t.id !== tag.id)
      .sort((a, b) => {
        const ar = affinityRank(a.affinity);
        const br = affinityRank(b.affinity);
        if (ar !== br) return ar - br;
        return a.name.localeCompare(b.name);
      })
      .slice(0, CROSS_REF_LIMIT);
  }, [tag, tagsByPillar]);

  // ── Save handlers (autosave on blur) ─────────────────────────────────────
  const onResonanceBlur = useCallback(async () => {
    if (!tag) return;
    const next = resonanceDraft.trim();
    const cur = (tag.resonance_journal ?? '').trim();
    if (next === cur) return;
    await setResonance(tag.id, next.length > 0 ? next : null);
    setResonanceSavedAt(Date.now());
  }, [tag, resonanceDraft, setResonance]);

  const onHowToBlur = useCallback(async () => {
    if (!tag) return;
    const next = howToDraft.trim();
    const cur = (tag.video_notes ?? '').trim();
    if (next === cur) return;
    await patchVideoMeta(tag.id, { video_notes: next.length > 0 ? next : null });
    setHowToSavedAt(Date.now());
  }, [tag, howToDraft, patchVideoMeta]);

  const onAffinityClick = useCallback(async (next: Affinity | null) => {
    if (!tag) return;
    if (tag.affinity === next) return; // no-op
    await setAffinity(tag.id, next);
  }, [tag, setAffinity]);

  // Video attach / replace / remove. Both attach and detach run through the
  // useUserTags pipeline which handles thumbnail extraction + local storage +
  // server PATCH; we just toggle the local uploading state for UI feedback.
  // Upload progress 0-100; null when no upload in flight.
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);

  const onAttachFile = useCallback(async (file: File) => {
    if (!tag) return;
    setUploadingVideo(true);
    setUploadPercent(0);
    try {
      await attachVideo(tag.id, file, (p) => setUploadPercent(p.percent));
    } finally {
      setUploadingVideo(false);
      setUploadPercent(null);
    }
  }, [tag, attachVideo]);

  const onRemoveVideo = useCallback(async () => {
    if (!tag) return;
    if (!confirm(`Remove the video from "${tag.name}"?`)) return;
    setUploadingVideo(true);
    try {
      await detachVideo(tag.id);
    } finally {
      setUploadingVideo(false);
    }
  }, [tag, detachVideo]);

  const onRetryEncode = useCallback(async () => {
    if (!tag) return;
    await retryEncode(tag.id);
  }, [tag, retryEncode]);

  // ── Status polling — while video_status='processing', re-fetch the tag's
  // playback URL every 5s. The endpoint is fast and includes the latest
  // status; when it flips to 'ready' or 'failed', we refetch the whole
  // user_tags list so the local row reflects the new state.
  useEffect(() => {
    if (!tag) return;
    if (tag.video_status !== 'processing') return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await api.get<{ status: string | null }>(`/api/user-tags/${tag.id}/video/url`);
        if (cancelled) return;
        if (res.status !== 'processing') {
          // Status changed — refetch the full tag list so the row updates.
          await refetch();
        }
      } catch {
        // Quiet — next tick will retry.
      }
    };
    const interval = setInterval(() => { void poll(); }, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [tag, refetch]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (tagsLoading) {
    return (
      <PageContent ready={false} loadingMessages={['Loading the technique...']}>
        <div />
      </PageContent>
    );
  }

  if (!tag) {
    return (
      <PageContent ready={true}>
        <div className="mx-auto max-w-2xl px-4 py-10 text-center">
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16 }}>
            Technique not found.
          </p>
          <button
            onClick={() => navigate('/library')}
            className="mt-4 text-sm"
            style={{ color: COPPER, textDecoration: 'underline' }}
          >
            Back to Technique Library
          </button>
        </div>
      </PageContent>
    );
  }

  // ── Section renderers — declared inline so they share scope (drafts, handlers).
  // Reused in both the mobile single-column stack and the desktop two-column grid.

  const heroBlock = (
    <Hero
      tag={tag}
      lastDrilledDate={lastDrilledDate}
      sessionsCount={sessions.length}
      onAffinityClick={onAffinityClick}
    />
  );

  const videoBlock = (
    <VideoBlock
      tag={tag}
      uploading={uploadingVideo}
      uploadPercent={uploadPercent}
      uploadError={hookError}
      onAttachFile={onAttachFile}
      onRemoveVideo={onRemoveVideo}
      onRetryEncode={onRetryEncode}
    />
  );

  const affinityBlockLarge = (
    <SectionCard kicker="◇ Affinity">
      <AffinityRow current={tag.affinity ?? null} onPick={onAffinityClick} />
    </SectionCard>
  );

  const howToBlock = (
    <SectionCard kicker="◇ How to do it" subtitle="Key details — grip, frame, common mistake to avoid.">
      <textarea
        value={howToDraft}
        onChange={e => setHowToDraft(e.target.value.slice(0, 1000))}
        onBlur={() => void onHowToBlur()}
        placeholder="Notes the technique itself, not the session…"
        rows={4}
        className="w-full"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.85)',
          fontSize: 14,
          lineHeight: 1.55,
          outline: 'none',
          resize: 'vertical',
          minHeight: 90,
          padding: 0,
        }}
      />
      {howToSavedAt && (
        <SavedIndicator savedAt={howToSavedAt} tick={savedTick} />
      )}
    </SectionCard>
  );

  const resonanceBlock = (
    <SectionCard
      kicker="◇ Resonance"
      subtitle="How this technique feels for you. Breakthroughs, sticking points, the moments worth remembering."
    >
      <textarea
        value={resonanceDraft}
        onChange={e => setResonanceDraft(e.target.value.slice(0, 5000))}
        onBlur={() => void onResonanceBlur()}
        placeholder="Tell the story of you and this move…"
        rows={isDesktop ? 10 : 6}
        className="w-full"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.88)',
          fontSize: 15,
          lineHeight: 1.6,
          outline: 'none',
          resize: 'vertical',
          minHeight: isDesktop ? 220 : 140,
          padding: 0,
          fontStyle: resonanceDraft ? 'normal' : 'italic',
        }}
      />
      <div
        style={{
          marginTop: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
        }}
      >
        <span style={{ color: 'rgba(255,255,255,0.30)' }}>
          {resonanceDraft.length} / 5000
        </span>
        {resonanceSavedAt && (
          <SavedIndicator savedAt={resonanceSavedAt} tick={savedTick} />
        )}
      </div>
    </SectionCard>
  );

  const sessionsBlock = (
    <SectionCard kicker="◇ Sessions logged with this">
      <SessionList
        loading={sessionsLoading}
        sessions={sessions}
        onOpen={s => setOpenSession(s)}
      />
    </SectionCard>
  );

  const crossRefBlock = otherInPillar.length > 0 ? (
    <SectionCard kicker={`◇ Other ${PILLAR_LABELS[tag.parent_pillar]} techniques`}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {otherInPillar.map(peer => (
          <li key={peer.id}>
            <button
              onClick={() => navigate(`/techniques/${peer.id}`)}
              className="j2-press touch-manipulation"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 0',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                textAlign: 'left',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.80)',
                fontSize: 14,
              }}
            >
              <AffinityGlyph value={peer.affinity ?? null} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {peer.name}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>→</span>
            </button>
          </li>
        ))}
      </ul>
    </SectionCard>
  ) : null;

  // ── Layouts ───────────────────────────────────────────────────────────────

  return (
    <PageContent ready={true}>
      {isDesktop ? (
        // ─── Desktop: two-column grid ──────────────────────────────────────
        // Left rail (sticky, 360px): hero + video + affinity + cross-ref.
        // Right column (1fr): How to + Resonance + Sessions.
        // Mirrors PathAheadPage's `j2-page-container` register.
        <div className="j2-page-container" style={{ paddingTop: 32, paddingBottom: 64 }}>
          <button
            onClick={() => navigate('/library')}
            className="text-sm flex items-center gap-1 mb-4 transition-colors touch-manipulation"
            style={{ color: 'rgba(255,255,255,0.50)' }}
          >
            <ChevronLeft size={14} />
            Technique Library
          </button>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '360px 1fr',
              gap: 36,
              alignItems: 'flex-start',
            }}
          >
            {/* Left rail — sticky context. */}
            <div
              style={{
                position: 'sticky',
                top: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              {heroBlock}
              {videoBlock}
              {affinityBlockLarge}
              {crossRefBlock}
            </div>

            {/* Right column — writing surface. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
              {howToBlock}
              {resonanceBlock}
              {sessionsBlock}
            </div>
          </div>
        </div>
      ) : (
        // ─── Mobile: single-column stack ───────────────────────────────────
        // Order matches "give me the gist fast" — affinity sits with the
        // hero (one-tap commitment), cross-ref drops to the bottom because
        // it's a navigation aid, not the primary use of the page.
        <div
          className="mx-auto max-w-3xl px-4 sm:px-6"
          style={{ paddingTop: 24, paddingBottom: 48 }}
        >
          <button
            onClick={() => navigate('/library')}
            className="text-xs flex items-center gap-1 mb-4 transition-colors touch-manipulation"
            style={{ color: 'rgba(255,255,255,0.50)' }}
          >
            <ChevronLeft size={14} />
            Technique Library
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {heroBlock}
            {videoBlock}
            {affinityBlockLarge}
            {howToBlock}
            {resonanceBlock}
            {sessionsBlock}
            {crossRefBlock}
          </div>
        </div>
      )}

      {/* Session detail modal — opened from a session-list row tap */}
      {openSession && (
        <SessionDetailModal
          session={openSession}
          date={new Date(openSession.date.slice(0, 10) + 'T00:00:00')}
          onClose={() => setOpenSession(null)}
          onSaved={() => { setOpenSession(null); /* sessions list will refetch on tag change; leave as-is for V1 */ }}
          onDeleted={() => {
            setOpenSession(null);
            // Drop the deleted session from the local list so the count + ordering update.
            setSessions(prev => prev.filter(s => s.id !== openSession.id));
          }}
        />
      )}
    </PageContent>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Hero({
  tag, lastDrilledDate, sessionsCount, onAffinityClick,
}: {
  tag: UserTag;
  lastDrilledDate: string | null;
  sessionsCount: number;
  onAffinityClick: (next: Affinity | null) => void;
}) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '20px 22px 18px',
        borderRadius: 16,
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
        <div className="j2-label-copper" style={{ marginBottom: 8 }}>◇ Technique</div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <h1
            className="j2-serif-display"
            style={{
              fontSize: 28,
              lineHeight: 1.1,
              color: PALE_YELLOW,
              textShadow: GLOW_SOFT,
              letterSpacing: '-0.005em',
              margin: 0,
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {tag.name}
          </h1>
          {tag.affinity && <AffinityBadge value={tag.affinity} />}
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.40)',
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span>{PILLAR_LABELS[tag.parent_pillar]}</span>
          {lastDrilledDate && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.18)' }}>·</span>
              <span>Last drilled {formatDate(lastDrilledDate)}</span>
            </>
          )}
          {sessionsCount > 0 && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.18)' }}>·</span>
              <span>{sessionsCount} session{sessionsCount === 1 ? '' : 's'}</span>
            </>
          )}
        </div>

        {/* Inline affinity quick-set — sits with the hero so a "Dang, I like
            this" tap doesn't require scrolling to a section below the journal. */}
        <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {AFFINITY_OPTIONS.map(opt => {
            const active = tag.affinity === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onAffinityClick(active ? null : opt.value)}
                aria-pressed={active}
                title={opt.description}
                className="j2-press touch-manipulation"
                style={{
                  height: 32,
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 999,
                  background: active ? 'rgba(196,145,95,0.20)' : 'rgba(255,255,255,0.04)',
                  border: active ? `1px solid ${COPPER}` : '1px solid rgba(255,255,255,0.10)',
                  color: active ? PALE_YELLOW : 'rgba(255,255,255,0.65)',
                  cursor: 'pointer',
                  transition: 'all 160ms ease',
                  letterSpacing: '0.02em',
                }}
              >
                <span style={{ color: active ? COPPER : 'rgba(255,255,255,0.55)' }}>{opt.glyph}</span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VideoBlock({
  tag,
  uploading,
  uploadPercent,
  uploadError,
  onAttachFile,
  onRemoveVideo,
  onRetryEncode,
}: {
  tag: UserTag;
  uploading: boolean;
  uploadPercent: number | null;
  uploadError: string | null;
  onAttachFile: (file: File) => void;
  onRemoveVideo: () => void;
  onRetryEncode: () => void;
}) {
  const inputId = `video-pokedex-${tag.id}`;
  const [isPlaying, setIsPlaying] = useState(false);
  // Sticky / mini-player state — true when the inline slot is fully out of
  // viewport during playback. Watched via IntersectionObserver below.
  const [stuck, setStuck] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);
  const hasReadyVideo = !!tag.has_video && tag.video_status === 'ready' && !!tag.video_thumbnail;
  const isProcessing = !!tag.has_video && tag.video_status === 'processing';
  const isFailed     = !!tag.has_video && tag.video_status === 'failed';

  // Auto-close the inline player when the underlying tag stops being ready
  // (e.g. user hit Remove during playback, encode regressed to failed).
  useEffect(() => {
    if (isPlaying && !hasReadyVideo) setIsPlaying(false);
  }, [isPlaying, hasReadyVideo]);

  // Sticky mini-player: when the slot scrolls out of view while playing,
  // flip `stuck` so the player wrapper repositions itself fixed-bottom-right.
  // The <video> element itself doesn't remount, so playback is uninterrupted.
  useEffect(() => {
    if (!isPlaying) {
      setStuck(false);
      return;
    }
    const slot = slotRef.current;
    if (!slot) return;
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry) setStuck(!entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(slot);
    return () => observer.disconnect();
  }, [isPlaying]);
  // Show the thumbnail during processing too — extracted client-side at
  // upload time, so users see something the moment they finish uploading
  // rather than waiting through 15-30s of encode time staring at a blank box.
  const showThumb = (hasReadyVideo || isProcessing || isFailed) && !!tag.video_thumbnail;

  // Saving overlay copy: progress percent during upload, "Encoding…" once
  // the upload completes and the worker takes over.
  const overlayCopy = uploading
    ? (uploadPercent != null && uploadPercent < 100 ? `Saving ${uploadPercent}%…` : 'Saving…')
    : isProcessing
      ? 'Encoding…'
      : null;

  return (
    <div
      style={{
        background: CARD_BG,
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div ref={slotRef} style={{ position: 'relative' }}>
      {isPlaying && hasReadyVideo ? (
        <>
          {/* Placeholder while the player is in its sticky mini state.
              Holds the slot's 16/9 dimensions so the page doesn't reflow
              and gives the user a visual marker of where the player will
              return when they scroll back. */}
          {stuck && tag.video_thumbnail && (
            <div
              style={{
                width: '100%',
                aspectRatio: '16 / 9',
                background: `url(${tag.video_thumbnail}) center / cover no-repeat, ${SURFACE_2}`,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.06)',
                opacity: 0.55,
              }}
            />
          )}
          <VideoPlayer
            tag={tag}
            onClose={() => setIsPlaying(false)}
            stuck={stuck}
          />
        </>
      ) : showThumb ? (
        <button
          onClick={() => { if (hasReadyVideo) setIsPlaying(true); }}
          disabled={uploading || isProcessing || isFailed}
          className="w-full j2-press touch-manipulation"
          style={{
            display: 'block',
            width: '100%',
            aspectRatio: '16 / 9',
            background: `url(${tag.video_thumbnail}) center / cover no-repeat, ${SURFACE_2}`,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.06)',
            position: 'relative',
            cursor: hasReadyVideo ? 'pointer' : 'wait',
          }}
        >
          {/* Play badge — only visible when the video is actually playable. */}
          {hasReadyVideo && !uploading && (
            <span
              aria-hidden
              style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 52, height: 52, borderRadius: '50%',
                background: 'rgba(0,0,0,0.50)',
                border: '1.5px solid rgba(255,255,255,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{ color: '#fff', fontSize: 17, marginLeft: 4 }}>▶</span>
            </span>
          )}
          {tag.video_duration_seconds != null && (
            <span
              style={{
                position: 'absolute', right: 8, bottom: 8,
                fontSize: 11, fontWeight: 600,
                padding: '2px 8px', borderRadius: 4,
                background: 'rgba(0,0,0,0.65)', color: '#fff',
              }}
            >
              {formatDurationMMSS(tag.video_duration_seconds)}
            </span>
          )}
          {/* State overlay — saving / encoding / failed. */}
          {(overlayCopy || isFailed) && (
            <span
              style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.65)',
                borderRadius: 10,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 6,
                color: COPPER, fontSize: 13, fontWeight: 600,
                textAlign: 'center', padding: 12,
              }}
            >
              {isFailed ? (
                <>
                  <span style={{ color: 'rgba(218,90,70,0.85)' }}>Encoding failed</span>
                  {tag.video_status_message && (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 400, maxWidth: 280, lineHeight: 1.4 }}>
                      {tag.video_status_message.length > 140
                        ? tag.video_status_message.slice(0, 140) + '…'
                        : tag.video_status_message}
                    </span>
                  )}
                </>
              ) : (
                <span>{overlayCopy}</span>
              )}
            </span>
          )}
        </button>
      ) : (
        <label
          htmlFor={inputId}
          className="j2-press touch-manipulation"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            aspectRatio: '16 / 9',
            background: SURFACE_2,
            border: '1px dashed rgba(196,145,95,0.30)',
            borderRadius: 10,
            color: COPPER,
            fontSize: 14,
            fontWeight: 600,
            padding: 12,
            textAlign: 'center',
            cursor: uploading ? 'wait' : 'pointer',
            transition: 'border-color 160ms ease, background 160ms ease',
          }}
        >
          {uploading ? (
            <span style={{ color: COPPER }}>{overlayCopy ?? 'Saving…'}</span>
          ) : (
            <>
              <span style={{ fontSize: 22 }}>+</span>
              <span>Add video</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', fontWeight: 500, fontStyle: 'italic' }}>
                Up to 60s, ≤50MB
              </span>
            </>
          )}
        </label>
      )}
      </div>

      {/* Hidden input — drives both the empty-state Add Video CTA and the
          Replace button below. iOS Safari's three-way sheet handles
          camera-vs-library disambiguation natively (no `capture` attribute). */}
      <input
        id={inputId}
        type="file"
        accept="video/*"
        className="hidden"
        disabled={uploading}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onAttachFile(f);
          e.target.value = ''; // allow re-picking the same file
        }}
      />

      {/* Replace / Retry / Remove row — surfaces when a video exists in any
          state (ready / processing / failed). Retry only when failed.
          Replace is always available; Remove always available when a video
          exists at all (even mid-encode the user can bail out). */}
      {(hasReadyVideo || isProcessing || isFailed) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
            flexWrap: 'wrap',
          }}
        >
          {isFailed && (
            <button
              type="button"
              onClick={onRetryEncode}
              disabled={uploading}
              className="j2-press touch-manipulation"
              style={{
                fontSize: 12, fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(196,145,95,0.18)',
                border: `1px solid ${COPPER}`,
                color: COPPER,
                cursor: uploading ? 'wait' : 'pointer',
              }}
            >
              Retry encode
            </button>
          )}
          <label
            htmlFor={inputId}
            className="j2-press touch-manipulation"
            style={{
              fontSize: 12, fontWeight: 600,
              padding: '6px 12px',
              borderRadius: 8,
              background: SURFACE_2,
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.75)',
              cursor: uploading ? 'wait' : 'pointer',
              opacity: uploading ? 0.5 : 1,
            }}
          >
            Replace
          </label>
          <button
            type="button"
            onClick={onRemoveVideo}
            disabled={uploading}
            className="j2-press touch-manipulation"
            style={{
              fontSize: 12, fontWeight: 500,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid transparent',
              color: 'rgba(218,90,70,0.65)',
              cursor: uploading ? 'wait' : 'pointer',
            }}
          >
            Remove
          </button>
        </div>
      )}

      {/* Error surface — useUserTags exposes a global error string; render it
          here when the upload pipeline fails (validation, quota, codec, etc.). */}
      {uploadError && (
        <p
          style={{
            marginTop: 10,
            fontSize: 12,
            color: 'rgba(218,90,70,0.85)',
            lineHeight: 1.4,
          }}
        >
          {uploadError}
        </p>
      )}

      {/* Video notes — per-clip annotation, kept visible during playback so
          the user can cross-reference notes while watching. Previously
          lived inside the modal that this inline player replaces. */}
      {tag.video_notes && (
        <div
          style={{
            marginTop: 12,
            background: SURFACE_2,
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 10,
            padding: '12px 14px',
          }}
        >
          <p
            className="j2-label-copper"
            style={{ marginBottom: 6 }}
          >
            ◇ Notes
          </p>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              color: 'rgba(255,255,255,0.70)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {tag.video_notes}
          </p>
        </div>
      )}
    </div>
  );
}

function SectionCard({
  kicker,
  subtitle,
  children,
}: {
  kicker: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: CARD_BG,
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: '18px 20px',
      }}
    >
      <div className="j2-label-copper" style={{ marginBottom: subtitle ? 6 : 12 }}>{kicker}</div>
      {subtitle && (
        <p
          style={{
            margin: '0 0 14px',
            fontSize: 12.5,
            color: 'rgba(255,255,255,0.45)',
            fontStyle: 'italic',
            lineHeight: 1.45,
          }}
        >
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}

// Affinity badge — the rounded pill displayed next to the title.
function AffinityBadge({ value }: { value: Affinity }) {
  const opt = AFFINITY_OPTIONS.find(o => o.value === value);
  if (!opt) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 999,
        background: 'rgba(196,145,95,0.14)',
        color: COPPER,
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}
    >
      <span aria-hidden>{opt.glyph}</span>
      {opt.label}
    </span>
  );
}

// Tiny inline glyph for cross-ref rows (peer techniques in the same pillar).
// Uses a fixed-width slot so unset tags align with set ones.
function AffinityGlyph({ value }: { value: Affinity | null }) {
  const color =
    value === 'go_to' ? COPPER :
    value === 'learning' ? 'rgba(196,145,95,0.65)' :
    value === 'shelved' ? 'rgba(255,255,255,0.30)' :
    'transparent';
  const glyph =
    value === 'go_to' ? '★' :
    value === 'learning' ? '◐' :
    value === 'shelved' ? '◌' : '·';
  return (
    <span
      aria-hidden
      style={{
        width: 14,
        textAlign: 'center',
        fontSize: 12,
        color,
      }}
    >
      {glyph}
    </span>
  );
}

// The full affinity chip row used inside the explicit "◇ Affinity" section.
// Kept distinct from the inline quick-set in the hero — this version surfaces
// each option's description + adds an explicit Clear action.
function AffinityRow({
  current,
  onPick,
}: {
  current: Affinity | null;
  onPick: (next: Affinity | null) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {AFFINITY_OPTIONS.map(opt => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onPick(opt.value)}
            className="j2-press touch-manipulation"
            style={{
              height: 38,
              padding: '0 14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 10,
              background: active ? 'rgba(196,145,95,0.18)' : 'transparent',
              border: active ? `1px solid ${COPPER}` : '1px solid rgba(255,255,255,0.12)',
              color: active ? PALE_YELLOW : 'rgba(255,255,255,0.65)',
              cursor: 'pointer',
              transition: 'all 160ms ease',
            }}
          >
            <span style={{ color: active ? COPPER : 'rgba(255,255,255,0.55)' }}>{opt.glyph}</span>
            <span>{opt.label}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', fontWeight: 500 }}>
              {opt.description}
            </span>
          </button>
        );
      })}
      {current && (
        <button
          onClick={() => onPick(null)}
          className="j2-press touch-manipulation"
          style={{
            height: 38,
            padding: '0 14px',
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 10,
            background: 'transparent',
            border: '1px solid transparent',
            color: 'rgba(255,255,255,0.40)',
            cursor: 'pointer',
          }}
        >
          — Clear
        </button>
      )}
    </div>
  );
}

// Session list — every row is a button that opens SessionDetailModal. Drops
// the placeholder em-dash for empty notes so the column doesn't turn into
// visual noise; condenses to 3 columns on rows without notes.
function SessionList({
  loading,
  sessions,
  onOpen,
}: {
  loading: boolean;
  sessions: SessionSummary[];
  onOpen: (s: SessionSummary) => void;
}) {
  if (loading) {
    return (
      <p style={{ color: 'rgba(255,255,255,0.40)', fontSize: 13, fontStyle: 'italic' }}>
        Loading…
      </p>
    );
  }
  if (sessions.length === 0) {
    return (
      <p style={{ color: 'rgba(255,255,255,0.40)', fontSize: 13, fontStyle: 'italic' }}>
        No sessions logged with this technique yet — pick it next time you train.
      </p>
    );
  }
  return (
    <ul style={{ display: 'flex', flexDirection: 'column', gap: 0, listStyle: 'none', padding: 0, margin: 0 }}>
      {sessions.map(s => (
        <li key={s.id}>
          <SessionRow session={s} onOpen={() => onOpen(s)} />
        </li>
      ))}
    </ul>
  );
}

function SessionRow({ session, onOpen }: { session: SessionSummary; onOpen: () => void }) {
  const hasNote = !!session.notes && session.notes.trim().length > 0;
  return (
    <button
      onClick={onOpen}
      className="j2-press touch-manipulation"
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '12px 0',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          flexWrap: 'wrap',
          rowGap: 4,
        }}
      >
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
          {formatDate(session.date)}
        </span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontVariantNumeric: 'tabular-nums' }}>
          {formatDuration(session.duration)}
        </span>
        <span
          className="capitalize"
          style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)',
          }}
        >
          {session.session_type.replace('_', ' ')}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>→</span>
      </div>
      {hasNote && (
        <span
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.55)',
            fontStyle: 'italic',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
          }}
        >
          &ldquo;{session.notes!.slice(0, 120)}{session.notes!.length > 120 ? '…' : ''}&rdquo;
        </span>
      )}
    </button>
  );
}

function SavedIndicator({ savedAt, tick }: { savedAt: number; tick: number }) {
  // `tick` is unused inside but its prop change forces a re-render every second
  // so the relativeTime stays fresh without a per-component ticker.
  void tick;
  const ago = Date.now() - savedAt;
  return (
    <span
      style={{
        fontSize: 11,
        color: 'rgba(196,145,95,0.65)',
        letterSpacing: '0.04em',
        fontStyle: 'italic',
      }}
    >
      .saved {relativeTime(ago)}
    </span>
  );
}
