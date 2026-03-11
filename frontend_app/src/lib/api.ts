// Central API client — all fetch calls go through here.
// In dev, Vite proxies /auth and /api to http://localhost:5000 so no CORS issues.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

let authErrorHandler: (() => void) | null = null;

const getToken = (): string | null => localStorage.getItem('token');

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    const message = body.message ?? `Request failed with status ${res.status}`;
    if (res.status === 401 && authErrorHandler) {
      authErrorHandler();
    }
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) =>
    request<T>(path, { method: 'GET' }),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  setAuthErrorHandler: (fn: () => void) => {
    authErrorHandler = fn;
  },
};
