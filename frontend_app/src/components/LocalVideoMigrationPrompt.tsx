// LocalVideoMigrationPrompt — one-time prompt for users with pre-mig-028
// clips still living only in OPFS. Detects orphans (OPFS blobs whose
// corresponding user_tag has no video_storage_key set), shows a modal
// summarising the byte total, and uploads them sequentially through the
// new cloud pipeline when the user agrees.
//
// Lifecycle:
//   • Mounts inside MovesLibraryPage.
//   • On mount: check localStorage flag, scan OPFS, match against tags.
//     If candidates exist AND user hasn't been prompted, show modal.
//   • Continue → sequential upload via useUserTags.attachVideo. Each
//     completed upload flips its tag's video_status to 'processing'; the
//     transcode worker handles the rest asynchronously.
//   • Skip / Continue both set the localStorage flag so we never re-prompt.
//
// Note: even after dismissal, the user can still play their local clips
// (VideoPlayer in VideoBlock tries OPFS first). The prompt is about elevating
// them to cloud-resident; declining doesn't break anything immediately.

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { listVideoIds, loadVideo } from '../lib/videoStore.ts';
import { CARD_BG, COPPER, PALE_YELLOW, GLOW_SOFT, TEXT_SECONDARY } from '../lib/theme.ts';
import { formatBytes } from '../lib/videoUtils.ts';
import type { UserTag } from '../types/api.ts';

const PROMPTED_FLAG_KEY = 'j2-cloud-migration-prompted';

interface Props {
  /** All user_tags from the parent's useUserTags hook. */
  tags: UserTag[];
  /** The hook's attachVideo helper — drives each migration. */
  attachVideo: (id: string, file: File) => Promise<UserTag | null>;
}

interface Candidate {
  tag: UserTag;
  blob: Blob;
  /** Best-effort filename for File construction; doesn't have to match the original. */
  fileName: string;
}

export default function LocalVideoMigrationPrompt({ tags, attachVideo }: Props) {
  // Three states: 'checking' (scanning OPFS), 'visible' (modal shown),
  // 'uploading' (sequential pump in progress), 'dismissed' (collapsed).
  const [phase, setPhase] = useState<'checking' | 'visible' | 'uploading' | 'dismissed'>('checking');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [progressIdx, setProgressIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Index tags by id for fast match against OPFS keys.
  const tagsById = useMemo(() => {
    const m = new Map<string, UserTag>();
    for (const t of tags) m.set(t.id, t);
    return m;
  }, [tags]);

  // Scan OPFS once on mount. Match against tags lacking a video_storage_key
  // — these are the local-only orphans we need to elevate.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Already prompted? Skip silently.
      if (typeof localStorage !== 'undefined' && localStorage.getItem(PROMPTED_FLAG_KEY) === '1') {
        if (!cancelled) setPhase('dismissed');
        return;
      }

      // Need tags loaded before we can identify candidates.
      if (tags.length === 0) {
        if (!cancelled) setPhase('dismissed');
        return;
      }

      try {
        const ids = await listVideoIds();
        const found: Candidate[] = [];
        for (const id of ids) {
          const tag = tagsById.get(id);
          if (!tag) continue; // orphan blob, not associated with any current tag
          // Skip tags already cloud-resident.
          if (tag.video_storage_key) continue;
          // Skip tags currently mid-upload / mid-encode (we don't want to race).
          if (tag.video_status === 'processing') continue;

          const blob = await loadVideo(id);
          if (!blob) continue;
          found.push({
            tag,
            blob,
            fileName: `${tag.name.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40)}.mp4`,
          });
        }
        if (cancelled) return;

        if (found.length === 0) {
          // Nothing to migrate. Set the flag so we skip the scan next time.
          localStorage.setItem(PROMPTED_FLAG_KEY, '1');
          setPhase('dismissed');
          return;
        }

        setCandidates(found);
        setPhase('visible');
      } catch (err) {
        // Quiet — don't block the user with a migration error.
        console.error('Migration scan failed:', err);
        if (!cancelled) setPhase('dismissed');
      }
    })();
    return () => { cancelled = true; };
  }, [tags, tagsById]);

  const totalBytes = useMemo(
    () => candidates.reduce((sum, c) => sum + c.blob.size, 0),
    [candidates],
  );

  const dismiss = useCallback(() => {
    localStorage.setItem(PROMPTED_FLAG_KEY, '1');
    setPhase('dismissed');
  }, []);

  const upload = useCallback(async () => {
    setPhase('uploading');
    setProgressIdx(0);
    setError(null);
    for (let i = 0; i < candidates.length; i++) {
      setProgressIdx(i);
      const c = candidates[i]!;
      const file = new File([c.blob], c.fileName, { type: c.blob.type || 'video/mp4' });
      const result = await attachVideo(c.tag.id, file);
      if (!result) {
        // Failure — surface the error and stop. User can re-trigger by
        // clearing the localStorage flag and reloading; or we could add a
        // retry button later. For V1, stop and dismiss.
        setError(`Failed on "${c.tag.name}". The remaining ${candidates.length - i - 1} clip${candidates.length - i - 1 === 1 ? '' : 's'} will stay local for now.`);
        break;
      }
    }
    localStorage.setItem(PROMPTED_FLAG_KEY, '1');
    // Brief moment to show the final progress state, then collapse.
    setTimeout(() => setPhase('dismissed'), 1200);
  }, [candidates, attachVideo]);

  if (phase === 'checking' || phase === 'dismissed') return null;

  const modal = (
    <div
      onClick={phase === 'uploading' ? undefined : dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        backgroundColor: 'rgba(13,26,20,0.92)',
        backdropFilter: 'blur(12px) saturate(1.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="animate-j2-modal-in"
        style={{
          width: '100%', maxWidth: 480,
          backgroundColor: CARD_BG,
          border: '1px solid rgba(196,145,95,0.22)',
          borderRadius: 16,
          padding: '24px 22px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Radial champagne highlight, matching IntentionHeroCard register */}
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 100% 0%, rgba(242,228,168,0.06), transparent 60%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="j2-label-copper" style={{ marginBottom: 8 }}>◇ Move to cloud</div>
          <h2
            className="j2-serif-display"
            style={{
              fontSize: 22,
              lineHeight: 1.2,
              color: PALE_YELLOW,
              textShadow: GLOW_SOFT,
              margin: 0,
              marginBottom: 10,
            }}
          >
            {phase === 'uploading'
              ? `Uploading… (${Math.min(progressIdx + 1, candidates.length)} of ${candidates.length})`
              : `Back up your library across devices?`}
          </h2>
          <p style={{ fontSize: 14, color: TEXT_SECONDARY, lineHeight: 1.55, margin: 0 }}>
            {phase === 'uploading' ? (
              error ? error : (
                <>Uploading <strong style={{ color: PALE_YELLOW }}>{candidates[progressIdx]?.tag.name}</strong>… each clip transcodes in the background after upload. You can close this and keep using the app.</>
              )
            ) : (
              <>You have <strong style={{ color: PALE_YELLOW }}>{candidates.length}</strong> local clip{candidates.length === 1 ? '' : 's'} ({formatBytes(totalBytes)}) that aren't backed up across devices. Upload now and they'll play on every device you sign in to.</>
            )}
          </p>

          {phase === 'visible' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void upload()}
                className="j2-press touch-manipulation"
                style={{
                  flex: '1 1 auto',
                  minHeight: 44,
                  padding: '10px 18px',
                  borderRadius: 10,
                  background: COPPER,
                  border: 'none',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 14,
                  letterSpacing: '0.01em',
                  cursor: 'pointer',
                }}
              >
                Upload {candidates.length} clip{candidates.length === 1 ? '' : 's'}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="j2-press touch-manipulation"
                style={{
                  flex: '0 0 auto',
                  minHeight: 44,
                  padding: '10px 18px',
                  borderRadius: 10,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.14)',
                  color: TEXT_SECONDARY,
                  fontWeight: 500,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Maybe later
              </button>
            </div>
          )}

          {phase === 'uploading' && (
            <div style={{ marginTop: 22 }}>
              {/* Progress bar */}
              <div
                aria-hidden
                style={{
                  height: 4,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.round(((progressIdx + (error ? 0 : 1)) / Math.max(1, candidates.length)) * 100)}%`,
                    height: '100%',
                    background: COPPER,
                    transition: 'width 320ms ease',
                  }}
                />
              </div>
              {error && (
                <button
                  type="button"
                  onClick={dismiss}
                  className="j2-press touch-manipulation"
                  style={{
                    marginTop: 16,
                    minHeight: 40,
                    padding: '8px 16px',
                    borderRadius: 10,
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.14)',
                    color: TEXT_SECONDARY,
                    fontWeight: 500,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
