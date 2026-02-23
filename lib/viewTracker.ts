/**
 * Client-side view batching singleton.
 *
 * Instead of firing one POST per visible post, this module collects post IDs
 * as they scroll into view and sends them in a single batch request after a
 * 2-second debounce window. This reduces network requests from N to 1 per
 * scroll session (where N is the number of newly-visible posts).
 *
 * Uses navigator.sendBeacon for beforeunload flush so views are not lost
 * when the user navigates away or closes the tab.
 */

const DEBOUNCE_MS = 2000;
const MAX_BATCH_SIZE = 50;
const BATCH_VIEW_URL = '/api/posts/batch-view';

let pendingIds = new Set<string>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let listenerAttached = false;

function sendBatch(ids: string[]): void {
  if (ids.length === 0) return;

  // navigator.sendBeacon is not available in SSR or some test environments
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify({ post_ids: ids })], {
      type: 'application/json',
    });
    navigator.sendBeacon(BATCH_VIEW_URL, blob);
  } else if (typeof fetch !== 'undefined') {
    // Fallback for environments without sendBeacon
    fetch(BATCH_VIEW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_ids: ids }),
      keepalive: true,
    }).catch(() => {
      // Fire-and-forget: view tracking is non-critical
    });
  }
}

function drainQueue(): string[] {
  const ids = Array.from(pendingIds);
  pendingIds = new Set();
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  return ids;
}

function scheduleFlush(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    const ids = drainQueue();
    sendBatch(ids);
  }, DEBOUNCE_MS);
}

function ensureBeforeUnload(): void {
  if (listenerAttached || typeof window === 'undefined') return;
  listenerAttached = true;
  window.addEventListener('beforeunload', flush);
}

/**
 * Queue a post ID for batch view tracking.
 * The batch will be sent after a 2-second debounce, or immediately
 * if the batch exceeds MAX_BATCH_SIZE.
 */
export function addView(postId: string): void {
  ensureBeforeUnload();

  pendingIds.add(postId);

  if (pendingIds.size >= MAX_BATCH_SIZE) {
    // Flush immediately when we hit the cap
    const ids = drainQueue();
    sendBatch(ids);
    return;
  }

  scheduleFlush();
}

/**
 * Immediately flush all pending view IDs.
 * Called on beforeunload; uses sendBeacon for reliability.
 */
export function flush(): void {
  const ids = drainQueue();
  sendBatch(ids);
}

// Exported for testing
export const _internals = {
  get pendingIds() {
    return pendingIds;
  },
  get debounceTimer() {
    return debounceTimer;
  },
  reset(): void {
    pendingIds = new Set();
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    listenerAttached = false;
  },
  DEBOUNCE_MS,
  MAX_BATCH_SIZE,
};
