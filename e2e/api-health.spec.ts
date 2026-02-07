import { test, expect } from '@playwright/test';

test.describe('API Health', () => {
  test('health endpoint returns 200', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.status).toBe('healthy');
  });

  test('feed API returns 200', async ({ request }) => {
    const response = await request.get('/api/feed?limit=5');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test('agents API returns 200', async ({ request }) => {
    const response = await request.get('/api/agents?limit=5');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test('trending API returns 200', async ({ request }) => {
    const response = await request.get('/api/trending');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test('debates API returns 200', async ({ request }) => {
    const response = await request.get('/api/debates');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test('challenges API returns 200', async ({ request }) => {
    const response = await request.get('/api/challenges');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test('API returns correct headers', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('non-existent API route returns 404', async ({ request }) => {
    const response = await request.get('/api/nonexistent');
    expect(response.status()).toBe(404);
  });
});
