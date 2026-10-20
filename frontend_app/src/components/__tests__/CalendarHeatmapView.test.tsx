import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import CalendarHeatmapView from '../CalendarHeatmapView';
import type { SessionSummary, BeltHistoryEntry } from '@/types/api';

vi.mock('gsap', () => ({ default: { fromTo: vi.fn() } }));
vi.mock('../SessionDetailModal', () => ({
  default: ({ session }: { session: SessionSummary }) => <div data-testid="session-modal">{session.id}</div>,
}));

const promotion: BeltHistoryEntry = {
  id: 'p1', belt_rank: 'purple', stripes: 0, promoted_at: '2026-09-14', notes: 'Coach tied it on after open mat.',
};
vi.mock('../../hooks/useBeltHistory', () => ({
  useBeltHistory: () => ({ entries: [promotion], loading: false, refetch: vi.fn() }),
}));

const session = (id: string, date: string, intensity = 3): SessionSummary => ({
  id, date, duration: 60, intensity, gi_nogi: 'gi', session_type: 'class', tags: [],
});

const sessions = [
  session('a', '2026-08-01'),
  session('b', '2026-09-02', 4),
  session('c', '2026-09-02', 2),
  session('d', '2026-09-20'),
];

function renderView(onLogSession = vi.fn()) {
  render(<CalendarHeatmapView sessions={sessions} year={2026} onLogSession={onLogSession} />);
  return { onLogSession };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12));
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
});
afterEach(() => vi.useRealTimers());

describe('CalendarHeatmapView', () => {
  it('files each day under its own month', () => {
    renderView();
    // Aug 1 2026 is a Saturday: it must sit in an August row, not July's last week
    const aug1 = screen.getByRole('gridcell', { name: /^August 1,/ });
    const rows = screen.getAllByRole('row');
    const augRow = rows.find(r => within(r).queryByRole('button', { name: 'Aug' }));
    expect(augRow).toContainElement(aug1);
  });

  it('shows a legend for every intensity step', () => {
    renderView();
    for (const label of ['Drill', 'Light', 'Steady', 'Intense', 'Hard roll']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('labels a promotion and shows its note, not "No sessions"', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: /Purple belt, September 14/ }));
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Purple belt');
    expect(tip).toHaveTextContent('Coach tied it on after open mat.');
    expect(tip).not.toHaveTextContent('No sessions');
  });

  it('lists every session on a day that has more than one', () => {
    renderView();
    fireEvent.click(screen.getByRole('gridcell', { name: /^September 2,.*2 sessions/ }));
    expect(screen.queryByTestId('session-modal')).not.toBeInTheDocument();
    expect(screen.getByText(/2 sessions$/)).toBeInTheDocument();
  });

  it('opens a single-session day straight away', () => {
    renderView();
    fireEvent.click(screen.getByRole('gridcell', { name: /^September 20,/ }));
    expect(screen.getByTestId('session-modal')).toHaveTextContent('d');
  });

  it('offers to log a past empty day but not a future one', () => {
    const { onLogSession } = renderView();
    fireEvent.click(screen.getByRole('gridcell', { name: /^October 1, no sessions/ }));
    expect(onLogSession).toHaveBeenCalledWith('2026-10-01');
    fireEvent.click(screen.getByRole('gridcell', { name: /^December 1, no sessions/ }));
    expect(onLogSession).toHaveBeenCalledTimes(1);
  });

  it('opens a month from its margin note', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: /3 sessions/ }));
    expect(screen.getByText(/Sep 2026 · 3 sessions/)).toBeInTheDocument();
  });
});
