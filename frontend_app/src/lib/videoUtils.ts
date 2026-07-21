// videoUtils — process video Blobs before saving to the Move Library.
//
// All functions work off a Blob so they're agnostic to the source — camera
// capture (`<input capture>`), file picker, or future drag-drop.

const MAX_BYTES = 50 * 1024 * 1024;   // 50MB hard cap on a single clip
const MAX_DURATION = 60;              // 60s hard cap (server allows up to 600)
const THUMB_TARGET_PX = 320;          // longest edge — keeps data URL small
const THUMB_QUALITY = 0.7;            // JPEG quality
const THUMB_FRAME_TIME = 0.1;         // seconds — grab right after start to avoid black frame

export interface VideoValidation {
  valid: boolean;
  reason?: string;
}

/** Lightweight pre-flight check — file size + extension only. Duration check requires probeVideo(). */
export function validateVideoFile(file: File): VideoValidation {
  if (!file.type.startsWith('video/')) {
    return { valid: false, reason: 'Not a video file.' };
  }
  if (file.size > MAX_BYTES) {
    return { valid: false, reason: `Too large (${Math.round(file.size / 1_048_576)}MB > ${MAX_BYTES / 1_048_576}MB cap).` };
  }
  return { valid: true };
}

export interface ProbeResult {
  durationSeconds: number;
  width: number;
  height: number;
}

/**
 * Load enough of the video to read duration and dimensions.
 * Uses a hidden <video> element + 'loadedmetadata' event.
 */
export function probeVideo(blob: Blob): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const cleanup = () => {
      video.src = '';
      URL.revokeObjectURL(url);
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Video metadata probe timed out (corrupt file?).'));
    }, 10_000);

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      const result: ProbeResult = {
        durationSeconds: isFinite(video.duration) ? video.duration : 0,
        width: video.videoWidth,
        height: video.videoHeight,
      };
      cleanup();
      if (result.durationSeconds > MAX_DURATION) {
        reject(new Error(`Clip is ${Math.round(result.durationSeconds)}s — max is ${MAX_DURATION}s.`));
        return;
      }
      resolve(result);
    };
    video.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error("Couldn't read video — file may be corrupt or in an unsupported format."));
    };
    video.src = url;
  });
}

/**
 * Extract a thumbnail JPEG (data URL) from the video's first painted frame.
 * Resizes the longest edge to THUMB_TARGET_PX. Returns ~5–15KB JPEG strings.
 *
 * Why this is more involved than "set currentTime, draw on seeked":
 *
 * On iOS Safari (especially as an installed PWA) `currentTime = X` does NOT
 * reliably materialise a paintable frame. The decoder needs `play()` to start
 * producing frames; without it, `seeked` may never fire and the whole thing
 * hangs until the master timeout. The flow below is the production-grade
 * pattern used by video.js / plyr / similar:
 *
 *   1. Wait for `loadeddata` (frame 0 decoded — stronger guarantee than
 *      `loadedmetadata`, which only means container headers parsed).
 *   2. Subscribe to `requestVideoFrameCallback` if available — fires only
 *      when a frame has actually painted. Most reliable signal.
 *   3. Briefly `play()` the muted video. This primes the decoder on iOS so
 *      the first frame is paintable.
 *   4. Fall back to a double-rAF after `play()` resolves on browsers without
 *      rVFC.
 *   5. If `play()` rejects (rare autoplay-policy edge case), fall back to a
 *      seek-then-draw with its own short timeout. Last-resort: draw whatever
 *      is currently on the video element — frame 0 is a fine thumbnail.
 *
 * All paths funnel through `finish()` which short-circuits on a `settled`
 * flag, so racing events can't double-resolve / double-reject.
 */
export function extractThumbnail(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    // Older iOS only honours the lowercase HTML attribute, not the JS property
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');

    let settled = false;

    const cleanup = () => {
      try { video.pause(); } catch { /* ignore */ }
      video.removeAttribute('src');
      try { video.load(); } catch { /* ignore */ }
      URL.revokeObjectURL(url);
    };

    const finish = (kind: 'ok' | 'err', value: string | Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (kind === 'ok') resolve(value as string);
      else reject(value as Error);
    };

    const drawAndFinish = () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w === 0 || h === 0) {
          finish('err', new Error('Video frames not yet decoded — please try again.'));
          return;
        }

        const longest = Math.max(w, h);
        const scale = longest > THUMB_TARGET_PX ? THUMB_TARGET_PX / longest : 1;
        const targetW = Math.round(w * scale);
        const targetH = Math.round(h * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish('err', new Error('Could not get canvas 2D context.'));
          return;
        }
        ctx.drawImage(video, 0, 0, targetW, targetH);

        finish('ok', canvas.toDataURL('image/jpeg', THUMB_QUALITY));
      } catch (err) {
        finish('err', err instanceof Error ? err : new Error('Could not render thumbnail.'));
      }
    };

    // Master timeout — covers slow phones with large clips even after the
    // iOS-priming path is fixed. 30s is long enough that we'd only hit it on
    // a genuinely broken file or device.
    const masterTimeout = setTimeout(() => {
      finish('err', new Error('Thumbnail extraction timed out.'));
    }, 30_000);
    void masterTimeout; // referenced only for cleanup-via-finish()

    // ── Primary path: loadeddata → play() → first painted frame ─────────
    video.addEventListener('loadeddata', async () => {
      // Subscribe to first painted frame BEFORE play() so we don't miss it.
      // Cast through unknown — `requestVideoFrameCallback` lands in newer
      // lib.dom.d.ts versions but isn't yet typed in the one we're on.
      const rvfc = (video as unknown as {
        requestVideoFrameCallback?: (cb: () => void) => number;
      }).requestVideoFrameCallback;

      if (rvfc) {
        rvfc.call(video, () => {
          if (!settled) drawAndFinish();
        });
      }

      try {
        // The iOS-specific bit: play() primes the decoder so a frame is
        // actually paintable. Muted + playsInline keeps autoplay policy happy.
        await video.play();

        if (!rvfc) {
          // No rVFC — wait two rAFs to guarantee a paint cycle has completed
          // (one rAF can fire before the very first paint on some browsers).
          requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!settled) drawAndFinish();
          }));
        }
      } catch (playErr) {
        // play() rejected (rare — strict autoplay policy). Fall back to the
        // seek-then-draw path with its own sub-timeout; if even that doesn't
        // fire, draw whatever is on the element so the user gets *something*.
        try {
          video.currentTime = Math.min(THUMB_FRAME_TIME, (video.duration || 1) * 0.05);
        } catch { /* setting currentTime can throw on some readyStates */ }

        const seekTimeout = setTimeout(() => {
          if (!settled) drawAndFinish();
        }, 8_000);

        video.addEventListener('seeked', () => {
          clearTimeout(seekTimeout);
          if (!settled) drawAndFinish();
        }, { once: true });

        // Surface the original error if both fallbacks somehow fail.
        void playErr;
      }
    }, { once: true });

    video.addEventListener('error', () => {
      finish('err', new Error("Couldn't decode video — file may be corrupt or in an unsupported format."));
    }, { once: true });

    video.src = url;
    // Some iOS versions need an explicit load() to actually begin fetching
    // after src assignment in a programmatically-created element.
    try { video.load(); } catch { /* ignore */ }
  });
}

/** Format duration seconds as "M:SS" — for display under thumbnails. */
export function formatDurationMMSS(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/** Format bytes as human-friendly string. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1_048_576).toFixed(1)}MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)}GB`;
}
