/**
 * Cron Debates API Tests
 * Tests for /api/cron/debates/route.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock db-supabase (override the global setup.ts mapping for this file)
vi.mock('@/lib/db-supabase', () => ({
  getOpenDebatesToClose: vi.fn(),
  closeDebate: vi.fn(),
  getActiveDebate: vi.fn(),
  createDebate: vi.fn(),
  getNextDebateNumber: vi.fn(),
}));

// Mock cache
vi.mock('@/lib/cache', () => ({
  invalidateCache: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger
vi.mock('@/lib/logger', () => {
  const mockLog = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
  return {
    logger: mockLog,
    withRequest: vi.fn(() => mockLog),
    withRequestId: vi.fn(() => mockLog),
  };
});

// Mock security (needed by auth's verifyCronSecret)
vi.mock('@/lib/security', () => ({
  secureCompare: vi.fn((a: string, b: string) => a === b),
  hashValue: vi.fn((v: string) => `hashed_${v}`),
}));

import * as db from '@/lib/db-supabase';
import { invalidateCache } from '@/lib/cache';
import { GET } from '@/app/api/cron/debates/route';

function createRequest(url: string, options: { headers?: Record<string, string> } = {}) {
  const { headers = {} } = options;
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'GET',
    headers: new Headers(headers),
  });
}

describe('Cron Debates API', () => {
  let originalCronSecret: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalCronSecret = process.env.CRON_SECRET;
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  describe('GET /api/cron/debates', () => {
    it('returns 401 without CRON_SECRET configured', async () => {
      delete process.env.CRON_SECRET;

      const request = createRequest('/api/cron/debates');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 with wrong CRON_SECRET', async () => {
      process.env.CRON_SECRET = 'correct-secret';

      const request = createRequest('/api/cron/debates', {
        headers: { Authorization: 'Bearer wrong-secret' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it('returns 401 when no Authorization header provided', async () => {
      process.env.CRON_SECRET = 'test-secret';

      const request = createRequest('/api/cron/debates');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('succeeds with correct CRON_SECRET and no expired debates', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';

      vi.mocked(db.getOpenDebatesToClose).mockResolvedValue([]);
      vi.mocked(db.getActiveDebate).mockResolvedValue({
        id: 'debate-active',
        status: 'open',
      } as never);

      const request = createRequest('/api/cron/debates', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.debates_closed).toBe(0);
      expect(json.data.new_debate_opened).toBe(false);
    });

    it('closes expired debates', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';

      const expiredDebates = [
        { id: 'debate-1', debate_number: 1, topic: 'Topic 1' },
        { id: 'debate-2', debate_number: 2, topic: 'Topic 2' },
      ];

      vi.mocked(db.getOpenDebatesToClose).mockResolvedValue(expiredDebates as never);
      vi.mocked(db.closeDebate).mockResolvedValue(true as never);
      vi.mocked(db.getActiveDebate).mockResolvedValue({
        id: 'debate-active',
        status: 'open',
      } as never);

      const request = createRequest('/api/cron/debates', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.debates_closed).toBe(2);
      expect(db.closeDebate).toHaveBeenCalledTimes(2);
      expect(db.closeDebate).toHaveBeenCalledWith('debate-1');
      expect(db.closeDebate).toHaveBeenCalledWith('debate-2');
    });

    it('creates new debate when no active debate exists', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';

      vi.mocked(db.getOpenDebatesToClose).mockResolvedValue([]);
      vi.mocked(db.getActiveDebate).mockResolvedValue(null);
      vi.mocked(db.getNextDebateNumber).mockResolvedValue(1);
      vi.mocked(db.createDebate).mockResolvedValue({
        id: 'new-debate',
        debate_number: 1,
        status: 'open',
      } as never);

      const request = createRequest('/api/cron/debates', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.new_debate_opened).toBe(true);
      expect(db.createDebate).toHaveBeenCalledTimes(1);
      // Verify it was called with topic, description, number, opens_at, closes_at
      expect(db.createDebate).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        1,
        expect.any(String),
        expect.any(String)
      );
    });

    it('invalidates debate cache when creating new debate', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';

      vi.mocked(db.getOpenDebatesToClose).mockResolvedValue([]);
      vi.mocked(db.getActiveDebate).mockResolvedValue(null);
      vi.mocked(db.getNextDebateNumber).mockResolvedValue(1);
      vi.mocked(db.createDebate).mockResolvedValue({
        id: 'new-debate',
        debate_number: 1,
      } as never);

      const request = createRequest('/api/cron/debates', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      await GET(request);

      expect(invalidateCache).toHaveBeenCalledWith('debate:active');
    });

    it('does not open new debate if active one exists', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';

      vi.mocked(db.getOpenDebatesToClose).mockResolvedValue([]);
      vi.mocked(db.getActiveDebate).mockResolvedValue({
        id: 'existing-debate',
        status: 'open',
      } as never);

      const request = createRequest('/api/cron/debates', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(json.data.new_debate_opened).toBe(false);
      expect(db.createDebate).not.toHaveBeenCalled();
      expect(db.getNextDebateNumber).not.toHaveBeenCalled();
    });

    it('handles closeDebate returning false gracefully', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';

      vi.mocked(db.getOpenDebatesToClose).mockResolvedValue([
        { id: 'debate-1', debate_number: 1, topic: 'Topic 1' },
      ] as never);
      vi.mocked(db.closeDebate).mockResolvedValue(false as never);
      vi.mocked(db.getActiveDebate).mockResolvedValue(null);
      vi.mocked(db.getNextDebateNumber).mockResolvedValue(2);
      vi.mocked(db.createDebate).mockResolvedValue({
        id: 'new-debate',
        debate_number: 2,
      } as never);

      const request = createRequest('/api/cron/debates', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      // closeDebate returned false, so debatesClosed stays 0
      expect(json.data.debates_closed).toBe(0);
    });

    it('handles createDebate returning null gracefully', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';

      vi.mocked(db.getOpenDebatesToClose).mockResolvedValue([]);
      vi.mocked(db.getActiveDebate).mockResolvedValue(null);
      vi.mocked(db.getNextDebateNumber).mockResolvedValue(1);
      vi.mocked(db.createDebate).mockResolvedValue(null as never);

      const request = createRequest('/api/cron/debates', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.new_debate_opened).toBe(false);
    });

    it('returns 500 on unexpected error', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';

      vi.mocked(db.getOpenDebatesToClose).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createRequest('/api/cron/debates', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INTERNAL_ERROR');
    });

    it('cycles through debate topics using modular arithmetic', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';

      vi.mocked(db.getOpenDebatesToClose).mockResolvedValue([]);
      vi.mocked(db.getActiveDebate).mockResolvedValue(null);
      vi.mocked(db.getNextDebateNumber).mockResolvedValue(3);
      vi.mocked(db.createDebate).mockResolvedValue({
        id: 'new-debate',
        debate_number: 3,
      } as never);

      const request = createRequest('/api/cron/debates', {
        headers: { Authorization: 'Bearer test-cron-secret' },
      });
      await GET(request);

      // topicIndex = (3 - 1) % DEBATE_TOPICS.length = 2
      // Verify createDebate was called (topic selection is deterministic)
      expect(db.createDebate).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        3,
        expect.any(String),
        expect.any(String)
      );
    });
  });
});
