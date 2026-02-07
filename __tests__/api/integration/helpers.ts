/**
 * Test helpers for API integration tests
 */

import { NextRequest } from 'next/server';
import {
  agents,
  posts,
  apiKeys,
  polls,
  hashtags,
  likes,
  reposts,
  bookmarks,
  follows,
  followers,
  conversations,
  mentions,
  activities,
  agentsByUsername,
  agentsByTwitter,
  postLikers,
  postReposters,
} from '@/lib/db/store';
import { createAgent } from '@/lib/db/agents';
import { clearRateLimitStore, stopRateLimitCleanup } from '@/lib/security';
import {
  stopChallengeCleanup,
  clearChallenges,
  clearVerificationRateLimits,
} from '@/lib/verification';

/**
 * Reset all in-memory stores between tests
 */
export function resetStores() {
  agents.clear();
  posts.clear();
  apiKeys.clear();
  polls.clear();
  hashtags.clear();
  likes.clear();
  reposts.clear();
  bookmarks.clear();
  follows.clear();
  followers.clear();
  conversations.clear();
  mentions.clear();
  activities.clear();
  agentsByUsername.clear();
  agentsByTwitter.clear();
  postLikers.clear();
  postReposters.clear();
  // Clear rate limit state for clean tests
  clearRateLimitStore();
  stopRateLimitCleanup();
  // Clear verification state
  clearChallenges();
  clearVerificationRateLimits();
  stopChallengeCleanup();
}

/**
 * Create a test agent with verification bypassed for testing
 */
export function createTestAgent(
  username: string,
  displayName: string,
  options: {
    model?: string;
    provider?: string;
    verified?: boolean;
    claimed?: boolean;
  } = {}
) {
  const { model = 'gpt-4', provider = 'openai', verified = true, claimed = true } = options;

  const result = createAgent(username, displayName, model, provider);
  if (!result) return null;

  const agent = agents.get(result.agent.id);
  if (agent) {
    // Bypass verification for testing
    if (verified) {
      agent.autonomous_verified = true;
      agent.trust_tier = 'autonomous-1';
    }
    if (claimed) {
      agent.claim_status = 'claimed';
    }
  }

  return result;
}

/**
 * Create a mock NextRequest with the given options
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    searchParams?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = 'GET', headers = {}, body, searchParams = {} } = options;

  const urlObj = new URL(url, 'http://localhost:3000');
  for (const [key, value] of Object.entries(searchParams)) {
    urlObj.searchParams.set(key, value);
  }

  const init: RequestInit = {
    method,
    headers: new Headers(headers),
  };

  if (body && method !== 'GET') {
    init.body = JSON.stringify(body);
    (init.headers as Headers).set('Content-Type', 'application/json');
  }

  return new NextRequest(urlObj, init);
}

/**
 * Create a request with Bearer token auth
 */
export function createAuthenticatedRequest(
  url: string,
  apiKey: string,
  options: Omit<Parameters<typeof createMockRequest>[1], 'headers'> & {
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${apiKey}`,
  };
  return createMockRequest(url, { ...options, headers });
}

/**
 * Parse JSON response from NextResponse
 */
export async function parseResponse<T = unknown>(
  response: Response
): Promise<{ status: number; data: T }> {
  const data = await response.json();
  return { status: response.status, data };
}
