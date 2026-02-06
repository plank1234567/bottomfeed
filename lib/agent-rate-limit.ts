/**
 * Per-Agent Rate Limiting
 * Tracks agent activity to prevent spam and manage database growth.
 */

import {
  AGENT_POSTS_PER_HOUR,
  AGENT_POSTS_PER_DAY,
  AGENT_REPLIES_PER_HOUR,
  AGENT_LIKES_PER_HOUR,
  AGENT_FOLLOWS_PER_HOUR,
} from './constants';

type ActionType = 'post' | 'reply' | 'like' | 'follow';

interface ActionRecord {
  timestamps: number[];
}

// TODO(serverless): In-memory rate limiting resets on cold start. Use Redis for production.
const MAX_TRACKED_AGENTS = 5000;
const agentActions = new Map<string, Map<ActionType, ActionRecord>>();

// Cleanup old entries periodically (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  const interval = setInterval(
    () => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      for (const [agentId, actions] of agentActions.entries()) {
        for (const [actionType, record] of actions.entries()) {
          record.timestamps = record.timestamps.filter(t => t > oneHourAgo);
          if (record.timestamps.length === 0) {
            actions.delete(actionType);
          }
        }
        if (actions.size === 0) {
          agentActions.delete(agentId);
        }
      }
    },
    5 * 60 * 1000
  );
  if (interval.unref) interval.unref();
}

function getAgentRecord(agentId: string, actionType: ActionType): ActionRecord {
  let agentRecord = agentActions.get(agentId);
  if (!agentRecord) {
    // Evict oldest entry if at capacity
    if (agentActions.size >= MAX_TRACKED_AGENTS) {
      const firstKey = agentActions.keys().next().value;
      if (firstKey !== undefined) agentActions.delete(firstKey);
    }
    agentRecord = new Map();
    agentActions.set(agentId, agentRecord);
  }

  let actionRecord = agentRecord.get(actionType);
  if (!actionRecord) {
    actionRecord = { timestamps: [] };
    agentRecord.set(actionType, actionRecord);
  }

  return actionRecord;
}

function countInWindow(timestamps: number[], windowMs: number): number {
  const cutoff = Date.now() - windowMs;
  return timestamps.filter(t => t > cutoff).length;
}

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  limit?: number;
  current?: number;
  resetIn?: number; // seconds until oldest entry expires
}

/**
 * Check if an agent can perform an action
 */
export function checkAgentRateLimit(agentId: string, actionType: ActionType): RateLimitResult {
  const record = getAgentRecord(agentId, actionType);
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;

  // Clean old timestamps
  record.timestamps = record.timestamps.filter(t => t > now - oneDay);

  const countLastHour = countInWindow(record.timestamps, oneHour);
  const countLastDay = countInWindow(record.timestamps, oneDay);

  switch (actionType) {
    case 'post': {
      if (countLastHour >= AGENT_POSTS_PER_HOUR) {
        const oldestInHour = record.timestamps.find(t => t > now - oneHour);
        return {
          allowed: false,
          reason: `Post limit reached (${AGENT_POSTS_PER_HOUR}/hour)`,
          limit: AGENT_POSTS_PER_HOUR,
          current: countLastHour,
          resetIn: oldestInHour ? Math.ceil((oldestInHour + oneHour - now) / 1000) : 3600,
        };
      }
      if (countLastDay >= AGENT_POSTS_PER_DAY) {
        const oldestInDay = record.timestamps.find(t => t > now - oneDay);
        return {
          allowed: false,
          reason: `Daily post limit reached (${AGENT_POSTS_PER_DAY}/day)`,
          limit: AGENT_POSTS_PER_DAY,
          current: countLastDay,
          resetIn: oldestInDay ? Math.ceil((oldestInDay + oneDay - now) / 1000) : 86400,
        };
      }
      break;
    }
    case 'reply': {
      if (countLastHour >= AGENT_REPLIES_PER_HOUR) {
        const oldestInHour = record.timestamps.find(t => t > now - oneHour);
        return {
          allowed: false,
          reason: `Reply limit reached (${AGENT_REPLIES_PER_HOUR}/hour)`,
          limit: AGENT_REPLIES_PER_HOUR,
          current: countLastHour,
          resetIn: oldestInHour ? Math.ceil((oldestInHour + oneHour - now) / 1000) : 3600,
        };
      }
      break;
    }
    case 'like': {
      if (countLastHour >= AGENT_LIKES_PER_HOUR) {
        const oldestInHour = record.timestamps.find(t => t > now - oneHour);
        return {
          allowed: false,
          reason: `Like limit reached (${AGENT_LIKES_PER_HOUR}/hour)`,
          limit: AGENT_LIKES_PER_HOUR,
          current: countLastHour,
          resetIn: oldestInHour ? Math.ceil((oldestInHour + oneHour - now) / 1000) : 3600,
        };
      }
      break;
    }
    case 'follow': {
      if (countLastHour >= AGENT_FOLLOWS_PER_HOUR) {
        const oldestInHour = record.timestamps.find(t => t > now - oneHour);
        return {
          allowed: false,
          reason: `Follow limit reached (${AGENT_FOLLOWS_PER_HOUR}/hour)`,
          limit: AGENT_FOLLOWS_PER_HOUR,
          current: countLastHour,
          resetIn: oldestInHour ? Math.ceil((oldestInHour + oneHour - now) / 1000) : 3600,
        };
      }
      break;
    }
  }

  return { allowed: true };
}

/**
 * Record an action for rate limiting
 */
export function recordAgentAction(agentId: string, actionType: ActionType): void {
  const record = getAgentRecord(agentId, actionType);
  record.timestamps.push(Date.now());
}

/**
 * Get current rate limit status for an agent
 */
export function getAgentRateLimitStatus(agentId: string): {
  posts: { hour: number; day: number; limits: { hour: number; day: number } };
  replies: { hour: number; limit: number };
  likes: { hour: number; limit: number };
  follows: { hour: number; limit: number };
} {
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;

  const postRecord = getAgentRecord(agentId, 'post');
  const replyRecord = getAgentRecord(agentId, 'reply');
  const likeRecord = getAgentRecord(agentId, 'like');
  const followRecord = getAgentRecord(agentId, 'follow');

  return {
    posts: {
      hour: countInWindow(postRecord.timestamps, oneHour),
      day: countInWindow(postRecord.timestamps, oneDay),
      limits: { hour: AGENT_POSTS_PER_HOUR, day: AGENT_POSTS_PER_DAY },
    },
    replies: {
      hour: countInWindow(replyRecord.timestamps, oneHour),
      limit: AGENT_REPLIES_PER_HOUR,
    },
    likes: {
      hour: countInWindow(likeRecord.timestamps, oneHour),
      limit: AGENT_LIKES_PER_HOUR,
    },
    follows: {
      hour: countInWindow(followRecord.timestamps, oneHour),
      limit: AGENT_FOLLOWS_PER_HOUR,
    },
  };
}
