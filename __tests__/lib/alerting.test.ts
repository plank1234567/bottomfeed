/**
 * Tests for lib/alerting.ts — alert webhook system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendAlert, _resetAlertState, type AlertPayload } from '@/lib/alerting';

describe('sendAlert', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    _resetAlertState();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('does nothing when ALERT_WEBHOOK_URL is not set', () => {
    delete process.env.ALERT_WEBHOOK_URL;

    sendAlert({ level: 'critical', title: 'test' });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends a POST to the webhook URL', () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/test';

    sendAlert({ level: 'critical', title: 'DB down', source: 'health' });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe('https://hooks.slack.com/test');
    expect(opts.method).toBe('POST');

    const body = JSON.parse(opts.body);
    expect(body.text).toBe('[CRITICAL] DB down');
    expect(body.source).toBe('health');
    expect(body.timestamp).toBeDefined();
  });

  it('includes HMAC signature when HMAC_KEY is set', () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.HMAC_KEY = 'test-secret';

    sendAlert({ level: 'warn', title: 'Cache error' });

    const [, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(opts.headers['X-Webhook-Signature']).toBeDefined();
    expect(opts.headers['X-Webhook-Signature']).toMatch(/^[a-f0-9]{64}$/);
  });

  it('does not include HMAC header when HMAC_KEY is not set', () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/test';
    delete process.env.HMAC_KEY;

    sendAlert({ level: 'info', title: 'Test' });

    const [, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(opts.headers['X-Webhook-Signature']).toBeUndefined();
  });

  it('deduplicates identical alerts within 5 minutes', () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/test';

    sendAlert({ level: 'critical', title: 'DB down', source: 'health' });
    sendAlert({ level: 'critical', title: 'DB down', source: 'health' });
    sendAlert({ level: 'critical', title: 'DB down', source: 'health' });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('allows alerts with different titles', () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/test';

    sendAlert({ level: 'critical', title: 'DB down' });
    sendAlert({ level: 'critical', title: 'Cache error' });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('allows alerts with different levels for same title', () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/test';

    sendAlert({ level: 'warn', title: 'DB slow' });
    sendAlert({ level: 'critical', title: 'DB slow' });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not throw when fetch fails', () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/test';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    // Should not throw
    expect(() => sendAlert({ level: 'critical', title: 'test' })).not.toThrow();
  });

  it('includes details in the payload when provided', () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/test';

    sendAlert({ level: 'critical', title: 'DB down', details: 'Connection refused on port 5432' });

    const [, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse(opts.body);
    expect(body.details).toBe('Connection refused on port 5432');
  });

  it('uses "bottomfeed" as default source', () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/test';

    sendAlert({ level: 'info', title: 'test' });

    const [, opts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse(opts.body);
    expect(body.source).toBe('bottomfeed');
  });
});
