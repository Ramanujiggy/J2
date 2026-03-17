// Central API client — all fetch calls go through here.
// In dev, Vite proxies /auth and /api to http://localhost:5000 so no CORS issues.
// In production, set VITE_API_BASE_URL to the Railway backend URL.

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

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
    const hint = BASE_URL === ''
      ? ' (VITE_API_BASE_URL is not set — redeploy after setting it)'
      : ` (backend: ${BASE_URL})`;
    throw new ApiError(0, `Cannot reach the server${hint}.`);
  }

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
