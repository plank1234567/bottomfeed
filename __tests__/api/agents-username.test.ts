/**
 * Tests for GET/PATCH/DELETE /api/agents/[username]
 * Tests agent profile retrieval, profile updates, and account deletion.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock db-supabase
vi.mock('@/lib/db-supabase', () => ({
  getAgentByUsername: vi.fn(),
  getAgentByApiKey: vi.fn(),
  getAgentPosts: vi.fn(),
  getAgentReplies: vi.fn(),
  getAgentLikes: vi.fn(),
  getAgentEngagementStats: vi.fn(),
  updateAgentProfile: vi.fn(),
  deleteAgent: vi.fn(),
}));

// Mock auth — importOriginal to preserve AuthError and error classes
vi.mock('@/lib/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    authenticateAgentAsync: vi.fn(),
  };
});

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    audit: vi.fn(),
  },
}));

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  withScope: vi.fn(),
  captureException: vi.fn(),
}));

import * as db from '@/lib/db-supabase';
import { authenticateAgentAsync, ForbiddenError, UnauthorizedError } from '@/lib/auth';
import { GET, PATCH, DELETE } from '@/app/api/agents/[username]/route';

// Helper: create a NextRequest
function createRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: unknown } = {}
) {
  const { method = 'GET', headers = {}, body } = options;
  const init: RequestInit = {
    method,
    headers: new Headers(headers),
  };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Headers).set('Content-Type', 'application/json');
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init);
}

// Helper: create params object (Next.js 15 App Router style)
function createParams(username: string) {
  return { params: Promise.resolve({ username }) };
}

// Shared test agent data
const mockAgent = {
  id: 'agent-123',
  username: 'testbot',
  display_name: 'Test Bot',
  bio: 'A test bot',
  avatar_url: 'https://example.com/avatar.png',
  banner_url: 'https://example.com/banner.png',
  model: 'gpt-4',
  provider: 'openai',
  capabilities: ['chat', 'code'],
  status: 'online',
  current_action: null,
  last_active: '2026-01-01T00:00:00Z',
  personality: 'Friendly and helpful',
  is_verified: true,
  trust_tier: 'autonomous-1',
  follower_count: 10,
  following_count: 5,
  post_count: 42,
  like_count: 100,
  reputation_score: 85,
  created_at: '2025-06-01T00:00:00Z',
  website_url: 'https://example.com',
  github_url: 'https://github.com/testbot',
  twitter_handle: 'testbot',
  claim_status: null,
};

const mockPosts = [{ id: 'post-1', content: 'Hello world', agent_id: 'agent-123' }];

const mockReplies = [{ id: 'reply-1', content: 'Nice post!', agent_id: 'agent-123' }];

const mockLikes = [{ id: 'like-post-1', content: 'Liked post', agent_id: 'agent-456' }];

const mockStats = {
  total_posts: 42,
  total_replies: 15,
  total_likes_given: 100,
  engagement_rate: 3.5,
};

describe('GET /api/agents/[username]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns agent profile with posts, replies, likes, and stats', async () => {
    vi.mocked(db.getAgentByUsername).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentPosts).mockResolvedValue(mockPosts as never);
    vi.mocked(db.getAgentReplies).mockResolvedValue(mockReplies as never);
    vi.mocked(db.getAgentLikes).mockResolvedValue(mockLikes as never);
    vi.mocked(db.getAgentEngagementStats).mockResolvedValue(mockStats as never);

    const request = createRequest('/api/agents/testbot');
    const response = await GET(request, createParams('testbot'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.agent.username).toBe('testbot');
    expect(json.data.agent.display_name).toBe('Test Bot');
    expect(json.data.agent.model).toBe('gpt-4');
    expect(json.data.posts).toEqual(mockPosts);
    expect(json.data.replies).toEqual(mockReplies);
    expect(json.data.likes).toEqual(mockLikes);
    expect(json.data.stats).toEqual(mockStats);
  });

  it('returns all expected agent fields', async () => {
    vi.mocked(db.getAgentByUsername).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentPosts).mockResolvedValue([]);
    vi.mocked(db.getAgentReplies).mockResolvedValue([]);
    vi.mocked(db.getAgentLikes).mockResolvedValue([]);
    vi.mocked(db.getAgentEngagementStats).mockResolvedValue(mockStats as never);

    const request = createRequest('/api/agents/testbot');
    const response = await GET(request, createParams('testbot'));
    const json = await response.json();

    const agent = json.data.agent;
    expect(agent).toHaveProperty('id');
    expect(agent).toHaveProperty('username');
    expect(agent).toHaveProperty('display_name');
    expect(agent).toHaveProperty('bio');
    expect(agent).toHaveProperty('avatar_url');
    expect(agent).toHaveProperty('banner_url');
    expect(agent).toHaveProperty('model');
    expect(agent).toHaveProperty('provider');
    expect(agent).toHaveProperty('capabilities');
    expect(agent).toHaveProperty('status');
    expect(agent).toHaveProperty('personality');
    expect(agent).toHaveProperty('is_verified');
    expect(agent).toHaveProperty('trust_tier');
    expect(agent).toHaveProperty('follower_count');
    expect(agent).toHaveProperty('following_count');
    expect(agent).toHaveProperty('post_count');
    expect(agent).toHaveProperty('like_count');
    expect(agent).toHaveProperty('reputation_score');
    expect(agent).toHaveProperty('created_at');
    expect(agent).toHaveProperty('website_url');
    expect(agent).toHaveProperty('github_url');
    expect(agent).toHaveProperty('twitter_handle');
    expect(agent).toHaveProperty('claim_status');
  });

  it('returns 404 for non-existent agent', async () => {
    vi.mocked(db.getAgentByUsername).mockResolvedValue(null);

    const request = createRequest('/api/agents/nonexistent');
    const response = await GET(request, createParams('nonexistent'));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('calls db functions with correct arguments', async () => {
    vi.mocked(db.getAgentByUsername).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentPosts).mockResolvedValue([]);
    vi.mocked(db.getAgentReplies).mockResolvedValue([]);
    vi.mocked(db.getAgentLikes).mockResolvedValue([]);
    vi.mocked(db.getAgentEngagementStats).mockResolvedValue(mockStats as never);

    const request = createRequest('/api/agents/testbot');
    await GET(request, createParams('testbot'));

    expect(db.getAgentByUsername).toHaveBeenCalledWith('testbot');
    expect(db.getAgentPosts).toHaveBeenCalledWith('testbot', 50, 'agent-123');
    expect(db.getAgentReplies).toHaveBeenCalledWith('testbot', 50, 'agent-123');
    expect(db.getAgentLikes).toHaveBeenCalledWith('testbot', 50);
    expect(db.getAgentEngagementStats).toHaveBeenCalledWith('agent-123');
  });

  it('handles database error gracefully', async () => {
    vi.mocked(db.getAgentByUsername).mockRejectedValue(new Error('DB connection failed'));

    const request = createRequest('/api/agents/testbot');
    const response = await GET(request, createParams('testbot'));

    expect(response.status).toBe(500);
  });
});

describe('PATCH /api/agents/[username]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(authenticateAgentAsync).mockRejectedValue(
      new UnauthorizedError('API key required. Use Authorization: Bearer <api_key>')
    );

    const request = createRequest('/api/agents/testbot', {
      method: 'PATCH',
      body: { bio: 'Updated bio' },
    });
    const response = await PATCH(request, createParams('testbot'));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when agent does not exist', async () => {
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentByUsername).mockResolvedValue(null);

    const request = createRequest('/api/agents/nonexistent', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-key' },
      body: { bio: 'Updated bio' },
    });
    const response = await PATCH(request, createParams('nonexistent'));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when trying to update another agent profile', async () => {
    const otherAgent = { ...mockAgent, id: 'agent-other', username: 'otherbot' };
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentByUsername).mockResolvedValue(otherAgent as never);

    const request = createRequest('/api/agents/otherbot', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-key' },
      body: { bio: 'Trying to update someone else' },
    });
    const response = await PATCH(request, createParams('otherbot'));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('updates bio successfully', async () => {
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentByUsername).mockResolvedValue(mockAgent as never);
    vi.mocked(db.updateAgentProfile).mockResolvedValue(undefined as never);

    const request = createRequest('/api/agents/testbot', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-key' },
      body: { bio: 'My new bio' },
    });
    const response = await PATCH(request, createParams('testbot'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.updated).toBe(true);
    expect(json.data.bio).toBe('My new bio');
    expect(db.updateAgentProfile).toHaveBeenCalledWith('agent-123', { bio: 'My new bio' });
  });

  it('updates multiple fields at once', async () => {
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentByUsername).mockResolvedValue(mockAgent as never);
    vi.mocked(db.updateAgentProfile).mockResolvedValue(undefined as never);

    const request = createRequest('/api/agents/testbot', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-key' },
      body: {
        bio: 'Updated bio',
        personality: 'Now more serious',
        twitter_handle: 'newhandle',
      },
    });
    const response = await PATCH(request, createParams('testbot'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.updated).toBe(true);
    expect(json.data.bio).toBe('Updated bio');
    expect(json.data.personality).toBe('Now more serious');
    expect(json.data.twitter_handle).toBe('newhandle');
  });

  it('does not call updateAgentProfile when no fields provided', async () => {
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentByUsername).mockResolvedValue(mockAgent as never);

    const request = createRequest('/api/agents/testbot', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-key' },
      body: {},
    });
    const response = await PATCH(request, createParams('testbot'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.updated).toBe(true);
    expect(db.updateAgentProfile).not.toHaveBeenCalled();
  });

  it('rejects invalid validation data (bio too long)', async () => {
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentByUsername).mockResolvedValue(mockAgent as never);

    const request = createRequest('/api/agents/testbot', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-key' },
      body: { bio: 'x'.repeat(501) },
    });
    const response = await PATCH(request, createParams('testbot'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it('rejects invalid twitter handle format', async () => {
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentByUsername).mockResolvedValue(mockAgent as never);

    const request = createRequest('/api/agents/testbot', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-key' },
      body: { twitter_handle: 'invalid handle with spaces!' },
    });
    const response = await PATCH(request, createParams('testbot'));

    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/agents/[username]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(authenticateAgentAsync).mockRejectedValue(
      new UnauthorizedError('API key required. Use Authorization: Bearer <api_key>')
    );

    const request = createRequest('/api/agents/testbot', { method: 'DELETE' });
    const response = await DELETE(request, createParams('testbot'));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('returns 404 when agent does not exist', async () => {
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentByUsername).mockResolvedValue(null);

    const request = createRequest('/api/agents/nonexistent', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-key' },
    });
    const response = await DELETE(request, createParams('nonexistent'));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when trying to delete another agent', async () => {
    const otherAgent = { ...mockAgent, id: 'agent-other', username: 'otherbot' };
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentByUsername).mockResolvedValue(otherAgent as never);

    const request = createRequest('/api/agents/otherbot', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-key' },
    });
    const response = await DELETE(request, createParams('otherbot'));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('deletes agent successfully', async () => {
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentByUsername).mockResolvedValue(mockAgent as never);
    vi.mocked(db.deleteAgent).mockResolvedValue(undefined as never);

    const request = createRequest('/api/agents/testbot', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-key' },
    });
    const response = await DELETE(request, createParams('testbot'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.deleted).toBe(true);
    expect(json.data.username).toBe('testbot');
    expect(db.deleteAgent).toHaveBeenCalledWith('agent-123');
  });

  it('handles database error on deletion', async () => {
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentByUsername).mockResolvedValue(mockAgent as never);
    vi.mocked(db.deleteAgent).mockRejectedValue(new Error('Cascade delete failed'));

    const request = createRequest('/api/agents/testbot', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-key' },
    });
    const response = await DELETE(request, createParams('testbot'));

    expect(response.status).toBe(500);
  });
});
