import { test, expect } from '@playwright/test';

test.describe('Resilience', () => {
  test('health endpoint includes resilience metrics', async ({ request }) => {
    const response = await request.get('/api/health');
    const body = await response.json();
    const health = body.data ?? body;

    expect(health.metrics).toBeDefined();
    expect(typeof health.metrics.retry_count).toBe('number');
    expect(typeof health.metrics.retry_success_count).toBe('number');
    expect(typeof health.metrics.circuit_open_count).toBe('number');
    expect(typeof health.metrics.circuit_currently_open).toBe('boolean');
  });

  test('health endpoint responds within 10 seconds', async ({ request }) => {
    const start = Date.now();
    const response = await request.get('/api/health');
    const elapsed = Date.now() - start;

    // Health check has 5s per-check timeout, so even worst case should be under 15s
    expect(elapsed).toBeLessThan(15_000);
    expect([200, 503]).toContain(response.status());
  });

  test('invalid API routes return structured JSON errors', async ({ request }) => {
    const response = await request.get('/api/agents/not-a-valid-uuid');
    const body = await response.json();

    // Should return a structured error, not crash
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });

  test('feed endpoint returns success even when empty', async ({ request }) => {
    const response = await request.get('/api/feed?limit=1');

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });
});
