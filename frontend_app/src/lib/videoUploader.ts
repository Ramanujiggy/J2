// videoUploader — XHR-based PUT to R2 with byte-progress callback.
//
// Why XHR not fetch: fetch() doesn't expose upload progress in browsers.
// XHR has had `xhr.upload.onprogress` for over a decade. Wrapping it in a
// Promise gives the rest of the codebase a clean async surface while still
// reporting bytes-transferred for the "Saving 47%…" UI.
//
// The R2 endpoint accepts a direct PUT with the Content-Type the server
// signed for. No auth header on this request — the signature in the URL
// query string is the auth.

export interface UploadProgress {
    /** Bytes transferred so far. */
    loaded: number;
    /** Total bytes (file size). */
    total: number;
    /** 0..1 fraction. */
    fraction: number;
    /** 0..100 percent (rounded). */
    percent: number;
}

export type UploadProgressCallback = (progress: UploadProgress) => void;

/**
 * PUT a Blob to a pre-signed R2 URL. Resolves on HTTP 2xx, rejects with the
 * status + body otherwise. Reports progress events at the byte level so the
 * UI can show a percentage.
 *
 * Note: the abort path uses the AbortSignal API to cancel the upload mid-
 * flight (e.g. when the user navigates away). On abort the Promise rejects
 * with a DOMException of name "AbortError" — callers can recognize and
 * handle silently.
 */
export function uploadToR2(
    uploadUrl: string,
    blob: Blob,
    contentType: string,
    onProgress?: UploadProgressCallback,
    signal?: AbortSignal,
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', contentType);

        if (onProgress) {
            xhr.upload.onprogress = (e: ProgressEvent) => {
                if (!e.lengthComputable) return;
                const loaded = e.loaded;
                const total = e.total;
                const fraction = total > 0 ? loaded / total : 0;
                onProgress({
                    loaded,
                    total,
                    fraction,
                    percent: Math.round(fraction * 100),
                });
            };
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                // Final 100% callback so the UI can flip to "Encoding…"
                // cleanly even if the last progress event already fired.
                if (onProgress) {
                    onProgress({ loaded: blob.size, total: blob.size, fraction: 1, percent: 100 });
                }
                resolve();
            } else {
                reject(new Error(`R2 upload failed: HTTP ${xhr.status} ${xhr.statusText}\n${xhr.responseText.slice(0, 500)}`));
            }
        };

        xhr.onerror = () => {
            reject(new Error('R2 upload failed: network error.'));
        };
        xhr.ontimeout = () => {
            reject(new Error('R2 upload timed out.'));
        };
        xhr.onabort = () => {
            reject(new DOMException('Upload aborted by user.', 'AbortError'));
        };

        // Wire AbortSignal → xhr.abort()
        if (signal) {
            if (signal.aborted) {
                xhr.abort();
                return;
            }
            signal.addEventListener('abort', () => xhr.abort(), { once: true });
        }

        xhr.send(blob);
    });
}
