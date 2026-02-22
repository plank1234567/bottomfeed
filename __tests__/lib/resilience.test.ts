/**
 * Tests for lib/resilience.ts — retry with circuit breaker
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, _resetCircuitBreaker } from '@/lib/resilience';

describe('withRetry', () => {
  beforeEach(() => {
    _resetCircuitBreaker();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient TypeError (network failure)', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce('recovered');

    const promise = withRetry(fn, { baseDelayMs: 10 });
    // Advance past the backoff delay
    await vi.advanceTimersByTimeAsync(50);
    const result = await promise;

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on HTTP 503 error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ status: 503, message: 'Service Unavailable' })
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { baseDelayMs: 10 });
    await vi.advanceTimersByTimeAsync(50);
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on timeout error message', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('ETIMEDOUT')).mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { baseDelayMs: 10 });
    await vi.advanceTimersByTimeAsync(50);
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on 400 errors', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 400, message: 'Bad Request' });

    await expect(withRetry(fn)).rejects.toEqual({ status: 400, message: 'Bad Request' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on 401 errors', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 401, message: 'Unauthorized' });

    await expect(withRetry(fn)).rejects.toEqual({ status: 401, message: 'Unauthorized' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on 404 errors', async () => {
    const fn = vi.fn().mockRejectedValue({ status: 404, message: 'Not Found' });

    await expect(withRetry(fn)).rejects.toEqual({ status: 404, message: 'Not Found' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after max attempts on persistent transient errors', async () => {
    vi.useRealTimers();
    const fn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 5 })).rejects.toThrow('fetch failed');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('calls onRetry callback on each retry', async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { baseDelayMs: 10, onRetry });
    await vi.advanceTimersByTimeAsync(200);
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(expect.any(TypeError), 1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(TypeError), 2);
  });

  it('uses exponential backoff delays', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { baseDelayMs: 100 });

    // After 99ms, should still be on attempt 1
    await vi.advanceTimersByTimeAsync(99);
    expect(fn).toHaveBeenCalledTimes(1);

    // After 100ms (first backoff), attempt 2
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);

    // After 200ms (second backoff), attempt 3
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('circuit breaker', () => {
  beforeEach(() => {
    _resetCircuitBreaker();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens after 5 consecutive failures', async () => {
    const transientError = new TypeError('fetch failed');

    // Fail 5 times — each call exhausts maxAttempts=1 to trigger recordFailure
    for (let i = 0; i < 5; i++) {
      const fn = vi.fn().mockRejectedValue(transientError);
      await expect(withRetry(fn, { maxAttempts: 1 })).rejects.toThrow();
    }

    // 6th call should be short-circuited
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn)).rejects.toThrow('Circuit breaker is open');
    expect(fn).not.toHaveBeenCalled();
  });

  it('closes after the open duration expires', async () => {
    const transientError = new TypeError('fetch failed');

    // Trip the breaker
    for (let i = 0; i < 5; i++) {
      const fn = vi.fn().mockRejectedValue(transientError);
      await expect(withRetry(fn, { maxAttempts: 1 })).rejects.toThrow();
    }

    // Advance past 30s open duration
    await vi.advanceTimersByTimeAsync(30_001);

    // Should allow requests again (half-open)
    const fn = vi.fn().mockResolvedValue('recovered');
    const result = await withRetry(fn);
    expect(result).toBe('recovered');
  });

  it('resets failure counter on success', async () => {
    const transientError = new TypeError('fetch failed');

    // 4 failures (just below threshold)
    for (let i = 0; i < 4; i++) {
      const fn = vi.fn().mockRejectedValue(transientError);
      await expect(withRetry(fn, { maxAttempts: 1 })).rejects.toThrow();
    }

    // 1 success resets counter
    const successFn = vi.fn().mockResolvedValue('ok');
    await withRetry(successFn);

    // 4 more failures should not trip breaker
    for (let i = 0; i < 4; i++) {
      const fn = vi.fn().mockRejectedValue(transientError);
      await expect(withRetry(fn, { maxAttempts: 1 })).rejects.toThrow();
    }

    // Should still work — not tripped
    const fn2 = vi.fn().mockResolvedValue('still ok');
    const result = await withRetry(fn2);
    expect(result).toBe('still ok');
  });

  it('resets failure counter when outside the time window', async () => {
    const transientError = new TypeError('fetch failed');

    // 4 failures
    for (let i = 0; i < 4; i++) {
      const fn = vi.fn().mockRejectedValue(transientError);
      await expect(withRetry(fn, { maxAttempts: 1 })).rejects.toThrow();
    }

    // Advance past the 60s failure window
    await vi.advanceTimersByTimeAsync(61_000);

    // 1 more failure resets counter to 1 (outside window)
    const fn = vi.fn().mockRejectedValue(transientError);
    await expect(withRetry(fn, { maxAttempts: 1 })).rejects.toThrow();

    // Should still work — only 1 failure in current window
    const fn2 = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn2);
    expect(result).toBe('ok');
  });
});
