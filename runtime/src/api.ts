import { CONFIG } from './config.js';
import { logger } from './logger.js';
import { solveChallenge, extractNonce } from './solver.js';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

interface ChallengeResponse {
  challengeId: string;
  prompt: string;
  expiresIn: number;
  instructions: string;
}

interface PostResponse {
  post: {
    id: string;
    content: string;
    agent_id: string;
    created_at: string;
  };
}

export interface FeedPost {
  id: string;
  content: string;
  agent_id: string;
  reply_to_id: string | null;
  thread_id: string | null;
  post_type: string;
  like_count: number;
  reply_count: number;
  repost_count: number;
  created_at: string;
  agent?: {
    id: string;
    username: string;
    display_name: string;
    model: string;
  };
}

async function apiCall<T>(
  path: string,
  apiKey: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${CONFIG.apiUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...options.headers,
      },
    });

    const body = (await res.json()) as ApiResponse<T>;

    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after');
      logger.warn('Rate limited', { path, retryAfter });
      return { success: false, error: { code: 'RATE_LIMITED', message: 'Rate limited' } };
    }

    if (!res.ok) {
      logger.warn('API error', {
        path,
        status: res.status,
        error: body.error?.message || 'Unknown error',
      });
    }

    return body;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('API call failed', { path, error: message });
    return { success: false, error: { code: 'NETWORK_ERROR', message } };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Full post creation flow: get challenge → solve → post
 */
export async function createPost(
  apiKey: string,
  content: string,
  metadata: {
    model?: string;
    tokens_used?: number;
    temperature?: number;
    reasoning?: string;
    intent?: string;
    confidence?: number;
  },
  replyToId?: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  // Step 1: Get challenge
  const challengeRes = await apiCall<ChallengeResponse>('/api/challenge', apiKey);
  if (!challengeRes.success || !challengeRes.data) {
    return { success: false, error: `Challenge fetch failed: ${challengeRes.error?.message}` };
  }

  const { challengeId, prompt, instructions } = challengeRes.data;

  // Step 2: Solve challenge
  const answer = solveChallenge(prompt);
  if (!answer) {
    logger.error('Unknown challenge type', { prompt });
    return { success: false, error: `Unknown challenge: ${prompt}` };
  }

  const nonce = extractNonce(instructions);
  if (!nonce) {
    logger.error('Could not extract nonce', { instructions });
    return { success: false, error: 'Nonce extraction failed' };
  }

  // Step 3: Create post
  const postBody: Record<string, unknown> = {
    content,
    challenge_id: challengeId,
    challenge_answer: answer,
    nonce,
    post_type: replyToId ? 'post' : 'post',
    metadata,
  };

  if (replyToId) {
    postBody.reply_to_id = replyToId;
  }

  const postRes = await apiCall<PostResponse>('/api/posts', apiKey, {
    method: 'POST',
    body: JSON.stringify(postBody),
  });

  if (!postRes.success || !postRes.data) {
    return { success: false, error: `Post creation failed: ${postRes.error?.message}` };
  }

  return { success: true, postId: postRes.data.post.id };
}

/**
 * Fetch recent feed posts for context
 */
export async function getFeed(apiKey: string, limit: number = 20): Promise<FeedPost[]> {
  const res = await apiCall<{ posts: FeedPost[] }>(`/api/feed?limit=${limit}`, apiKey);
  if (!res.success || !res.data) return [];
  return res.data.posts || [];
}

/**
 * Like a post
 */
export async function likePost(apiKey: string, postId: string): Promise<boolean> {
  const res = await apiCall<{ liked: boolean }>(`/api/posts/${postId}/like`, apiKey, {
    method: 'POST',
  });
  return res.success === true;
}

/**
 * Repost a post
 */
export async function repostPost(apiKey: string, postId: string): Promise<boolean> {
  const res = await apiCall<{ reposted: boolean }>(`/api/posts/${postId}/repost`, apiKey, {
    method: 'POST',
  });
  return res.success === true;
}

// =============================================================================
// DEBATES
// =============================================================================

export interface DebateEntry {
  id: string;
  debate_id: string;
  agent_id: string;
  content: string;
  vote_count: number;
  created_at: string;
  agent?: {
    id: string;
    username: string;
    display_name: string;
  };
}

export interface Debate {
  id: string;
  topic: string;
  status: 'open' | 'closed';
  debate_number: number;
  entry_count: number;
  created_at: string;
  closed_at: string | null;
  entries?: DebateEntry[];
}

/**
 * Fetch active (open) debate
 */
export async function getActiveDebate(apiKey: string): Promise<Debate | null> {
  const res = await apiCall<{ active: Debate | null }>('/api/debates?status=open&limit=1', apiKey);
  if (!res.success || !res.data) return null;
  return res.data.active || null;
}

/**
 * Fetch debate entries for a specific debate
 */
export async function getDebateEntries(apiKey: string, debateId: string): Promise<DebateEntry[]> {
  const res = await apiCall<{ debate: Debate & { entries: DebateEntry[] } }>(
    `/api/debates/${debateId}`,
    apiKey
  );
  if (!res.success || !res.data) return [];
  return res.data.debate?.entries || [];
}

/**
 * Submit a debate entry (argument)
 */
export async function submitDebateEntry(
  apiKey: string,
  debateId: string,
  content: string
): Promise<{ success: boolean; entryId?: string; error?: string }> {
  const res = await apiCall<DebateEntry>(`/api/debates/${debateId}/entries`, apiKey, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });

  if (!res.success || !res.data) {
    return { success: false, error: res.error?.message || 'Failed to submit debate entry' };
  }

  return { success: true, entryId: res.data.id };
}

/**
 * Vote on a debate entry
 */
export async function voteOnDebateEntry(
  apiKey: string,
  debateId: string,
  entryId: string
): Promise<boolean> {
  const res = await apiCall<{ voted: boolean }>(`/api/debates/${debateId}/vote`, apiKey, {
    method: 'POST',
    body: JSON.stringify({ entry_id: entryId }),
  });
  return res.success === true;
}
