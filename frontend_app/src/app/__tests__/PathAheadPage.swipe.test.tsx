import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { api } from '@/lib/api';
import PathAheadPage from '../PathAheadPage';

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), setAuthErrorHandler: vi.fn() },
  ApiError: class ApiError extends Error {
    public status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'ApiError';
    }
  },
}));

// PathAheadPage conditionally imports these modals — keep them lightweight
vi.mock('@/components/SessionDetailModal', () => ({ default: () => null }));
vi.mock('@/components/SetIntentionModal',  () => ({ default: () => null }));

const mockGet = vi.mocked(api.get);

// ── Test setup ──────────────────────────────────────────────────────────────

// Fix "today" to Mon 23 Mar 2026 so window = [Mar 23 … Mar 29]
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-23T12:00:00'));
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockImplementation((path: string) => {
    if (path === '/api/sessions')   return Promise.resolve({ sessions: [] });
    if (path === '/api/intentions') return Promise.resolve({ intentions: [] });
    if (path === '/api/profile')    return Promise.resolve({ profile: null });
    return Promise.resolve({});
  });
  localStorage.setItem('token', 'test-token');
});

afterEach(() => {
  localStorage.clear();
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <PathAheadPage />
    </MemoryRouter>,
  );

// Helper: fire a complete swipe gesture on the carousel
function swipe(carousel: HTMLElement, startX: number, endX: number, dt = 0) {
  fireEvent.touchStart(carousel, { touches: [{ clientX: startX, clientY: 0 }] });
  if (dt > 0) vi.setSystemTime(new Date(Date.now() + dt));
  fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: endX, clientY: 0 }] });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('PathAheadPage — swipe navigation', () => {

  it('renders the current day (Mar 23) as the active card on mount', async () => {
    renderPage();
    const carousel = await screen.findByTestId('day-carousel');
    expect(carousel).toBeInTheDocument();
    // Mar 23 is the active card (offset 0)
    expect(screen.getByText('Mar 23')).toBeInTheDocument();
  });

  it('left swipe advances to the next day — Mar 23 leaves, Mar 24 becomes active', async () => {
    renderPage();
    const carousel = await screen.findByTestId('day-carousel');

    // dx = −80px (left), fast → triggers swipe
    swipe(carousel, 200, 120);

    await waitFor(() =>
      // Mar 23 (offset -1) is no longer rendered
      expect(screen.queryByText('Mar 23')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Mar 24')).toBeInTheDocument();
  });

  it('right swipe goes back to the previous day', async () => {
    renderPage();
    const carousel = await screen.findByTestId('day-carousel');

    // First go to Mar 24
    swipe(carousel, 200, 120);
    await waitFor(() => expect(screen.queryByText('Mar 23')).not.toBeInTheDocument());

    // Swipe right: dx = +80px → goes back to Mar 23
    swipe(carousel, 200, 280);
    await waitFor(() => expect(screen.getByText('Mar 23')).toBeInTheDocument());
  });

  it('small slow swipe (below distance and velocity thresholds) does not change day', async () => {
    renderPage();
    const carousel = await screen.findByTestId('day-carousel');

    // dx = −30px with dt = 500 ms → vel = 30/500 = 0.06 < 0.35, dist < 55
    swipe(carousel, 200, 170, 500);

    // Mar 23 should still be the active card
    await waitFor(() => expect(screen.getByText('Mar 23')).toBeInTheDocument());
    // Crucially, no day has been removed from the DOM
    expect(screen.queryByText('Mar 22')).not.toBeInTheDocument();
  });

  it('fast flick (dx = −20px, dt ≈ 0ms, vel > 0.35) advances the day', async () => {
    renderPage();
    const carousel = await screen.findByTestId('day-carousel');

    // dx = −20px, dt = 0 → vel = 20/1 = 20 >> 0.35 → triggers swipe
    swipe(carousel, 200, 180);

    await waitFor(() =>
      expect(screen.queryByText('Mar 23')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Mar 24')).toBeInTheDocument();
  });

  it('right swipe at the first day (index 0) stays at index 0', async () => {
    renderPage();
    const carousel = await screen.findByTestId('day-carousel');

    // dx = +80px (right) when already at index 0
    swipe(carousel, 200, 280);

    // Mar 23 must still be in the DOM — boundary holds
    await waitFor(() => expect(screen.getByText('Mar 23')).toBeInTheDocument());
  });
});
