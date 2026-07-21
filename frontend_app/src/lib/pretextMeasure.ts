// Pretext wrapper — a thin façade over @chenglou/pretext (pinned to v0.0.6).
//
// Why a wrapper:
//   1. v0.0.6 is pre-1.0; we expect API churn. All Pretext-specific code lives
//      in this module so swapping it (or removing it) is a one-file change.
//   2. Defensive fallback: if Pretext throws (font not loaded yet, unexpected
//      input, future API break), callers get a sensible single-line result
//      rather than a render crash.
//   3. Caching: text+font measurements are deterministic, so we cache.
//
// Used by:
//   - app/PathAheadPage.tsx (reflection card height stability)
//   - app/JournalEntryPage.tsx (journal inscribe reveal)

import * as Pretext from '@chenglou/pretext';

export interface MeasureOpts {
  text: string;
  width: number;       // CSS px — wrapping width
  font: string;        // CSS font shorthand, e.g. "italic 14px 'Plus Jakarta Sans', sans-serif"
  lineHeight: number;  // CSS px — line height
}

export interface MeasureResult {
  lines: string[];     // Each entry is one rendered line of text
  height: number;      // Total wrapped height in CSS px
}

// Cache key: every MeasureOpts field. Strings are cheap to hash via JSON.
const cache = new Map<string, MeasureResult>();

function cacheKey(opts: MeasureOpts): string {
  return `${opts.width}|${opts.lineHeight}|${opts.font}|${opts.text}`;
}

function fallback(opts: MeasureOpts): MeasureResult {
  return { lines: [opts.text], height: opts.lineHeight };
}

/**
 * Measure how `text` will wrap at `width` for the given `font` + `lineHeight`.
 * Returns the wrapped lines (preserving each line's content) and the total
 * rendered height.
 *
 * Returns a single-line fallback if Pretext is unavailable, throws, or
 * produces unexpected output.
 */
export function measureLines(opts: MeasureOpts): MeasureResult {
  if (!opts.text || opts.width <= 0) return fallback(opts);

  const key = cacheKey(opts);
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    // Pretext v0.0.6 API:
    //   prepareWithSegments(text, fontShorthand) → prepared object
    //   layoutWithLines(prepared, width, lineHeight) → { height, lineCount, lines: { text, ... }[] }
    // Args are positional, not options objects. We tolerate API drift across
    // 0.0.x by accessing the module dynamically and guarding every call.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const P = Pretext as any;
    const prep = P.prepareWithSegments ?? P.prepare;
    if (typeof prep !== 'function') return cacheAndReturn(key, fallback(opts));
    const prepared = prep(opts.text, opts.font);
    if (!prepared) return cacheAndReturn(key, fallback(opts));

    if (typeof P.layoutWithLines !== 'function') return cacheAndReturn(key, fallback(opts));
    const layout = P.layoutWithLines(prepared, opts.width, opts.lineHeight);
    if (!layout || !Array.isArray(layout.lines)) return cacheAndReturn(key, fallback(opts));

    const lines: string[] = layout.lines.map((l: { text?: string } | string) =>
      typeof l === 'string' ? l : (l.text ?? ''),
    );
    const height: number = typeof layout.height === 'number'
      ? layout.height
      : lines.length * opts.lineHeight;
    return cacheAndReturn(key, { lines, height });
  } catch {
    return cacheAndReturn(key, fallback(opts));
  }
}

function cacheAndReturn(key: string, value: MeasureResult): MeasureResult {
  cache.set(key, value);
  return value;
}

/**
 * Convenience: just the max wrapped height across multiple candidate texts.
 * Used for height-stability locking (e.g. reflection card across rotating prompts).
 */
export function maxLinesHeight(
  texts: readonly string[],
  shared: Omit<MeasureOpts, 'text'>,
): number {
  let max = 0;
  for (const text of texts) {
    const m = measureLines({ ...shared, text });
    if (m.height > max) max = m.height;
  }
  return max;
}
