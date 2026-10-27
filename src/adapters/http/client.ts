import { AppError } from '../../domain/errors';

// The single place that talks HTTP. Every call carries an X-Request-Id (the backend request filter logs
// headers), so a failure seen in the browser can be found in service logs.
// When identity arrives, credentials are added here (prefer an httpOnly session cookie via the gateway).

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

type QueryValue = string | number | boolean | undefined | null | Array<string | number>;
export type Query = Record<string, QueryValue>;

/** oms-core ErrorResponse */
interface ErrorResponse {
  status?: number;
  error?: string;
  errors?: string[];
}

const STATUS_TEXT: Record<number, string> = {
  400: 'Invalid request',
  404: 'Not found',
  409: 'Conflict or duplicate',
  422: 'The request could not be processed',
  500: 'Server error',
  502: 'Cannot reach the backend',
  503: 'Backend not ready',
  504: 'Backend did not respond',
};

export interface HttpClient {
  get<T>(path: string, query?: Query): Promise<T>;
  post<T>(path: string, body?: unknown, query?: Query): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
}

function toQueryString(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
    else params.append(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export function createHttpClient(options: { baseUrl?: string; timeoutMs?: number; fetchImpl?: typeof fetch } = {}): HttpClient {
  const baseUrl = options.baseUrl ?? '';
  const timeoutMs = options.timeoutMs ?? 15_000;
  const doFetch = options.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));

  async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
    const id = requestId();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await doFetch(baseUrl + path + toQueryString(query), {
        method,
        headers: {
          Accept: 'application/json',
          'X-Request-Id': id,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      throw new AppError(0, aborted ? 'The backend did not respond in time.' : 'Cannot reach the backend. Check that the service is running.');
    }

    // The timeout also covers reading the body.
    let text: string;
    try {
      text = await response.text();
    } catch {
      throw new AppError(0, 'The backend did not respond in time.');
    } finally {
      clearTimeout(timer);
    }
    let data: unknown;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!response.ok) {
      const err = (typeof data === 'object' && data !== null ? data : {}) as ErrorResponse;
      const fallback = STATUS_TEXT[response.status] || `Error ${response.status}`;
      // 4xx messages from the services are written for users (e.g. "Merchant code already exists");
      // 5xx messages may be raw exception text, so they are replaced by a generic one plus the request id.
      if (response.status >= 500) throw new AppError(response.status, `${fallback} (request ${id.slice(0, 8)})`);
      throw new AppError(response.status, err.error || fallback, err.errors ?? []);
    }
    return data as T;
  }

  return {
    get: (path, query) => request('GET', path, undefined, query),
    post: (path, body, query) => request('POST', path, body, query),
    put: (path, body) => request('PUT', path, body),
  };
}
