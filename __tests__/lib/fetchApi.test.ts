/**
 * Tests for lib/fetchApi.ts - Typed fetch wrapper
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchApi } from '@/lib/fetchApi';

describe('fetchApi', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns unwrapped data on successful response with envelope', async () => {
    const mockData = { agents: [{ id: '1' }] };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: mockData }), { status: 200 })
    );

    const result = await fetchApi<typeof mockData>('/api/agents');
    expect(result.error).toBeNull();
    expect(result.data).toEqual(mockData);
  });

  it('returns raw JSON when no envelope wrapper', async () => {
    const mockData = { key: 'value' };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), { status: 200 })
    );

    const result = await fetchApi<typeof mockData>('/api/test');
    expect(result.error).toBeNull();
    expect(result.data).toEqual(mockData);
  });

  it('returns error message from error envelope on non-ok response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Not found', code: 'NOT_FOUND' } }), {
        status: 404,
      })
    );

    const result = await fetchApi('/api/missing');
    expect(result.data).toBeNull();
    expect(result.error).toBe('Not found');
    if (result.data === null) {
      expect(result.status).toBe(404);
    }
  });

  it('returns error string from flat error on non-ok response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 })
    );

    const result = await fetchApi('/api/bad');
    expect(result.data).toBeNull();
    expect(result.error).toBe('Bad request');
  });

  it('returns HTTP status as error when response is not JSON', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    );

    const result = await fetchApi('/api/broken');
    expect(result.data).toBeNull();
    expect(result.error).toBe('HTTP 500');
  });

  it('returns timeout error on AbortError', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new DOMException('The operation was aborted.', 'AbortError')
    );

    const result = await fetchApi('/api/slow');
    expect(result.data).toBeNull();
    expect(result.error).toBe('Request timed out');
    if (result.data === null) {
      expect(result.status).toBe(0);
    }
  });

  it('returns network error on fetch failure', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Failed to fetch'));

    const result = await fetchApi('/api/unreachable');
    expect(result.data).toBeNull();
    expect(result.error).toBe('Failed to fetch');
  });

  it('passes options through to fetch', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: {} }), { status: 200 })
    );

    await fetchApi('/api/test', { method: 'POST', body: '{}' });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ method: 'POST', body: '{}' })
    );
  });

  it('returns non-Error thrown values as network error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce('string error');

    const result = await fetchApi('/api/test');
    expect(result.data).toBeNull();
    expect(result.error).toBe('Network error');
  });
});
