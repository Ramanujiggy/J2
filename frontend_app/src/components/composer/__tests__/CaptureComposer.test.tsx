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

const addPendingMock = vi.fn();
vi.mock('@/lib/pendingSessions', () => ({ addPending: (...a: unknown[]) => addPendingMock(...a) }));

// Stateful stub: driven by a module-level mutable holder so `start`/`stop`
// mutate real values the next CaptureComposer render will read. Any React
// state update elsewhere in the component (e.g. the stage change that always
// accompanies start/stop in the composer) forces the re-render that picks up
// the new holder values — no need to reimplement the hook with real state.
const speechState: { supported: boolean; recording: boolean; transcript: string } = {
  supported: false,
  recording: false,
  transcript: '',
};
vi.mock('@/hooks/useSpeechTranscript', () => ({
  useSpeechTranscript: () => ({
    supported: speechState.supported,
    recording: speechState.recording,
    transcript: speechState.transcript,
    setTranscript: vi.fn(),
    elapsed: 0,
    start: () => { speechState.recording = true; speechState.transcript = 'worked the arm weave'; },
    stop: () => { speechState.recording = false; },
  }),
}));

describe('CaptureComposer', () => {
  beforeEach(() => {
    postMock.mockClear();
    postMock.mockResolvedValue({ message: 'Session logged.', session_count: 12 });
    addPendingMock.mockClear();
    speechState.supported = false;
    speechState.recording = false;
    speechState.transcript = '';
  });

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

    const today = new Date();
    const expectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    expect(body.date).toBe(expectedDate);
    expect(body.duration).toBe(60);          // kernel default — no schedule
    expect(body.gi_nogi).toBe('gi');
    expect(body.session_type).toBe('class');
    expect(body.intensity).toBe(3);          // untouched default
    expect(body.notes).toBe('hit the arm weave twice tonight');
    expect(body.user_tag_ids).toEqual(['u1']);
    expect(body.tags).toEqual(['passing']);
    expect(body.heading).toBe('passing');
    expect(body.polarity).toBeNull();
    expect(body.sub_skill_tag).toBe('');
    expect(body.script_source).toBeNull();
    expect(body.canonical_position_ids).toEqual([]);
    expect(body.pillar_distribution).toEqual({ passing: 1 });
    expect(body.had_primary).toBe(true);
    expect(body.had_deep_work).toBe(false);
    expect(body.selection_count).toBe(1);
    expect(body.deep_work_pillars).toEqual([]);
    expect(body.canonical_constraint_ids).toEqual([]);
    expect(body.user_constraint_ids).toEqual([]);
    expect(body.partners).toEqual([]);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(12));
  });

  it('re-extraction on Continue preserves a user un-confirmation instead of re-seeding it (F1)', async () => {
    speechState.supported = true;
    const onSuccess = vi.fn();
    render(<CaptureComposer onSuccess={onSuccess} />);

    // Sheet — speech supported, so the primary CTA is "Speak"
    fireEvent.click(await screen.findByText(/Speak your entry/));

    // Record stage — stop immediately; extraction #1 fires from the stub's
    // fixed transcript and pre-confirms the "Arm Weave" user-tag chip.
    fireEvent.click(screen.getByLabelText('Stop recording'));

    // Page — the chip is offered and pre-confirmed; un-confirm it by hand.
    const chip = await screen.findByRole('button', { name: /Arm Weave/ });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'false');

    // Continue re-runs extraction on the same (unedited) text — the merge
    // must keep the user's un-confirm instead of re-seeding the chip.
    fireEvent.click(screen.getByText('Continue →'));

    fireEvent.click(screen.getByText('Seal the entry'));

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    const [, body] = postMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.user_tag_ids).toEqual([]);
    expect(body.tags).toEqual([]);
  });

  it('mark-attended double-tap fires exactly one save (F3)', async () => {
    const onSuccess = vi.fn();
    render(<CaptureComposer onSuccess={onSuccess} />);

    const btn = await screen.findByText('Just mark attended ✓');
    fireEvent.click(btn);
    fireEvent.click(btn);

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  // F4.1 — the backend now accepts tag-less create (F1); the sheet's
  // zero-chip escape hatch must post a genuinely empty, complete session row.
  it('zero-chip mark-attended posts an empty-tags session with kernel defaults', async () => {
    const onSuccess = vi.fn();
    render(<CaptureComposer onSuccess={onSuccess} />);

    fireEvent.click(await screen.findByText('Just mark attended ✓'));

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    const [url, body] = postMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('/api/sessions');
    expect(body.tags).toEqual([]);
    expect(body.heading).toBeNull();
    expect(body.user_tag_ids).toEqual([]);
    expect(body.notes).toBe('');
    expect(body.duration).toBe(60);   // kernel default — no schedule
    expect(body.gi_nogi).toBe('gi');
    expect(body.session_type).toBe('class');

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(12));
  });

  // F4.2 — api.post() resolves with a synthetic `_offline` payload (never
  // throws) when the write was queued by the offline path; the composer must
  // treat that as a deferred success (onSuccess(undefined) + addPending), not
  // silently drop the entry or surface an error.
  it('offline save queues the entry and calls onSuccess(undefined) instead of erroring', async () => {
    postMock.mockResolvedValueOnce({ message: 'Queued for sync.', _offline: true });
    const onSuccess = vi.fn();
    render(<CaptureComposer onSuccess={onSuccess} />);

    fireEvent.click(await screen.findByText('Write your entry'));
    const box = screen.getByPlaceholderText('What do you want to remember about tonight?');
    fireEvent.change(box, { target: { value: 'hit the arm weave twice tonight' } });
    fireEvent.click(screen.getByText('Continue →'));
    fireEvent.click(screen.getByText('Seal the entry'));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(undefined));
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(addPendingMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/could not save/i)).not.toBeInTheDocument();
  });
});
