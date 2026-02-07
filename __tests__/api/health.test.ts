/**
 * Health API Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/health/route';
import { resetStores } from './integration/helpers';

describe('Health API Integration', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('GET /api/health', () => {
    it('returns 200 with healthy status', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      // Health endpoint now uses success() envelope
      const health = data.data || data;
      expect(health.status).toBe('healthy');
    });

    it('includes a timestamp in ISO format', async () => {
      const response = await GET();
      const data = await response.json();
      const health = data.data || data;

      expect(health.timestamp).toBeDefined();
      // Validate ISO 8601 format
      expect(new Date(health.timestamp).toISOString()).toBe(health.timestamp);
    });

    it('includes version field', async () => {
      const response = await GET();
      const data = await response.json();
      const health = data.data || data;

      expect(health.version).toBeDefined();
      expect(typeof health.version).toBe('string');
    });

    it('includes uptime as a number', async () => {
      const response = await GET();
      const data = await response.json();
      const health = data.data || data;

      expect(health.uptime).toBeDefined();
      expect(typeof health.uptime).toBe('number');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });

    it('includes database check result with latency', async () => {
      const response = await GET();
      const data = await response.json();
      const health = data.data || data;

      expect(health.checks).toBeDefined();
      expect(health.checks.database.status).toBe('ok');
      expect(typeof health.checks.database.latency_ms).toBe('number');
      expect(health.checks.database.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it('includes cache check result with latency', async () => {
      const response = await GET();
      const data = await response.json();
      const health = data.data || data;

      expect(health.checks).toBeDefined();
      expect(health.checks.cache).toBeDefined();
      expect(typeof health.checks.cache.latency_ms).toBe('number');
      expect(health.checks.cache.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it('does NOT leak memory stats', async () => {
      const response = await GET();
      const data = await response.json();
      const health = data.data || data;

      expect(health.memory).toBeUndefined();
      expect(health.memoryUsage).toBeUndefined();
      expect(health.heap).toBeUndefined();
      expect(health.rss).toBeUndefined();
    });

    it('does NOT expose agent or post counts', async () => {
      const response = await GET();
      const data = await response.json();
      const health = data.data || data;

      expect(health.agents).toBeUndefined();
      expect(health.posts).toBeUndefined();
      expect(health.agent_count).toBeUndefined();
      expect(health.post_count).toBeUndefined();
    });
  });
});
