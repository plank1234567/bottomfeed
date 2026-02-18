/**
 * Tests for GET /api/posts/[id]/engagements
 * Tests engagement retrieval for likes and reposts, pagination, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock db-supabase
vi.mock('@/lib/db-supabase', () => ({
  getPostLikers: vi.fn(),
  getPostReposters: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  withScope: vi.fn(),
  captureException: vi.fn(),
}));

import * as db from '@/lib/db-supabase';
import { GET } from '@/app/api/posts/[id]/engagements/route';

// Helper: create a NextRequest with optional search params
function createRequest(url: string, options: { searchParams?: Record<string, string> } = {}) {
  const { searchParams = {} } = options;
  const urlObj = new URL(url, 'http://localhost:3000');
  for (const [key, value] of Object.entries(searchParams)) {
    urlObj.searchParams.set(key, value);
  }
  return new NextRequest(urlObj, { method: 'GET' });
}

// Helper: create params object (Next.js 15 App Router style)
function createParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// Shared mock agent data
const mockLikerAgent = {
  id: 'a0000000-0000-4000-8000-000000000011',
  username: 'likerbot',
  display_name: 'Liker Bot',
  avatar_url: 'https://example.com/liker.png',
  model: 'gpt-4',
  is_verified: true,
  trust_tier: 'autonomous-1',
};

const mockReposterAgent = {
  id: 'a0000000-0000-4000-8000-000000000012',
  username: 'reposterbot',
  display_name: 'Reposter Bot',
  avatar_url: 'https://example.com/reposter.png',
  model: 'claude-3',
  is_verified: false,
  trust_tier: 'standard',
};

describe('GET /api/posts/[id]/engagements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('type=likes (default)', () => {
    it('returns likers for a post with default type', async () => {
      vi.mocked(db.getPostLikers).mockResolvedValue({
        agents: [mockLikerAgent],
        total: 1,
      } as never);

      const request = createRequest('/api/posts/20000000-0000-4000-8000-000000000001/engagements');
      const response = await GET(request, createParams('20000000-0000-4000-8000-000000000001'));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.type).toBe('likes');
      expect(json.data.total).toBe(1);
      expect(json.data.agents).toHaveLength(1);
      expect(json.data.agents[0].username).toBe('likerbot');
    });

    it('returns likers when type=likes is explicit', async () => {
      vi.mocked(db.getPostLikers).mockResolvedValue({
        agents: [mockLikerAgent],
        total: 1,
      } as never);

      const request = createRequest('/api/posts/20000000-0000-4000-8000-000000000001/engagements', {
        searchParams: { type: 'likes' },
      });
      const response = await GET(request, createParams('20000000-0000-4000-8000-000000000001'));
      const json = await response.json();

      expect(json.data.type).toBe('likes');
      expect(db.getPostLikers).toHaveBeenCalledWith('20000000-0000-4000-8000-000000000001', 50, 0);
    });

    it('maps agent fields correctly', async () => {
      vi.mocked(db.getPostLikers).mockResolvedValue({
        agents: [mockLikerAgent],
        total: 1,
      } as never);

      const request = createRequest('/api/posts/20000000-0000-4000-8000-000000000001/engagements');
      const response = await GET(request, createParams('20000000-0000-4000-8000-000000000001'));
      const json = await response.json();

      const agent = json.data.agents[0];
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('username');
      expect(agent).toHaveProperty('display_name');
      expect(agent).toHaveProperty('avatar_url');
      expect(agent).toHaveProperty('model');
      expect(agent).toHaveProperty('is_verified');
      expect(agent).toHaveProperty('trust_tier');
    });

    it('returns empty agents array when no likers exist', async () => {
      vi.mocked(db.getPostLikers).mockResolvedValue({
        agents: [],
        total: 0,
      } as never);

      const request = createRequest('/api/posts/20000000-0000-4000-8000-000000000001/engagements');
      const response = await GET(request, createParams('20000000-0000-4000-8000-000000000001'));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.total).toBe(0);
      expect(json.data.agents).toEqual([]);
      expect(json.data.has_more).toBe(false);
    });
  });

  describe('type=reposts', () => {
    it('returns reposters for a post', async () => {
      vi.mocked(db.getPostReposters).mockResolvedValue({
        agents: [mockReposterAgent],
        total: 1,
      } as never);

      const request = createRequest('/api/posts/20000000-0000-4000-8000-000000000001/engagements', {
        searchParams: { type: 'reposts' },
      });
      const response = await GET(request, createParams('20000000-0000-4000-8000-000000000001'));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.type).toBe('reposts');
      expect(json.data.total).toBe(1);
      expect(json.data.agents).toHaveLength(1);
      expect(json.data.agents[0].username).toBe('reposterbot');
      expect(db.getPostReposters).toHaveBeenCalledWith(
        '20000000-0000-4000-8000-000000000001',
        50,
        0
      );
    });

    it('returns empty agents array when no reposters exist', async () => {
      vi.mocked(db.getPostReposters).mockResolvedValue({
        agents: [],
        total: 0,
      } as never);

      const request = createRequest('/api/posts/20000000-0000-4000-8000-000000000001/engagements', {
        searchParams: { type: 'reposts' },
      });
      const response = await GET(request, createParams('20000000-0000-4000-8000-000000000001'));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.total).toBe(0);
      expect(json.data.agents).toEqual([]);
    });
  });

  describe('pagination', () => {
    it('passes limit parameter to db function', async () => {
      vi.mocked(db.getPostLikers).mockResolvedValue({
        agents: [],
        total: 0,
      } as never);

      const request = createRequest('/api/posts/20000000-0000-4000-8000-000000000001/engagements', {
        searchParams: { limit: '10' },
      });
      await GET(request, createParams('20000000-0000-4000-8000-000000000001'));

      expect(db.getPostLikers).toHaveBeenCalledWith('20000000-0000-4000-8000-000000000001', 10, 0);
    });

    it('passes offset parameter to db function', async () => {
      vi.mocked(db.getPostLikers).mockResolvedValue({
        agents: [],
        total: 0,
      } as never);

      const request = createRequest('/api/posts/20000000-0000-4000-8000-000000000001/engagements', {
        searchParams: { offset: '20' },
      });
      await GET(request, createParams('20000000-0000-4000-8000-000000000001'));

      expect(db.getPostLikers).toHaveBeenCalledWith('20000000-0000-4000-8000-000000000001', 50, 20);
    });

    it('passes both limit and offset to db function', async () => {
      vi.mocked(db.getPostReposters).mockResolvedValue({
        agents: [],
        total: 0,
      } as never);

      const request = createRequest('/api/posts/20000000-0000-4000-8000-000000000001/engagements', {
        searchParams: { type: 'reposts', limit: '25', offset: '50' },
      });
      await GET(request, createParams('20000000-0000-4000-8000-000000000001'));

      expect(db.getPostReposters).toHaveBeenCalledWith(
        '20000000-0000-4000-8000-000000000001',
        25,
        50
      );
    });

    it('clamps limit to MAX_PAGE_SIZE (100)', async () => {
      vi.mocked(db.getPostLikers).mockResolvedValue({
        agents: [],
        total: 0,
      } as never);

      const request = createRequest('/api/posts/20000000-0000-4000-8000-000000000001/engagements', {
        searchParams: { limit: '500' },
      });
      await GET(request, createParams('20000000-0000-4000-8000-000000000001'));

      expect(db.getPostLikers).toHaveBeenCalledWith('20000000-0000-4000-8000-000000000001', 100, 0);
    });

    it('uses default limit for invalid limit value', async () => {
      vi.mocked(db.getPostLikers).mockResolvedValue({
        agents: [],
        total: 0,
      } as never);

      const request = createRequest('/api/posts/20000000-0000-4000-8000-000000000001/engagements', {
        searchParams: { limit: 'invalid' },
      });
      await GET(request, createParams('20000000-0000-4000-8000-000000000001'));

      expect(db.getPostLikers).toHaveBeenCalledWith('20000000-0000-4000-8000-000000000001', 50, 0);
    });

    it('treats negative offset as 0', async () => {
      vi.mocked(db.getPostLikers).mockResolvedValue({
        agents: [],
        total: 0,
      } as never);

      const request = createRequest('/api/posts/20000000-0000-4000-8000-000000000001/engagements', {
        searchParams: { offset: '-5' },
      });
      await GET(request, createParams('20000000-0000-4000-8000-000000000001'));

      expect(db.getPostLikers).toHaveBeenCalledWith('20000000-0000-4000-8000-000000000001', 50, 0);
    });

    it('returns has_more=true when more results exist', async () => {
      vi.mocked(db.getPostLikers).mockResolvedValue({
        agents: [mockLikerAgent],
        total: 100,
      } as never);

      const request = createRequest('/api/posts/20000000-0000-4000-8000-000000000001/engagements', {
        searchParams: { limit: '10', offset: '0' },
      });
      const response = await GET(request, createParams('20000000-0000-4000-8000-000000000001'));
      const json = await response.json();

      expect(json.data.has_more).toBe(true);
    });

    it('returns has_more=false when at end of results', async () => {
      vi.mocked(db.getPostLikers).mockResolvedValue({
        agents: [mockLikerAgent],
        total: 5,
      } as never);

      const request = createRequest('/api/posts/20000000-0000-4000-8000-000000000001/engagements', {
        searchParams: { limit: '10', offset: '0' },
      });
      const response = await GET(request, createParams('20000000-0000-4000-8000-000000000001'));
      const json = await response.json();

      expect(json.data.has_more).toBe(false);
    });
  });

  describe('error handling', () => {
    it('returns 400 for invalid type parameter', async () => {
      const request = createRequest('/api/posts/20000000-0000-4000-8000-000000000001/engagements', {
        searchParams: { type: 'invalid' },
      });
      const response = await GET(request, createParams('20000000-0000-4000-8000-000000000001'));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for type=bookmarks (unsupported)', async () => {
      const request = createRequest('/api/posts/20000000-0000-4000-8000-000000000001/engagements', {
        searchParams: { type: 'bookmarks' },
      });
      const response = await GET(request, createParams('20000000-0000-4000-8000-000000000001'));

      expect(response.status).toBe(400);
    });

    it('handles database error gracefully', async () => {
      vi.mocked(db.getPostLikers).mockRejectedValue(new Error('DB connection failed'));

      const request = createRequest('/api/posts/20000000-0000-4000-8000-000000000001/engagements');
      const response = await GET(request, createParams('20000000-0000-4000-8000-000000000001'));

      expect(response.status).toBe(500);
    });
  });
});
