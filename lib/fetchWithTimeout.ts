/**
 * Fetch wrapper with automatic timeout via AbortController.
 * Returns the Response or throws on timeout/error.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Combine caller's signal (if any) with our timeout signal
  const signal =
    options.signal && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal;

  try {
    const response = await fetch(url, {
      ...options,
      signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
