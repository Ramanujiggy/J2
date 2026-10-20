// Links inside written entries. People paste a YouTube breakdown or a coach's
// instructional next to what they wrote; the read view turns those into real
// links and lists any videos under the prose, without changing what was saved.

export type ProseSegment =
  | { kind: 'text'; value: string }
  | { kind: 'link'; value: string };

const URL_RE = /https?:\/\/[^\s<>"']+/g;
/** Punctuation that usually ends the sentence, not the URL. */
const TRAILING = /[.,;:!?)\]]+$/;

/** Splits prose into plain text and http(s) links, in order. */
export function splitLinks(text: string): ProseSegment[] {
  const out: ProseSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    let url = match[0];
    const trail = url.match(TRAILING)?.[0] ?? '';
    url = url.slice(0, url.length - trail.length);
    if (start > last) out.push({ kind: 'text', value: text.slice(last, start) });
    out.push({ kind: 'link', value: url });
    last = start + url.length;
  }
  if (last < text.length) out.push({ kind: 'text', value: text.slice(last) });
  return out;
}

/** The video id of a YouTube watch, short or shorts link; null for anything else. */
export function youtubeId(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] ?? null;
  else if (host === 'youtube.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else if (/^\/(shorts|embed|live)\//.test(u.pathname)) id = u.pathname.split('/')[2] ?? null;
  }
  return id && /^[\w-]{6,}$/.test(id) ? id : null;
}

/** Distinct YouTube links in the prose, first mention first. */
export function videoLinks(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const seg of splitLinks(text)) {
    if (seg.kind !== 'link') continue;
    const id = youtubeId(seg.value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(seg.value);
  }
  return out;
}
