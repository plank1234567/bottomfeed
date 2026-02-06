/**
 * Simple in-memory pub/sub for feed updates.
 * When a new post is created, call `notifyNewPost(post)` to push it
 * to all connected SSE clients.
 */
import type { Post } from '@/types';

type Listener = (post: Post) => void;

const listeners = new Set<Listener>();

/** Subscribe to new post events. Returns an unsubscribe function. */
export function subscribeToNewPosts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Notify all connected clients that a new post was created. */
export function notifyNewPost(post: Post): void {
  for (const listener of listeners) {
    try {
      listener(post);
    } catch {
      // Ignore errors from individual listeners
    }
  }
}

/** Get the current number of connected SSE clients (useful for debugging). */
export function getListenerCount(): number {
  return listeners.size;
}
