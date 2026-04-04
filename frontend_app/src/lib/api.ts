// Central API client — all fetch calls go through here.
// In dev, Vite proxies /auth and /api to http://localhost:5000 so no CORS issues.
// In production, VITE_API_BASE_URL is baked in via .env.production at build time.

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

let authErrorHandler: (() => void) | null = null;

const getToken = (): string | null => localStorage.getItem('token');

// Guard: if the response isn't JSON (e.g. an HTML page from the frontend's own
// static server when VITE_API_BASE_URL is misconfigured), surface a clear message
// instead of a cryptic parse error.
function assertJson(res: Response): void {
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    throw new ApiError(
      res.status,
      'Cannot reach the server. Check your internet connection and try again.',
    );
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (err) {
    // For write operations, queue for offline sync instead of throwing
    if (options.method && options.method !== 'GET') {
      const { enqueue } = await import('./offlineQueue.ts');
      await enqueue(
        options.method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        path,
        options.body ? JSON.parse(options.body as string) : undefined,
      );
      return { message: 'Queued for sync.', _offline: true } as T;
    }
    throw new ApiError(0, 'Cannot reach the server. Check your internet connection and try again.');
  }

  if (!res.ok) {
    assertJson(res);
    const body = await res.json().catch(() => ({})) as { message?: string };
    const message = body.message ?? `Request failed with status ${res.status}`;
    if (res.status === 401 && authErrorHandler) {
      authErrorHandler();
    }
    throw new ApiError(res.status, message);
  }

  assertJson(res);
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) =>
    request<T>(path, { method: 'GET' }),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),

  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),

  setAuthErrorHandler: (fn: () => void) => {
    authErrorHandler = fn;
  },
};
