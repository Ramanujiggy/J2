import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { api } from '@/lib/api';
import LogSessionForm from '../LogSessionForm';

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn().mockResolvedValue({ intention: null }),
    setAuthErrorHandler: vi.fn(),
  },
  ApiError: class extends Error { status = 0; },
}));

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

vi.mock('@/hooks/useUserTags', () => ({
  useUserTags: () => ({ tags: [], loading: false, error: null, createTag: vi.fn() }),
}));

vi.mock('@/hooks/useCanonicalPositions', () => ({
  useCanonicalPositions: () => ({ positions: [], loading: false, error: null }),
}));

const mockPost = vi.mocked(api.post);

describe('LogSessionForm (chip input)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders the focus-area chips and the save button', () => {
    render(<LogSessionForm />);
    expect(screen.getByRole('switch', { name: /Stand-up/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Guard Passing/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save session/i })).toBeInTheDocument();
  });

  it('blocks submit with a duration error when no duration set', async () => {
    const user = userEvent.setup();
    render(<LogSessionForm />);
    await user.click(screen.getByRole('switch', { name: /Stand-up/i }));
    await user.click(screen.getByRole('button', { name: /save session/i }));
    expect(screen.getByText('Please select a duration.')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('blocks submit with a focus-area error when no chips selected', async () => {
    const user = userEvent.setup();
    render(<LogSessionForm />);
    await user.click(screen.getByRole('button', { name: '+' }));
    await user.click(screen.getByRole('button', { name: /save session/i }));
    expect(screen.getByText('Tap at least one focus area.')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('submits with derived heading, tags array, and pillar distribution', async () => {
    mockPost.mockResolvedValueOnce({ message: 'Session logged.' });
    const user = userEvent.setup();
    render(<LogSessionForm />);
    await user.click(screen.getByRole('button', { name: '+' }));
    await user.click(screen.getByRole('switch', { name: /Stand-up/i }));
    await user.click(screen.getByRole('button', { name: /save session/i }));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/sessions',
        expect.objectContaining({
          duration: 30,
          heading: 'standup',
          tags: ['standup'],
          pillar_distribution: { standup: 1 },
          gi_nogi: 'gi',
          session_type: 'class',
          intensity: 3,
        }),
      ),
    );
  });
});
