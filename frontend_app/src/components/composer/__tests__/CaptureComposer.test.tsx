import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
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

const ENTRY_PLACEHOLDER =
  'What would you like to remember about this session? Type @ to tag a partner.';

// CaptureComposer always mounts SealRevealSheet, which calls useNavigate() — so
// it needs a router in the tree even though these tests never navigate.
const renderComposer = (onSuccess: (count?: number) => void) =>
  renderWithProviders(<CaptureComposer onSuccess={onSuccess} />);

describe('CaptureComposer', () => {
  beforeEach(() => {
    postMock.mockClear();
    postMock.mockResolvedValue({ message: 'Session logged.', session_count: 12 });
    addPendingMock.mockClear();
    speechState.supported = false;
    speechState.recording = false;
    speechState.transcript = '';
  });

  it('write path: sheet → page → save posts a complete session row', async () => {
    const onSuccess = vi.fn();
    renderComposer(onSuccess);

    // Sheet (no schedules mocked → quiet card, speech unsupported → Write CTA)
    fireEvent.click(await screen.findByText('Write your journal'));

    // Page — write the entry and save. There is no longer a Continue/receipt
    // step between the page and the write: MarginNotesEntry saves directly.
    const box = screen.getByPlaceholderText(ENTRY_PLACEHOLDER);
    fireEvent.change(box, { target: { value: 'hit the arm weave twice tonight' } });
    fireEvent.click(screen.getByText('◈ Save entry'));

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

    // Techniques and prism focus are now chosen explicitly (TagPicker /
    // PrismFocusInput), never inferred from the entry text — so a write that
    // only types prose carries no pillars. `extractChips` is no longer wired
    // into any capture surface; src/lib/__tests__/chipExtraction.test.ts still
    // covers the module itself.
    expect(body.tags).toEqual([]);
    expect(body.heading).toBeNull();
    expect(body.had_primary).toBe(false);
    expect(body.had_deep_work).toBe(false);
    expect(body.selection_count).toBe(0);
    expect(body.deep_work_pillars).toEqual([]);

    // buildSessionPayload omits untouched optionals (`nonEmpty` / `?? undefined`)
    // rather than sending empty arrays or explicit nulls, so an entry that never
    // touched the margin-notes band leaves these keys off the body entirely.
    expect(body.pillar_distribution).toBeUndefined();
    expect(body.user_tag_ids).toBeUndefined();
    expect(body.polarity).toBeUndefined();
    expect(body.sub_skill_tag).toBeUndefined();
    expect(body.script_source).toBeUndefined();
    expect(body.canonical_position_ids).toBeUndefined();
    expect(body.canonical_constraint_ids).toBeUndefined();
    expect(body.user_constraint_ids).toBeUndefined();
    expect(body.partners).toBeUndefined();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(12));
  });

  // Replaces the old "re-extraction on Continue preserves a user un-confirmation
  // (F1)" case. That test drove a chip-extraction/receipt step that no longer
  // exists: the composer stopped auto-seeding technique chips from the entry text
  // (`extractChips` has no callers), and MarginNotesEntry saves straight from the
  // page. What is still worth covering on the voice route is that the transcript
  // survives the record → page handoff and lands in `notes`.
  it('voice path: sheet → record → page carries the transcript into notes', async () => {
    speechState.supported = true;
    const onSuccess = vi.fn();
    renderComposer(onSuccess);

    // Sheet — one CTA whose label flips on speech support (ComposerSheet)
    fireEvent.click(await screen.findByText(/Journal using voice/));

    // Record stage — stop immediately; the stub's fixed transcript is in hand.
    fireEvent.click(screen.getByLabelText('Stop recording'));

    // Page — the textarea is pre-filled with what was said.
    const box = await screen.findByPlaceholderText(ENTRY_PLACEHOLDER);
    expect(box).toHaveValue('worked the arm weave');

    fireEvent.click(screen.getByText('◈ Save entry'));

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    const [, body] = postMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.notes).toBe('worked the arm weave');
    expect(body.user_tag_ids).toBeUndefined();
    expect(body.tags).toEqual([]);
  });

  it('mark-attended double-tap fires exactly one save (F3)', async () => {
    const onSuccess = vi.fn();
    renderComposer(onSuccess);

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
    renderComposer(onSuccess);

    fireEvent.click(await screen.findByText('Just mark attended ✓'));

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    const [url, body] = postMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('/api/sessions');
    expect(body.tags).toEqual([]);
    expect(body.heading).toBeNull();
    expect(body.user_tag_ids).toBeUndefined();  // serializer omits empty arrays
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
    renderComposer(onSuccess);

    fireEvent.click(await screen.findByText('Write your journal'));
    const box = screen.getByPlaceholderText(ENTRY_PLACEHOLDER);
    fireEvent.change(box, { target: { value: 'hit the arm weave twice tonight' } });
    fireEvent.click(screen.getByText('◈ Save entry'));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(undefined));
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(addPendingMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/could not save/i)).not.toBeInTheDocument();
  });
});
