import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isTwitterConfigured, verifyTweetContainsCode } from '@/lib/twitter';

// global.fetch is already mocked in setup.ts; we cast it for convenience.
const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

describe('isTwitterConfigured', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns false when TWITTER_BEARER_TOKEN is not set', () => {
    delete process.env.TWITTER_BEARER_TOKEN;
    expect(isTwitterConfigured()).toBe(false);
  });

  it('returns true when TWITTER_BEARER_TOKEN is set', () => {
    process.env.TWITTER_BEARER_TOKEN = 'test-token';
    expect(isTwitterConfigured()).toBe(true);
  });
});

describe('verifyTweetContainsCode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null when TWITTER_BEARER_TOKEN is not set', async () => {
    delete process.env.TWITTER_BEARER_TOKEN;
    const result = await verifyTweetContainsCode('someuser', 'reef-ABC123');
    expect(result).toBeNull();
    // fetch should not have been called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns verified:true when a tweet contains the verification code', async () => {
    process.env.TWITTER_BEARER_TOKEN = 'test-bearer-token';

    // Mock user lookup
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: '12345', username: 'testuser' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // Mock tweets fetch
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            { text: 'Hello world!', created_at: '2024-01-01T00:00:00Z' },
            {
              text: 'Verifying my BottomFeed account: reef-ABCD1234',
              created_at: '2024-01-01T01:00:00Z',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await verifyTweetContainsCode('testuser', 'reef-ABCD1234');
    expect(result).toEqual({ verified: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns verified:false when no tweet contains the code', async () => {
    process.env.TWITTER_BEARER_TOKEN = 'test-bearer-token';

    // Mock user lookup
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: '12345' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // Mock tweets with no matching code
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            { text: 'Just a normal tweet', created_at: '2024-01-01T00:00:00Z' },
            { text: 'Another tweet without the code', created_at: '2024-01-01T01:00:00Z' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await verifyTweetContainsCode('testuser', 'reef-NOTFOUND00');
    expect(result).not.toBeNull();
    expect(result!.verified).toBe(false);
    expect(result!.error).toContain('Verification code not found');
  });

  it('handles 404 (user not found) from user lookup', async () => {
    process.env.TWITTER_BEARER_TOKEN = 'test-bearer-token';

    mockFetch.mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

    const result = await verifyTweetContainsCode('nonexistentuser', 'reef-ABCD1234');
    expect(result).not.toBeNull();
    expect(result!.verified).toBe(false);
    expect(result!.error).toBe('Twitter user not found');
    // Should not attempt to fetch tweets
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('handles 429 rate limiting from user lookup', async () => {
    process.env.TWITTER_BEARER_TOKEN = 'test-bearer-token';

    mockFetch.mockResolvedValueOnce(new Response('Rate Limited', { status: 429 }));

    const result = await verifyTweetContainsCode('someuser', 'reef-ABCD1234');
    expect(result).not.toBeNull();
    expect(result!.verified).toBe(false);
    expect(result!.error).toContain('rate limit exceeded');
  });

  it('handles 429 rate limiting from tweets fetch', async () => {
    process.env.TWITTER_BEARER_TOKEN = 'test-bearer-token';

    // User lookup succeeds
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: '12345' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // Tweets fetch returns 429
    mockFetch.mockResolvedValueOnce(new Response('Rate Limited', { status: 429 }));

    const result = await verifyTweetContainsCode('someuser', 'reef-ABCD1234');
    expect(result).not.toBeNull();
    expect(result!.verified).toBe(false);
    expect(result!.error).toContain('rate limit exceeded');
  });

  it('handles generic API error (500) from user lookup', async () => {
    process.env.TWITTER_BEARER_TOKEN = 'test-bearer-token';

    mockFetch.mockResolvedValueOnce(new Response('Server Error', { status: 500 }));

    const result = await verifyTweetContainsCode('someuser', 'reef-ABCD1234');
    expect(result).not.toBeNull();
    expect(result!.verified).toBe(false);
    expect(result!.error).toContain('Twitter API error: 500');
  });

  it('handles generic API error (503) from tweets fetch', async () => {
    process.env.TWITTER_BEARER_TOKEN = 'test-bearer-token';

    // User lookup succeeds
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: '12345' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // Tweets fetch fails
    mockFetch.mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }));

    const result = await verifyTweetContainsCode('someuser', 'reef-ABCD1234');
    expect(result).not.toBeNull();
    expect(result!.verified).toBe(false);
    expect(result!.error).toContain('Failed to fetch tweets: 503');
  });

  it('handles network/fetch exception gracefully', async () => {
    process.env.TWITTER_BEARER_TOKEN = 'test-bearer-token';

    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await verifyTweetContainsCode('someuser', 'reef-ABCD1234');
    expect(result).not.toBeNull();
    expect(result!.verified).toBe(false);
    expect(result!.error).toContain('Failed to verify with Twitter');
  });

  it('handles timeout error gracefully', async () => {
    process.env.TWITTER_BEARER_TOKEN = 'test-bearer-token';

    const timeoutError = new DOMException('The operation was aborted', 'TimeoutError');
    mockFetch.mockRejectedValueOnce(timeoutError);

    const result = await verifyTweetContainsCode('someuser', 'reef-ABCD1234');
    expect(result).not.toBeNull();
    expect(result!.verified).toBe(false);
    expect(result!.error).toContain('timed out');
  });

  it('handles user lookup returning no data.id', async () => {
    process.env.TWITTER_BEARER_TOKEN = 'test-bearer-token';

    // User lookup succeeds but has no id in data
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await verifyTweetContainsCode('someuser', 'reef-ABCD1234');
    expect(result).not.toBeNull();
    expect(result!.verified).toBe(false);
    expect(result!.error).toBe('Twitter user not found');
  });

  it('handles empty tweets list', async () => {
    process.env.TWITTER_BEARER_TOKEN = 'test-bearer-token';

    // User lookup
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: '12345' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // Tweets fetch returns empty data
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await verifyTweetContainsCode('someuser', 'reef-ABCD1234');
    expect(result).not.toBeNull();
    expect(result!.verified).toBe(false);
    expect(result!.error).toContain('Verification code not found');
  });

  it('sends correct Authorization header in API calls', async () => {
    process.env.TWITTER_BEARER_TOKEN = 'my-secret-token';

    // User lookup
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: '12345' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    // Tweets fetch
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await verifyTweetContainsCode('testuser', 'reef-CODE1234');

    // Both calls should use the bearer token
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const firstCallArgs = mockFetch.mock.calls[0];
    expect(firstCallArgs[0]).toContain('users/by/username/testuser');
    expect(firstCallArgs[1].headers.Authorization).toBe('Bearer my-secret-token');

    const secondCallArgs = mockFetch.mock.calls[1];
    expect(secondCallArgs[0]).toContain('users/12345/tweets');
    expect(secondCallArgs[1].headers.Authorization).toBe('Bearer my-secret-token');
  });
});
