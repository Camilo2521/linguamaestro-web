'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const ACCESS_TOKEN_KEY = 'lm_access_token';
const REFRESH_TOKEN_KEY = 'lm_refresh_token';

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

export const authStorage = {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setSession(session: Session) {
    localStorage.setItem(ACCESS_TOKEN_KEY, session.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
  },
  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = authStorage.getRefreshToken();
  if (!refreshToken) return false;
  // Coalesce concurrent 401s into a single refresh call.
  refreshPromise ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const body = await res.json();
      authStorage.setSession(body.data.session);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const token = authStorage.getAccessToken();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && !isRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, options, true);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) authStorage.clear();
    throw new ApiError(body.error ?? 'Error de red', res.status, body.code);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data !== undefined ? JSON.stringify(data) : undefined }),
  postForm: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', body: form }),
};

/** Base URL + access token, for building an EventSource URL (SSE can't set headers). */
export function sseUrl(path: string): string {
  const token = authStorage.getAccessToken() ?? '';
  const sep = path.includes('?') ? '&' : '?';
  return `${API_URL}${path}${sep}token=${encodeURIComponent(token)}`;
}
