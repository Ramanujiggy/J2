// transcode — ffmpeg invocation wrapper for the Move Library v2 worker.
//
// Shells out to `/usr/bin/ffmpeg` via child_process.spawn. ffmpeg is installed
// on Railway's container by `nixpacks.toml` (apt: ffmpeg). For local dev,
// install with Homebrew on macOS / apt on Linux / Chocolatey on Windows.
//
// One preset, hits the full compatibility matrix:
//   • H.264 (libx264) at CRF 23, preset fast — H.264 plays on every modern
//     browser. Fast preset gives ~10-20s encode for a 60s 1080p clip on
//     Railway-class CPU.
//   • AAC at 128kbps — universal audio compatibility, plenty for voice/ambient.
//   • -movflags +faststart — moves the moov atom to the front so the browser
//     can start playing before the full file downloads. Critical for streamed
//     <video> playback.
//   • -vf scale='min(1080,iw)':-2 — caps width at 1080p, preserves aspect,
//     -2 ensures even height (libx264 requires it).
//   • -max_muxing_queue_size 1024 — defensive against rare HEVC sources with
//     delayed packet timing that would otherwise crash the muxer.

import { spawn } from 'node:child_process';

export interface TranscodeOptions {
    inputPath: string;
    outputPath: string;
    /** Override for testing. Defaults to PATH lookup. */
    ffmpegBinary?: string;
}

export interface TranscodeResult {
    /** Trailing stderr lines — useful for diagnostics on success too. */
    stderrTail: string;
}

/**
 * Run ffmpeg on inputPath, write the H.264/AAC MP4 to outputPath. Resolves
 * on exit code 0; rejects with the trailing stderr (last ~50 lines) on any
 * non-zero exit.
 *
 * stderr capture is bounded so a chatty encode doesn't accumulate megabytes
 * of buffered output for the rare error path.
 */
export async function transcodeToH264Mp4(opts: TranscodeOptions): Promise<TranscodeResult> {
    const ffmpeg = opts.ffmpegBinary ?? 'ffmpeg';
    const args = [
        '-y',                                  // overwrite output without prompt
        '-i', opts.inputPath,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-vf', "scale='min(1080,iw)':-2",
        '-max_muxing_queue_size', '1024',
        opts.outputPath,
    ];

    return new Promise<TranscodeResult>((resolve, reject) => {
        const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });

        // Bounded ring buffer for stderr — keep the last 8KB so we have
        // diagnostics on failure without unbounded memory growth.
        const STDERR_CAP = 8 * 1024;
        let stderrBuf = '';
        child.stderr.on('data', (chunk: Buffer) => {
            stderrBuf += chunk.toString('utf-8');
            if (stderrBuf.length > STDERR_CAP) {
                stderrBuf = stderrBuf.slice(stderrBuf.length - STDERR_CAP);
            }
        });

        child.once('error', (err) => {
            reject(new Error(`ffmpeg failed to launch: ${err.message}`));
        });

        child.once('close', (code) => {
            if (code === 0) {
                resolve({ stderrTail: stderrBuf });
                return;
            }
            // Pull just the last few lines of stderr for the user-facing
            // error message — ffmpeg's last lines typically contain the
            // "Conversion failed!" + the underlying cause.
            const lastLines = stderrBuf.split('\n').filter(l => l.trim()).slice(-6).join('\n');
            reject(new Error(`ffmpeg exited with code ${code}:\n${lastLines}`));
        });
    });
}

/**
 * Quick sanity check at worker startup — confirms ffmpeg is on PATH and
 * captures its version. Logs the result; doesn't throw (so a missing
 * ffmpeg becomes visible in logs without crashing the API server, which
 * does plenty of non-video work).
 */
export async function probeFfmpeg(): Promise<string | null> {
    return new Promise((resolve) => {
        const child = spawn('ffmpeg', ['-version'], { stdio: ['ignore', 'pipe', 'ignore'] });
        let out = '';
        child.stdout.on('data', (chunk: Buffer) => { out += chunk.toString('utf-8'); });
        child.once('error', () => resolve(null));
        child.once('close', (code) => {
            if (code !== 0) { resolve(null); return; }
            // First line: "ffmpeg version 4.4.2-0ubuntu0.22.04.1 ..."
            resolve(out.split('\n')[0]?.trim() ?? null);
        });
    });
}
