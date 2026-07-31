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

vi.mock('@/components/SessionDetailModal', () => ({ default: () => null }));
vi.mock('@/components/SetIntentionModal',  () => ({ default: () => null }));

const mockGet = vi.mocked(api.get);

// ── Test setup ──────────────────────────────────────────────────────────────

// Fix "today" to Mon 23 Mar 2026 so week = [Mar 23 … Mar 29]
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
    if (path === '/api/sessions' || path.startsWith('/api/sessions?'))
      return Promise.resolve({ sessions: [] });
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

// Helper: fire a complete swipe gesture on an element
function swipe(el: HTMLElement, startX: number, endX: number, dt = 0) {
  fireEvent.touchStart(el, { touches: [{ clientX: startX, clientY: 0 }] });
  if (dt > 0) vi.setSystemTime(new Date(Date.now() + dt));
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: endX, clientY: 0 }] });
}

// The week-view test that lived here was removed on 2026-07-31 along with
// the week carousel itself: home is a table of contents on both viewports
// now, and Calendar owns dates. It had been failing before the removal, so
// nothing was covering the carousel by then anyway.

// ── Rep Roulette FAB tests ──────────────────────────────────────────────────

describe('PathAheadPage — Rep Roulette FAB', () => {

  it('renders the FAB button', async () => {
    renderPage();
    const fab = await screen.findByLabelText('Rep Roulette');
    expect(fab).toBeInTheDocument();
  });

  it('opens card on FAB click and shows drill content', async () => {
    renderPage();
    const fab = await screen.findByLabelText('Rep Roulette');
    fireEvent.click(fab);

    // Advance past the morph animation timeout (380ms)
    vi.advanceTimersByTime(400);

    await waitFor(() => {
      expect(screen.getByText('Rep Roulette')).toBeInTheDocument();
      expect(screen.getByText('Log this drill →')).toBeInTheDocument();
    });
  });

  it('closes card via close button', async () => {
    renderPage();
    const fab = await screen.findByLabelText('Rep Roulette');
    fireEvent.click(fab);
    vi.advanceTimersByTime(400);

    const closeBtn = await screen.findByLabelText('Close roulette');
    fireEvent.click(closeBtn);

    // Advance past the close animation timeout (350ms)
    vi.advanceTimersByTime(400);

    // The container should revert to FAB state (collapsed, still has aria-label)
    await waitFor(() => {
      expect(screen.getByLabelText('Rep Roulette')).toBeInTheDocument();
    });
  });
});
