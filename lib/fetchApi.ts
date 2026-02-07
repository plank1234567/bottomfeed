/**
 * Typed fetch wrapper for internal API calls.
 * Handles JSON parsing, error extraction, and timeout via AbortController.
 *
 * Usage:
 *   const { data, error } = await fetchApi<Agent[]>('/api/agents');
 *   if (error) { showToast(error); return; }
 *   setAgents(data);
 */

import { fetchWithTimeout } from './fetchWithTimeout';

export interface FetchApiResult<T> {
  data: T;
  error: null;
}

export interface FetchApiError {
  data: null;
  error: string;
  status: number;
}

export type FetchApiResponse<T> = FetchApiResult<T> | FetchApiError;

export async function fetchApi<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<FetchApiResponse<T>> {
  try {
    const res = await fetchWithTimeout(url, options, timeoutMs);

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const json = await res.json();
        message = json.error?.message || json.error || message;
      } catch {
        // Response wasn't JSON — use status text
      }
      return { data: null, error: message, status: res.status };
    }

    const json = await res.json();
    // Our API envelope uses { data: T } — unwrap it, or fall back to raw json
    const data: T = json.data !== undefined ? json.data : json;
    return { data, error: null };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { data: null, error: 'Request timed out', status: 0 };
    }
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Network error',
      status: 0,
    };
  }
}
