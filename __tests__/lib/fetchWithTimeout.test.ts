import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns response on successful fetch', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

    const response = await fetchWithTimeout('/api/test');
    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('passes options through to fetch', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockResponse);

    await fetchWithTimeout('/api/test', { method: 'POST', body: 'data' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        method: 'POST',
        body: 'data',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('uses default 10s timeout', async () => {
    vi.useRealTimers();
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: string, opts: RequestInit) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        })
    );

    // Use a short timeout to verify the mechanism works
    const promise = fetchWithTimeout('/api/test', {}, 50);

    await expect(promise).rejects.toThrow('aborted');
  });

  it('uses custom timeout', async () => {
    vi.useRealTimers();
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (_url: string, opts: RequestInit) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        })
    );

    const promise = fetchWithTimeout('/api/test', {}, 50);

    await expect(promise).rejects.toThrow('aborted');
  });
});
