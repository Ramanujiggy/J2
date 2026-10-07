import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { api } from '@/lib/api';
import { renderWithProviders } from '@/test/renderWithProviders';
import LoginPage from '../LoginPage';

// The page has two "Log In" elements: the tab toggle and the submit button.
// This helper returns the submit button (last in DOM order).
const getSubmitBtn = () => screen.getAllByRole('button', { name: /^log in$/i }).at(-1)!;

// Hoist mocks so factory closures can reference them
const mockLogin    = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, logout: vi.fn(), token: null, isAuthenticated: false }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/lib/api', () => ({
  api: { post: vi.fn(), setAuthErrorHandler: vi.fn() },
  ApiError: class ApiError extends Error {
    public status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'ApiError';
    }
  },
}));

const mockPost = vi.mocked(api.post);

const renderPage = () => renderWithProviders(<LoginPage />);

describe('LoginPage — auth flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders in login mode by default', () => {
    renderPage();
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••+/)).toBeInTheDocument();
    // Both the tab and the submit button are labelled "Log In"
    expect(screen.getAllByRole('button', { name: /^log in$/i })).toHaveLength(2);
  });

  it('switches to register mode when the Register tab is clicked', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /^register$/i }));
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('blocks submission and shows an error for an invalid email', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByPlaceholderText(/you@example\.com/i), 'not-an-email');
    await user.click(getSubmitBtn());
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('logs in, stores the token, and navigates to /home on success', async () => {
    mockPost.mockResolvedValueOnce({ token: 'abc123', message: 'ok' });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByPlaceholderText(/you@example\.com/i), 'user@test.com');
    await user.type(screen.getByPlaceholderText(/••+/), 'password');
    await user.click(getSubmitBtn());
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/login', {
        email: 'user@test.com',
        password: 'password',
      });
      expect(mockLogin).toHaveBeenCalledWith('abc123');
      expect(mockNavigate).toHaveBeenCalledWith('/home');
    });
  });

  it('shows an error message when the server rejects login', async () => {
    mockPost.mockResolvedValueOnce({ token: '', message: 'Invalid credentials.' });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByPlaceholderText(/you@example\.com/i), 'user@test.com');
    await user.type(screen.getByPlaceholderText(/••+/), 'wrong');
    await user.click(getSubmitBtn());
    await waitFor(() =>
      expect(screen.getByText('Invalid credentials.')).toBeInTheDocument(),
    );
  });

  // Brand-new accounts go to the guided onboarding flow, not straight to /home
  // (LoginPage: `navigate(wasRegister ? '/onboarding/name' : '/home')`).
  it('registers then auto-logs in and navigates to onboarding', async () => {
    mockPost
      .mockResolvedValueOnce({ message: 'User registered successfully.' })
      .mockResolvedValueOnce({ token: 'newtoken', message: 'ok' });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /^register$/i }));
    await user.type(screen.getByPlaceholderText(/you@example\.com/i), 'new@test.com');
    await user.type(screen.getByPlaceholderText(/••+/), 'newpass');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/register', {
        email: 'new@test.com',
        password: 'newpass',
      });
      expect(mockPost).toHaveBeenCalledWith('/auth/login', {
        email: 'new@test.com',
        password: 'newpass',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding/name');
    });
  });

  it('shows a confirmation message after submitting a password-reset request', async () => {
    mockPost.mockResolvedValueOnce({});
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /forgot your password/i }));
    await user.type(screen.getByPlaceholderText(/you@example\.com/i), 'user@test.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    await waitFor(() =>
      expect(screen.getByText(/a reset link is on its way/i)).toBeInTheDocument(),
    );
  });
});
