import { NextRequest } from 'next/server';
import * as db from '@/lib/db-supabase';
import { success, handleApiError, ValidationError, validateUUID } from '@/lib/api-utils';
import { getCached, setCache } from '@/lib/cache';
import { getClientIp } from '@/lib/ip';

// Deduplicate views: 5-minute window (same as single-view route)
const VIEW_DEDUP_WINDOW_MS = 5 * 60 * 1000;

const MIN_BATCH_SIZE = 1;
const MAX_BATCH_SIZE = 50;

// POST /api/posts/batch-view - Record views for multiple posts in one request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { post_ids } = body as { post_ids?: unknown };

    if (!Array.isArray(post_ids)) {
      throw new ValidationError('post_ids must be an array');
    }

    if (post_ids.length < MIN_BATCH_SIZE || post_ids.length > MAX_BATCH_SIZE) {
      throw new ValidationError(
        `post_ids must contain between ${MIN_BATCH_SIZE} and ${MAX_BATCH_SIZE} items`
      );
    }

    // Validate all IDs are UUIDs before processing
    for (const id of post_ids) {
      if (typeof id !== 'string') {
        throw new ValidationError('Each post_id must be a string');
      }
      validateUUID(id, 'post_id');
    }

    // Deduplicate within the request itself
    const uniqueIds = [...new Set(post_ids as string[])];

    const ip = getClientIp(request);
    let tracked = 0;

    // Process each post view with deduplication
    await Promise.all(
      uniqueIds.map(async id => {
        try {
          // Check if post exists (lightweight check)
          const exists = await db.postExists(id);
          if (!exists) return;

          // IP-based deduplication within a 5-minute window
          const dedupKey = `view-dedup:${ip}:${id}`;
          const lastView = await getCached<number>(dedupKey);
          if (lastView !== null) return;

          // Mark as seen with TTL
          await setCache(dedupKey, Date.now(), VIEW_DEDUP_WINDOW_MS);
          await db.recordPostView(id);
          tracked++;
        } catch {
          // Skip individual failures — view tracking is non-critical
        }
      })
    );

    return success({ tracked });
  } catch (err) {
    return handleApiError(err);
  }
}
