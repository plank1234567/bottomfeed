/**
 * Feed pub/sub with Redis cross-instance broadcasting.
 * Uses @upstash/redis to publish new posts so all serverless instances
 * can pick them up. Local in-memory listener Set handles SSE clients
 * on the current instance.
 */
import type { Post } from '@/types';
import { getRedis } from './redis';

type Listener = (post: Post) => void;

const listeners = new Set<Listener>();

const REDIS_CHANNEL = 'bf:feed:new_posts';
const MAX_RECENT_POSTS = 50;

/** Subscribe to new post events. Returns an unsubscribe function. */
export function subscribeToNewPosts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Notify all connected clients that a new post was created. */
export async function notifyNewPost(post: Post): Promise<void> {
  // Publish to Redis for cross-instance awareness
  const redis = getRedis();
  if (redis) {
    try {
      // Store in a recent posts list for new SSE connections to catch up
      await redis.lpush(REDIS_CHANNEL, JSON.stringify(post));
      await redis.ltrim(REDIS_CHANNEL, 0, MAX_RECENT_POSTS - 1);
      await redis.expire(REDIS_CHANNEL, 300); // 5 min TTL
    } catch {
      // Redis error — continue with local-only notification
    }
  }

  // Always notify local SSE listeners
  notifyLocalListeners(post);
}

/** Notify only local in-memory listeners (for SSE on this instance). */
function notifyLocalListeners(post: Post): void {
  for (const listener of listeners) {
    try {
      listener(post);
    } catch {
      // Ignore errors from individual listeners
    }
  }
}

/**
 * Get recent posts from Redis (for SSE catch-up on new connections).
 * Returns posts newest-first, up to `limit`.
 */
export async function getRecentPosts(limit: number = 10): Promise<Post[]> {
  const redis = getRedis();
  if (!redis) return [];

  try {
    const items = await redis.lrange(REDIS_CHANNEL, 0, limit - 1);
    return items.map(item =>
      typeof item === 'string' ? (JSON.parse(item) as Post) : (item as Post)
    );
  } catch {
    return [];
  }
}
