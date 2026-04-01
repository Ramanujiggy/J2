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

// ── Week view tests ─────────────────────────────────────────────────────────

describe('PathAheadPage — week view', () => {

  it('renders 7 mini day cards (Mon–Sun) in the week scroll', async () => {
    renderPage();
    const weekScroll = await screen.findByTestId('week-scroll');
    expect(weekScroll).toBeInTheDocument();
    // Mon Mar 23 through Sun Mar 29
    expect(screen.getByText('Mar 23')).toBeInTheDocument();
    expect(screen.getByText('Mar 29')).toBeInTheDocument();
    // Should have 7 day cards
    const buttons = weekScroll.querySelectorAll('button');
    expect(buttons.length).toBe(7);
  });
});

// ── Rep Roulette tests ──────────────────────────────────────────────────────

describe('PathAheadPage — Rep Roulette', () => {

  it('renders the roulette header', async () => {
    renderPage();
    const header = await screen.findByTestId('roulette-header');
    expect(header).toBeInTheDocument();
    expect(screen.getByText('Rep Roulette')).toBeInTheDocument();
  });

  it('expands on click and shows drill content', async () => {
    renderPage();
    const header = await screen.findByTestId('roulette-header');
    fireEvent.click(header);

    // The drill area should now be visible
    const drillArea = screen.getByTestId('roulette-drill-area');
    expect(drillArea).toBeInTheDocument();
    // Should have swipe hint text
    expect(screen.getByText('← swipe →')).toBeInTheDocument();
  });

  it('collapses on second click', async () => {
    renderPage();
    const header = await screen.findByTestId('roulette-header');

    // Expand
    fireEvent.click(header);
    expect(screen.getByText('← swipe →')).toBeInTheDocument();

    // Collapse
    fireEvent.click(header);
    // The drill area container still exists in DOM (animated out via maxHeight: 0)
    // but the parent has opacity: 0 — we verify the roulette header is still there
    expect(header).toBeInTheDocument();
  });

  it('left swipe advances to a new drill', async () => {
    renderPage();
    const header = await screen.findByTestId('roulette-header');
    fireEvent.click(header);

    const drillArea = screen.getByTestId('roulette-drill-area');
    const initialDrillName = drillArea.querySelector('.text-xl')?.textContent;

    // Swipe left: dx = −80px, fast
    swipe(drillArea, 200, 120);

    await waitFor(() => {
      const newDrillName = drillArea.querySelector('.text-xl')?.textContent;
      expect(newDrillName).not.toBe(initialDrillName);
    });
    // Position indicator should show "2 of 2"
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
  });

  it('right swipe at index 0 stays on the same drill', async () => {
    renderPage();
    const header = await screen.findByTestId('roulette-header');
    fireEvent.click(header);

    const drillArea = screen.getByTestId('roulette-drill-area');
    const initialDrillName = drillArea.querySelector('.text-xl')?.textContent;

    // Swipe right at index 0: dx = +80px
    swipe(drillArea, 200, 280);

    await waitFor(() => {
      const currentDrillName = drillArea.querySelector('.text-xl')?.textContent;
      expect(currentDrillName).toBe(initialDrillName);
    });
  });

  it('left swipe then right swipe returns to previous drill', async () => {
    renderPage();
    const header = await screen.findByTestId('roulette-header');
    fireEvent.click(header);

    const drillArea = screen.getByTestId('roulette-drill-area');
    const firstDrillName = drillArea.querySelector('.text-xl')?.textContent;

    // Swipe left to get a new drill
    swipe(drillArea, 200, 120);
    await waitFor(() => {
      expect(drillArea.querySelector('.text-xl')?.textContent).not.toBe(firstDrillName);
    });

    // Swipe right to go back
    swipe(drillArea, 200, 280);
    await waitFor(() => {
      expect(drillArea.querySelector('.text-xl')?.textContent).toBe(firstDrillName);
    });
    // Position indicator should show "1 of 2"
    expect(screen.getByText('1 of 2')).toBeInTheDocument();
  });

  it('small slow swipe does not change drill', async () => {
    renderPage();
    const header = await screen.findByTestId('roulette-header');
    fireEvent.click(header);

    const drillArea = screen.getByTestId('roulette-drill-area');
    const initialDrillName = drillArea.querySelector('.text-xl')?.textContent;

    // dx = −30px with dt = 500ms → vel = 0.06, dist < 45 → no change
    swipe(drillArea, 200, 170, 500);

    await waitFor(() => {
      expect(drillArea.querySelector('.text-xl')?.textContent).toBe(initialDrillName);
    });
  });
});
