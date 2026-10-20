import { describe, it, expect } from 'vitest';
import { splitLinks, youtubeId, videoLinks } from '../entryLinks.ts';

describe('splitLinks', () => {
  it('returns plain text untouched', () => {
    expect(splitLinks('Hip escape drills.')).toEqual([{ kind: 'text', value: 'Hip escape drills.' }]);
  });
  it('separates links and leaves sentence punctuation outside', () => {
    expect(splitLinks('Watch https://youtu.be/abc123XYZ. Then drill.')).toEqual([
      { kind: 'text', value: 'Watch ' },
      { kind: 'link', value: 'https://youtu.be/abc123XYZ' },
      { kind: 'text', value: '. Then drill.' },
    ]);
  });
});

describe('youtubeId', () => {
  it('reads watch, short and shorts links', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('ignores other sites and malformed links', () => {
    expect(youtubeId('https://vimeo.com/123456')).toBeNull();
    expect(youtubeId('https://youtube.com/channel/abc')).toBeNull();
    expect(youtubeId('not a url')).toBeNull();
  });
});

describe('videoLinks', () => {
  it('lists each video once, in order of mention', () => {
    const text = 'https://youtu.be/AAAAAAA then https://example.com and https://www.youtube.com/watch?v=AAAAAAA and https://youtu.be/BBBBBBB';
    expect(videoLinks(text)).toEqual(['https://youtu.be/AAAAAAA', 'https://youtu.be/BBBBBBB']);
  });
});
