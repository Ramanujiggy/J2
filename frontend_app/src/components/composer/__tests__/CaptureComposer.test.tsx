import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CaptureComposer from '../CaptureComposer.tsx';

const postMock = vi.fn().mockResolvedValue({ message: 'Session logged.', session_count: 12 });
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn().mockImplementation((url: string) =>
      url.includes('class-schedules') ? Promise.resolve({ schedules: [] }) : Promise.resolve({})),
    post: (...a: unknown[]) => postMock(...a),
  },
  ApiError: class extends Error {},
}));
vi.mock('@/hooks/useUserTags', () => ({ useUserTags: () => ({ tags: [{ id: 'u1', name: 'Arm Weave', parent_pillar: 'passing' }] }) }));
vi.mock('@/hooks/useCanonicalPositions', () => ({ useCanonicalPositions: () => ({ positions: [] }) }));
vi.mock('@/context/SessionsContext', () => ({ useSessions: () => ({ sessions: [] }) }));
vi.mock('@/context/ActiveIntentionContext', () => ({ useActiveIntention: () => ({ activeIntention: null }) }));
vi.mock('@/hooks/useSpeechTranscript', () => ({
  useSpeechTranscript: () => ({ supported: false, recording: false, transcript: '', setTranscript: vi.fn(), elapsed: 0, start: vi.fn(), stop: vi.fn() }),
}));

describe('CaptureComposer', () => {
  beforeEach(() => postMock.mockClear());

  it('write path: sheet → page → receipt → seal posts a complete session row', async () => {
    const onSuccess = vi.fn();
    render(<CaptureComposer onSuccess={onSuccess} />);

    // Sheet (no schedules mocked → quiet card, speech unsupported → Write CTA)
    fireEvent.click(await screen.findByText('Write your entry'));

    // Page — type an entry that mentions a known technique
    const box = screen.getByPlaceholderText('What do you want to remember about tonight?');
    fireEvent.change(box, { target: { value: 'hit the arm weave twice tonight' } });
    fireEvent.click(screen.getByText('Continue →'));

    // Chip was extracted and pre-confirmed → receipt shows; seal
    fireEvent.click(screen.getByText('Seal the entry'));

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    const [url, body] = postMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('/api/sessions');
    expect(body.duration).toBe(60);          // kernel default — no schedule
    expect(body.gi_nogi).toBe('gi');
    expect(body.session_type).toBe('class');
    expect(body.intensity).toBe(3);          // untouched default
    expect(body.notes).toBe('hit the arm weave twice tonight');
    expect(body.user_tag_ids).toEqual(['u1']);
    expect(body.tags).toEqual(['passing']);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(12));
  });
});
