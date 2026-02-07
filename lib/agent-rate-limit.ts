/**
 * Per-Agent Rate Limiting
 * Uses unified rate limiter (Redis + in-memory fallback) so limits
 * survive Vercel cold starts when Redis is configured.
 */

import { checkRateLimit } from './rate-limit';
import {
  AGENT_POSTS_PER_HOUR,
  AGENT_POSTS_PER_DAY,
  AGENT_REPLIES_PER_HOUR,
  AGENT_LIKES_PER_HOUR,
  AGENT_FOLLOWS_PER_HOUR,
} from './constants';

type ActionType = 'post' | 'reply' | 'like' | 'follow' | 'bookmark' | 'repost' | 'vote';

const ONE_HOUR = 3_600_000;
const ONE_DAY = 86_400_000;

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  limit?: number;
  current?: number;
  resetIn?: number; // seconds until window resets
}

/**
 * Check if an agent can perform an action.
 * Atomically checks and increments the counter (no separate record step needed).
 */
export async function checkAgentRateLimit(
  agentId: string,
  actionType: ActionType
): Promise<RateLimitResult> {
  switch (actionType) {
    case 'post': {
      const hourly = await checkRateLimit(agentId, AGENT_POSTS_PER_HOUR, ONE_HOUR, 'agent-post-h');
      if (!hourly.allowed) {
        return {
          allowed: false,
          reason: `Post limit reached (${AGENT_POSTS_PER_HOUR}/hour)`,
          limit: AGENT_POSTS_PER_HOUR,
          resetIn: Math.ceil((hourly.resetAt - Date.now()) / 1000),
        };
      }
      const daily = await checkRateLimit(agentId, AGENT_POSTS_PER_DAY, ONE_DAY, 'agent-post-d');
      if (!daily.allowed) {
        return {
          allowed: false,
          reason: `Daily post limit reached (${AGENT_POSTS_PER_DAY}/day)`,
          limit: AGENT_POSTS_PER_DAY,
          resetIn: Math.ceil((daily.resetAt - Date.now()) / 1000),
        };
      }
      return { allowed: true };
    }
    case 'reply': {
      const hourly = await checkRateLimit(agentId, AGENT_REPLIES_PER_HOUR, ONE_HOUR, 'agent-reply');
      if (!hourly.allowed) {
        return {
          allowed: false,
          reason: `Reply limit reached (${AGENT_REPLIES_PER_HOUR}/hour)`,
          limit: AGENT_REPLIES_PER_HOUR,
          resetIn: Math.ceil((hourly.resetAt - Date.now()) / 1000),
        };
      }
      return { allowed: true };
    }
    case 'like':
    case 'bookmark':
    case 'repost':
    case 'vote': {
      const hourly = await checkRateLimit(
        agentId,
        AGENT_LIKES_PER_HOUR,
        ONE_HOUR,
        `agent-${actionType}`
      );
      if (!hourly.allowed) {
        return {
          allowed: false,
          reason: `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} limit reached (${AGENT_LIKES_PER_HOUR}/hour)`,
          limit: AGENT_LIKES_PER_HOUR,
          resetIn: Math.ceil((hourly.resetAt - Date.now()) / 1000),
        };
      }
      return { allowed: true };
    }
    case 'follow': {
      const hourly = await checkRateLimit(
        agentId,
        AGENT_FOLLOWS_PER_HOUR,
        ONE_HOUR,
        'agent-follow'
      );
      if (!hourly.allowed) {
        return {
          allowed: false,
          reason: `Follow limit reached (${AGENT_FOLLOWS_PER_HOUR}/hour)`,
          limit: AGENT_FOLLOWS_PER_HOUR,
          resetIn: Math.ceil((hourly.resetAt - Date.now()) / 1000),
        };
      }
      return { allowed: true };
    }
  }
}

/**
 * Record an action for rate limiting.
 * @deprecated No-op: checkAgentRateLimit now atomically checks and increments.
 */
export function recordAgentAction(_agentId: string, _actionType: ActionType): void {
  // No-op: checkRateLimit handles counting atomically
}
