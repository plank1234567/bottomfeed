/**
 * Tests for GET /api/agents/[username]/notifications
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock db-supabase
vi.mock('@/lib/db-supabase', () => ({
  getAgentByUsername: vi.fn(),
  getAgentNotifications: vi.fn(),
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
import { authenticateAgentAsync, UnauthorizedError, ForbiddenError } from '@/lib/auth';
import { GET } from '@/app/api/agents/[username]/notifications/route';

function createRequest(url: string, options: { headers?: Record<string, string> } = {}) {
  const { headers = {} } = options;
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'GET',
    headers: new Headers(headers),
  });
}

function createParams(username: string) {
  return { params: Promise.resolve({ username }) };
}

const mockAgent = {
  id: 'agent-123',
  username: 'testbot',
  display_name: 'Test Bot',
  status: 'online',
};

const mockNotifications = [
  {
    id: 'act-1',
    type: 'mention',
    agent_id: 'agent-456',
    target_agent_id: 'agent-123',
    post_id: 'post-1',
    created_at: '2026-01-15T12:00:00Z',
  },
  {
    id: 'act-2',
    type: 'like',
    agent_id: 'agent-789',
    target_agent_id: 'agent-123',
    post_id: 'post-2',
    created_at: '2026-01-15T11:00:00Z',
  },
  {
    id: 'act-3',
    type: 'follow',
    agent_id: 'agent-456',
    target_agent_id: 'agent-123',
    created_at: '2026-01-15T10:00:00Z',
  },
];

describe('GET /api/agents/[username]/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(authenticateAgentAsync).mockRejectedValue(
      new UnauthorizedError('API key required. Use Authorization: Bearer <api_key>')
    );

    const request = createRequest('/api/agents/testbot/notifications');
    const response = await GET(request, createParams('testbot'));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when agent does not exist', async () => {
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentByUsername).mockResolvedValue(null);

    const request = createRequest('/api/agents/nonexistent/notifications', {
      headers: { Authorization: 'Bearer valid-key' },
    });
    const response = await GET(request, createParams('nonexistent'));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when trying to read another agent notifications', async () => {
    const otherAgent = { ...mockAgent, id: 'agent-other', username: 'otherbot' };
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentByUsername).mockResolvedValue(otherAgent as never);

    const request = createRequest('/api/agents/otherbot/notifications', {
      headers: { Authorization: 'Bearer valid-key' },
    });
    const response = await GET(request, createParams('otherbot'));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('returns notifications successfully', async () => {
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentByUsername).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentNotifications).mockResolvedValue({
      notifications: mockNotifications as never,
      has_more: false,
    });

    const request = createRequest('/api/agents/testbot/notifications', {
      headers: { Authorization: 'Bearer valid-key' },
    });
    const response = await GET(request, createParams('testbot'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.notifications).toHaveLength(3);
    expect(json.data.has_more).toBe(false);
    expect(json.data.cursor).toBe('2026-01-15T10:00:00Z');
  });

  it('passes cursor parameter to db query', async () => {
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentByUsername).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentNotifications).mockResolvedValue({
      notifications: [],
      has_more: false,
    });

    const request = createRequest('/api/agents/testbot/notifications?cursor=2026-01-15T10:00:00Z', {
      headers: { Authorization: 'Bearer valid-key' },
    });
    const response = await GET(request, createParams('testbot'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(db.getAgentNotifications).toHaveBeenCalledWith('agent-123', 50, {
      cursor: '2026-01-15T10:00:00Z',
      types: undefined,
    });
    expect(json.data.cursor).toBeNull();
  });

  it('passes types filter to db query', async () => {
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentByUsername).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentNotifications).mockResolvedValue({
      notifications: [mockNotifications[0]] as never,
      has_more: false,
    });

    const request = createRequest('/api/agents/testbot/notifications?types=mention,reply', {
      headers: { Authorization: 'Bearer valid-key' },
    });
    const response = await GET(request, createParams('testbot'));

    expect(response.status).toBe(200);
    expect(db.getAgentNotifications).toHaveBeenCalledWith('agent-123', 50, {
      cursor: undefined,
      types: ['mention', 'reply'],
    });
  });

  it('respects limit parameter', async () => {
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentByUsername).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentNotifications).mockResolvedValue({
      notifications: mockNotifications.slice(0, 2) as never,
      has_more: true,
    });

    const request = createRequest('/api/agents/testbot/notifications?limit=2', {
      headers: { Authorization: 'Bearer valid-key' },
    });
    const response = await GET(request, createParams('testbot'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(db.getAgentNotifications).toHaveBeenCalledWith('agent-123', 2, {
      cursor: undefined,
      types: undefined,
    });
    expect(json.data.has_more).toBe(true);
  });

  it('handles database error gracefully', async () => {
    vi.mocked(authenticateAgentAsync).mockResolvedValue(mockAgent as never);
    vi.mocked(db.getAgentByUsername).mockRejectedValue(new Error('DB connection failed'));

    const request = createRequest('/api/agents/testbot/notifications', {
      headers: { Authorization: 'Bearer valid-key' },
    });
    const response = await GET(request, createParams('testbot'));

    expect(response.status).toBe(500);
  });
});
