import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { api } from '@/lib/api';
import LogSessionForm from '../LogSessionForm';

vi.mock('@/lib/api', () => ({
  api: { post: vi.fn(), setAuthErrorHandler: vi.fn() },
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

const mockPost = vi.mocked(api.post);

describe('LogSessionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all required fields', () => {
    render(<LogSessionForm />);
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Style')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Intensity')).toBeInTheDocument();
    expect(screen.getByText(/skills trained/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log session/i })).toBeInTheDocument();
  });

  it('shows error when no duration selected', async () => {
    const user = userEvent.setup();
    render(<LogSessionForm />);
    await user.click(screen.getByText('Stand-up'));
    await user.click(screen.getByRole('button', { name: /log session/i }));
    expect(screen.getByText('Please select a duration.')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('shows error when no skill tags selected', async () => {
    const user = userEvent.setup();
    render(<LogSessionForm />);
    // increment duration to 30m
    await user.click(screen.getByRole('button', { name: '+' }));
    await user.click(screen.getByRole('button', { name: /log session/i }));
    expect(screen.getByText('Please select at least one skill area.')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('calls api.post with correct payload on valid submit', async () => {
    mockPost.mockResolvedValueOnce({ message: 'Session logged.' });
    const user = userEvent.setup();
    render(<LogSessionForm />);
    await user.click(screen.getByRole('button', { name: '+' })); // 30m
    await user.click(screen.getByText('Stand-up'));
    await user.click(screen.getByRole('button', { name: /log session/i }));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/sessions',
        expect.objectContaining({
          duration: 30,
          tags: ['standup'],
          gi_nogi: 'gi',
          session_type: 'class',
          intensity: 3,
        }),
      ),
    );
  });

  it('disables the submit button and shows Saving… while submitting', async () => {
    let resolvePost!: (v: unknown) => void;
    mockPost.mockReturnValueOnce(new Promise(r => { resolvePost = r; }));
    const user = userEvent.setup();
    render(<LogSessionForm />);
    await user.click(screen.getByRole('button', { name: '+' }));
    await user.click(screen.getByText('Stand-up'));
    await user.click(screen.getByRole('button', { name: /log session/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled(),
    );
    await waitFor(async () => { resolvePost({ message: 'Session logged.' }); });
  });

  it('shows error message on API failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();
    render(<LogSessionForm />);
    await user.click(screen.getByRole('button', { name: '+' }));
    await user.click(screen.getByText('Stand-up'));
    await user.click(screen.getByRole('button', { name: /log session/i }));
    await waitFor(() =>
      expect(
        screen.getByText('Something went wrong. Please try again.'),
      ).toBeInTheDocument(),
    );
  });

  it('fires onSuccess callback after a successful submit', async () => {
    mockPost.mockResolvedValueOnce({ message: 'Session logged.' });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<LogSessionForm onSuccess={onSuccess} />);
    await user.click(screen.getByRole('button', { name: '+' }));
    await user.click(screen.getByText('Stand-up'));
    await user.click(screen.getByRole('button', { name: /log session/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
