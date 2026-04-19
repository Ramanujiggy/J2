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
 * Extract a thumbnail JPEG (data URL) from the video's first non-black frame.
 * Resizes the longest edge to THUMB_TARGET_PX. Returns ~5–15KB JPEG strings.
 */
export function extractThumbnail(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    const cleanup = () => {
      video.src = '';
      URL.revokeObjectURL(url);
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Thumbnail extraction timed out.'));
    }, 15_000);

    video.onloadedmetadata = () => {
      // Seek slightly past 0 to skip the leading black frame some encoders insert
      video.currentTime = Math.min(THUMB_FRAME_TIME, (video.duration || 1) * 0.05);
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w === 0 || h === 0) throw new Error('Video has no dimensions.');

        const longest = Math.max(w, h);
        const scale = longest > THUMB_TARGET_PX ? THUMB_TARGET_PX / longest : 1;
        const targetW = Math.round(w * scale);
        const targetH = Math.round(h * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas 2D context.');
        ctx.drawImage(video, 0, 0, targetW, targetH);

        const dataUrl = canvas.toDataURL('image/jpeg', THUMB_QUALITY);
        cleanup();
        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error("Couldn't extract thumbnail — file may be corrupt."));
    };

    video.src = url;
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
