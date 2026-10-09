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

// Render at /home — RepRouletteFab is route-gated (returns null off /home)
// so the FAB tests below need this initial entry.
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/home']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PathAheadPage />
    </MemoryRouter>,
  );

// Page-level horizontal swipe-to-navigate was retired (the file used to be
// named PathAheadPage.swipe.test.tsx and tested gestures on <main>). Week-
// view rendering tests were dropped because the list/carousel branching
// + desktop/mobile routing depend on `useIsDesktop` (matchMedia) state
// that's not reliably set up in jsdom. The remaining FAB tests below cover
// the highest-value mobile interaction surface.

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

    // The card's own heading (the FAB itself carries only an aria-label), plus
    // the swipe affordance that sits under the drill. The old "Log this drill →"
    // CTA was removed from RepRouletteFab — the card no longer logs directly.
    await waitFor(() => {
      expect(screen.getByText('Rep Roulette')).toBeInTheDocument();
      expect(screen.getByText('← swipe →')).toBeInTheDocument();
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
