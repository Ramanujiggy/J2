import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createRef } from 'react';

const get = vi.fn();
const put = vi.fn();
vi.mock('../../lib/api.ts', () => ({ api: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a) } }));

import PairTrackedVideo from '../PairTrackedVideo';

function renderVideo() {
  const ref = createRef<HTMLVideoElement>();
  render(<PairTrackedVideo videoRef={ref} videoUrl="blob:x" sessionId="s1" videoId="v1" videoStyle={{}} />);
  const video = document.querySelector('video')!;
  // jsdom has no layout or media: give the element a box and a picture size.
  Object.defineProperty(video, 'videoWidth', { value: 200 });
  Object.defineProperty(video, 'videoHeight', { value: 100 });
  video.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100, x: 0, y: 0, right: 200, bottom: 100, toJSON: () => ({}) });
  video.pause = vi.fn();
  return video;
}

describe('PairTrackedVideo', () => {
  beforeEach(() => { get.mockReset(); put.mockReset(); });

  it('picks you, then your partner, and queues the track', async () => {
    get.mockResolvedValue({ track: null });
    put.mockResolvedValue({});
    const user = userEvent.setup();
    const video = renderVideo();
    video.currentTime = 12;

    await user.click(await screen.findByRole('button', { name: 'Pick you and your partner' }));
    expect(video.pause).toHaveBeenCalled();
    expect(screen.getByText('Tap yourself')).toBeTruthy();

    fireEvent.pointerUp(screen.getByRole('button', { name: 'Tap yourself' }), { clientX: 50, clientY: 50 });
    expect(screen.getByText('Now tap your partner')).toBeTruthy();
    fireEvent.pointerUp(screen.getByRole('button', { name: 'Tap your partner' }), { clientX: 150, clientY: 25 });

    await waitFor(() => expect(put).toHaveBeenCalledWith('/api/sessions/s1/videos/v1/pair', {
      seed_sec: 12, first: { x: 0.25, y: 0.5 }, second: { x: 0.75, y: 0.25 },
    }));
    expect(await screen.findByText('Following you two through the roll…')).toBeTruthy();
  });

  it('shows how much of the roll was followed once ready', async () => {
    const s = Array(51).fill(50);
    get.mockResolvedValue({ track: { status: 'ready', message: null, fps: 4, frames: [[s, s], [s, null]] } });
    renderVideo();
    expect(await screen.findByText('Both of you found in 50% of the roll')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skeletons' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Re-pick' })).toBeTruthy();
  });
});
