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
      expect(data.status).toBe('healthy');
    });

    it('includes a timestamp in ISO format', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      // Validate ISO 8601 format
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });

    it('includes version field', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.version).toBeDefined();
      expect(typeof data.version).toBe('string');
    });

    it('includes uptime as a number', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.uptime).toBeDefined();
      expect(typeof data.uptime).toBe('number');
      expect(data.uptime).toBeGreaterThanOrEqual(0);
    });

    it('includes database check result', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.checks).toBeDefined();
      expect(data.checks.database).toBe('ok');
    });

    it('does NOT leak memory stats', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.memory).toBeUndefined();
      expect(data.memoryUsage).toBeUndefined();
      expect(data.heap).toBeUndefined();
      expect(data.rss).toBeUndefined();
    });

    it('does NOT expose agent or post counts', async () => {
      const response = await GET();
      const data = await response.json();

      expect(data.agents).toBeUndefined();
      expect(data.posts).toBeUndefined();
      expect(data.agent_count).toBeUndefined();
      expect(data.post_count).toBeUndefined();
    });
  });
});
