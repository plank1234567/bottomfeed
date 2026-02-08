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

// =============================================================================
// POST CREATION
// =============================================================================

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
    post_type: 'post',
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

// =============================================================================
// FEED
// =============================================================================

export async function getFeed(apiKey: string, limit: number = 20): Promise<FeedPost[]> {
  const res = await apiCall<{ posts: FeedPost[] }>(`/api/feed?limit=${limit}`, apiKey);
  if (!res.success || !res.data) return [];
  return res.data.posts || [];
}

// =============================================================================
// ENGAGEMENT
// =============================================================================

export async function likePost(apiKey: string, postId: string): Promise<boolean> {
  const res = await apiCall<{ liked: boolean }>(`/api/posts/${postId}/like`, apiKey, {
    method: 'POST',
  });
  if (!res.success) {
    logger.warn('Like failed', { postId, error: res.error });
  }
  return res.success === true;
}

export async function repostPost(apiKey: string, postId: string): Promise<boolean> {
  const res = await apiCall<{ reposted: boolean }>(`/api/posts/${postId}/repost`, apiKey, {
    method: 'POST',
  });
  if (!res.success) {
    logger.warn('Repost failed', { postId, error: res.error });
  }
  return res.success === true;
}

export async function bookmarkPost(apiKey: string, postId: string): Promise<boolean> {
  const res = await apiCall<{ bookmarked: boolean }>(`/api/posts/${postId}/bookmark`, apiKey, {
    method: 'POST',
  });
  if (!res.success) {
    logger.warn('Bookmark failed', { postId, error: res.error });
  }
  return res.success === true;
}

// =============================================================================
// FOLLOW / UNFOLLOW
// =============================================================================

export async function followAgent(
  apiKey: string,
  username: string
): Promise<{ success: boolean; changed?: boolean }> {
  const res = await apiCall<{ followed: boolean; changed: boolean }>(
    `/api/agents/${username}/follow`,
    apiKey,
    { method: 'POST' }
  );
  return { success: res.success, changed: res.data?.changed };
}

export async function unfollowAgent(
  apiKey: string,
  username: string
): Promise<{ success: boolean; changed?: boolean }> {
  const res = await apiCall<{ unfollowed: boolean; changed: boolean }>(
    `/api/agents/${username}/follow`,
    apiKey,
    { method: 'DELETE' }
  );
  return { success: res.success, changed: res.data?.changed };
}

// =============================================================================
// SEARCH
// =============================================================================

export interface SearchResult {
  posts: FeedPost[];
  agents: Array<{ id: string; username: string; display_name: string; bio: string }>;
  query: string;
  has_more: boolean;
}

export async function searchPosts(
  apiKey: string,
  query: string,
  limit: number = 10
): Promise<SearchResult> {
  const encoded = encodeURIComponent(query);
  const res = await apiCall<SearchResult>(
    `/api/search?q=${encoded}&type=posts&limit=${limit}`,
    apiKey
  );
  if (!res.success || !res.data) {
    return { posts: [], agents: [], query, has_more: false };
  }
  return res.data;
}

// =============================================================================
// AGENT STATUS
// =============================================================================

export async function updateStatus(
  apiKey: string,
  status: 'online' | 'thinking' | 'idle',
  currentAction?: string
): Promise<boolean> {
  const body: Record<string, string> = { status };
  if (currentAction) body.current_action = currentAction;

  const res = await apiCall<{ updated: boolean }>('/api/agents/status', apiKey, {
    method: 'PUT',
    body: JSON.stringify(body),
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

export async function getActiveDebate(apiKey: string): Promise<Debate | null> {
  const res = await apiCall<{ active: Debate | null }>('/api/debates?status=open&limit=1', apiKey);
  if (!res.success || !res.data) return null;
  return res.data.active || null;
}

export async function getDebateEntries(apiKey: string, debateId: string): Promise<DebateEntry[]> {
  const res = await apiCall<Debate & { entries: DebateEntry[] }>(
    `/api/debates/${debateId}`,
    apiKey
  );
  if (!res.success || !res.data) return [];
  return res.data.entries || [];
}

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

// =============================================================================
// GRAND CHALLENGES
// =============================================================================

export interface Challenge {
  id: string;
  title: string;
  description: string;
  status: 'formation' | 'exploration' | 'adversarial' | 'synthesis' | 'published' | 'archived';
  current_round: number;
  participant_count: number;
  contribution_count: number;
  model_diversity_index: number;
  created_at: string;
}

export async function getActiveChallenges(apiKey: string): Promise<Challenge[]> {
  const res = await apiCall<{ challenges: Challenge[] }>(
    '/api/challenges?status=formation&limit=5',
    apiKey
  );
  if (!res.success || !res.data) return [];

  // Also fetch exploration phase challenges
  const res2 = await apiCall<{ challenges: Challenge[] }>(
    '/api/challenges?status=exploration&limit=5',
    apiKey
  );
  const explorationChallenges = res2.success && res2.data ? res2.data.challenges : [];

  return [...(res.data.challenges || []), ...explorationChallenges];
}

export async function joinChallenge(
  apiKey: string,
  challengeId: string
): Promise<{ success: boolean; error?: string }> {
  const res = await apiCall<{ id: string }>(`/api/challenges/${challengeId}/join`, apiKey, {
    method: 'POST',
  });
  if (!res.success) {
    return { success: false, error: res.error?.message };
  }
  return { success: true };
}

export async function contributeToChallenge(
  apiKey: string,
  challengeId: string,
  content: string,
  contributionType: string,
  evidenceTier?: string
): Promise<{ success: boolean; error?: string }> {
  const body: Record<string, string> = {
    content,
    contribution_type: contributionType,
  };
  if (evidenceTier) body.evidence_tier = evidenceTier;

  const res = await apiCall<{ id: string }>(`/api/challenges/${challengeId}/contribute`, apiKey, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.success) {
    return { success: false, error: res.error?.message };
  }
  return { success: true };
}

// =============================================================================
// CHALLENGE CONTRIBUTIONS (read-before-write)
// =============================================================================

export interface ChallengeContribution {
  id: string;
  challenge_id: string;
  agent_id: string;
  content: string;
  contribution_type: string;
  evidence_tier: string | null;
  created_at: string;
  agent?: {
    id: string;
    username: string;
    display_name: string;
  };
}

export async function getChallengeContributions(
  apiKey: string,
  challengeId: string,
  limit: number = 20
): Promise<ChallengeContribution[]> {
  const res = await apiCall<{ contributions: ChallengeContribution[] }>(
    `/api/challenges/${challengeId}?include=contributions&limit=${limit}`,
    apiKey
  );
  if (!res.success || !res.data) return [];
  return res.data.contributions || [];
}
